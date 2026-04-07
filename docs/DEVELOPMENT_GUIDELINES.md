# Grain Flow Development Guidelines

This document serves as the single source of truth for development standards, architectural decisions, and core logic for the Grain Flow WMS.

## 🏗️ Architecture Overview

- **Framework**: Next.js 16 (App Router)
- **Database**: Supabase (PostgreSQL)
- **State Management**: React Server Components (RSC) + Server Actions ('use server') for mutations.
- **Validation**: Zod for all form inputs and API boundaries.
- **UI**: Shadcn/UI + Tailwind CSS.

---

## 💾 Database Logic & Rules

### 1. Strict Enums

The database uses strict PostgreSQL ENUMs. String literals must match exactly.

| Enum Name       | Allowed Values                            | Logic Mapping                               |
| :-------------- | :---------------------------------------- | :------------------------------------------ |
| `billing_cycle` | `'6m'`, `'1y'`                            | Defaults to `'6m'` if unspecified.          |
| `movement_type` | `'in'`, `'out'`, `'adjustment'`, `'void'` | Controlled by `log_stock_movement` trigger. |
| `lot_status`    | `'Active'`, `'Full'`, `'Maintenance'`     | Derived from capacity vs stock.             |

### 2. Stock Movement Trigger

**Never insert directly into `stock_movements`.**
The `log_stock_movement` trigger on `storage_records` handles this automatically:

- **INSERT**: Logs `movement_type: 'in'`, `direction: 'increase'`.
- **UPDATE (bags change)**: Logs `movement_type: 'adjustment'`, calculates `direction` based on the delta.
- **SOFT DELETE**: Logs `movement_type: 'void'`, `direction: 'decrease'`.

### 3. Revalidation Strategy

To ensure the "Single Page Application" feel without stale data, server actions must revalidate all affected paths.

**Global Revalidation Checklist:**
When mutating `StorageRecord`, `Payment`, or `Outflow`, you MUST revalidate:

1.  **Primary Resource**: `/storage` or `/outflow`
2.  **Financials**: `/financials` (Totals change)
3.  **Customer List**: `/customers` (Active bags count changes)
4.  **Customer Specific**: `/customers/[id]` (Personal balance/history changes)
5.  **Reports**: `/reports`

```typescript
// Example Pattern
revalidatePath("/storage");
revalidatePath("/financials");
revalidatePath("/customers");
if (customerId) revalidatePath(`/customers/${customerId}`);
```

---

## 🧩 Code Patterns

### 1. Service Layer (`src/lib/services/`)

Business logic (calculations, complex updates) lives in Services, not Server Actions.

- **BillingService**: Calculates rent, storage impact, and reversal logic.
- **PaymentService**: Handles payment recording and balance updates.

### 2. Type Safety & Mapping

- **Database**: Uses `snake_case` (e.g., `customer_id`, `bags_stored`).
- **Application**: Uses `camelCase` (e.g., `customerId`, `bagsStored`).
- **Mapping**: Always use helper functions like `mapRecords()` in queries to transform DB rows to `StorageRecord` types.

### 3. Validation

Always validate inputs using Zod schemas defined in `src/lib/validation.ts` or co-located in actions.

---

## 🔄 Common Workflows

### Adding a New Feature

1.  **Database**: Create a migration in `supabase/migrations/` (use `YYYYMMDDHHMMSS_name.sql`).
2.  **Types**: Update `src/lib/definitions.ts` to reflect new tables/enums.
3.  **Queries**: Add data fetchers in `src/lib/queries/`.
4.  **Actions**: Create `'use server'` actions in `src/lib/actions/` with Zod validation.
5.  **UI**: Create components in `src/components/`.

### Soft Deletes

We use **Soft Deletes** (`deleted_at` column) for text-heavy records (Customers, Storage).

- **Queries**: Must filter `.is('deleted_at', null)`.
- **Restoration**: `restoreX` actions set `deleted_at = null`.

---

## ⚠️ Critical "Gotchas"

1.  **Billing Cycle Default**: Default is `'6m'`, NOT `'6-Month Initial'`.
2.  **Date Objects**: `date-fns` expects JS Date objects. Ensure strings from Forms/JSON are converted via `new Date()`.
3.  **Server Actions**: Arguments must be serializable. Do not pass complex class instances; pass plain objects or IDs.
4.  **RLS Authorization**: Use `belongs_to_warehouse(warehouse_id)` for all RLS policies. Never query `user_warehouses` directly in policies. The function checks super_admin bypass, `profiles.warehouse_id`, and `warehouse_assignments`.
5.  **Warehouse Owner Lookup**: The `warehouses` table has NO `owner_id` column. Look up owners via `user_warehouses` with `role = 'owner'`.
6.  **Webhook Signature**: `verifyWebhookSignature()` rejects when secret is missing. Never bypass in production.
7.  **Payment Link Lookup**: Use `payment.payment_link_id` (not `payment.order_id`) to match Razorpay Payment Link payments.
8.  **Bulk Payment RPC**: `process_bulk_payment_atomic` accepts only `(p_customer_id, p_payment_date, p_warehouse_id, p_allocations)`. Do not pass extra parameters.
9.  **Lot Sort Order**: Always include `.order('name', { ascending: true })` when querying `warehouse_lots`. The `useStaticData` hook also sorts defensively on cache load and realtime inserts.
10. **Payment Due Calculation**: `getPendingRecords()` sums ALL payment types (rent + hamali + other). Do not filter by type when calculating total paid.
