# RENT Project

## Project Context

GrainFlow is a multi-tenant Warehouse Management System for agricultural storage (Next.js 16, Supabase, TypeScript).
- **Brand name**: Always "GrainFlow" (one word, capital G and F). Never "Grain Flow".
- **Live URL**: https://grainflow.vercel.app
- **Dev server**: `npm run dev` on port 9002. Supabase project: `ayndosipsjjcagfrdglg`.

## Commands

```bash
npm run dev          # Dev server on port 9002
npm test             # Vitest (352 tests, ~5s)
npm run test:e2e     # Playwright E2E (10 specs)
npx tsc --noEmit     # Type check
npx next build       # Production build
```

## Key Patterns

- **Auth**: Supabase Auth with RLS. Use `belongs_to_warehouse()` for all RLS policies (checks super_admin, profiles.warehouse_id, and warehouse_assignments).
- **Roles**: Always use `UserRole` enum from `@/types/db` for role checks. Never compare against raw strings like `'owner'` or `'super_admin'`.
- **Ownership**: No `warehouses.owner_id` column. Look up owners via `user_warehouses` with `role = 'owner'`.
- **Webhooks**: Razorpay webhook at `/api/razorpay/webhook`. Signature verification rejects on missing secret. Use `payment.payment_link_id` for Payment Link lookups.
- **Bulk Payment**: `process_bulk_payment_atomic` RPC accepts `(p_customer_id, p_payment_date, p_warehouse_id, p_allocations)` only.
- **Bulk Outflow**: Supports FIFO (default) and per-record manual allocation via `recordAllocations` JSON field. Backend validates per-record bag counts.
- **Lot Stock**: `sync_lot_stock` DB trigger auto-recalculates `current_stock` from `SUM(bags_stored)` on every `storage_records` change. Always sort lots with `.order('name')`.
- **Soft Delete**: All deletions use `deleted_at` timestamp. Always add `.is('deleted_at', null)` to queries.
- **Payments table**: Has no `warehouse_id` column. Filter via join: `.eq('storage_records.warehouse_id', warehouseId)`.
- **Bag counts**: `bagsStored` from `mapRecords()` already has withdrawals subtracted. Never do `bagsStored - bagsOut` (double-counts).
- **Tests**: 352 passing (Vitest). Factories at `src/test/factories/index.ts`. Run `npm test`.

## Architecture

```
src/
  app/                    # Next.js pages and API routes
    (dashboard)/          # Authenticated pages (layout with sidebar)
    (public)/             # Public pages (pricing)
    api/                  # API routes (webhooks, cron, health)
    login/, signup/       # Auth pages
  components/
    landing/              # Marketing page components (Hero, Features, etc.)
    customers/            # Customer-specific UI (bulk-outflow-dialog)
    admin/                # Admin panel components
    ui/                   # shadcn/ui primitives
    shared/               # Reusable components (toast, page-header)
    providers/            # Context providers (subscription)
  lib/
    actions/              # Server actions (mutations). Grouped by domain:
      storage/            #   inflow.ts, outflow.ts, bulk-outflow.ts, records.ts
      payments.ts, customers.ts, expenses.ts, auth.ts
    queries/              # Read-only data fetching (cached with React cache)
      storage.ts, customers.ts, financials.ts, analytics.ts, warehouses.ts
    services/             # Business logic services (razorpay, payments, notifications)
    billing.ts            # Rent calculation (BillingService)
    definitions.ts        # TypeScript types (Customer, StorageRecord, etc.)
    data.ts               # Legacy read/write functions (prefer queries/ + actions/)
  hooks/                  # Client-side hooks (SWR wrappers, debounce, toast)
  contexts/               # React contexts (warehouse)
  types/                  # DB enums (UserRole, SubscriptionStatus, AuditAction)
  test/
    unit/                 # Pure logic tests (16 files)
    integration/          # Multi-step flow tests
    factories/            # Test data builders (buildCustomer, buildStorageRecord, etc.)
    mocks/                # Mock Supabase client
    setup.ts              # Global test setup (mocks next/navigation, supabase auth)
```

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=            # Supabase project URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=  # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=           # Admin operations (user listing, subscriptions)
RAZORPAY_KEY_SECRET=                 # Razorpay API secret
RAZORPAY_WEBHOOK_SECRET=             # Webhook signature verification
NEXT_PUBLIC_RAZORPAY_KEY_ID=         # Client-side Razorpay key
CRON_SECRET=                         # Bearer token for cron API routes
TEXTBEE_API_KEY=                     # SMS service API key
TEXTBEE_DEVICE_ID=                   # SMS device ID
```

## Code Style

- **Validation**: Use Zod schemas with `safeParse()` for all form inputs. Return field errors via `validatedFields.error.flatten().fieldErrors`.
- **Server actions**: Wrap in `Sentry.startSpan()` for tracing. Call `checkRateLimit()` before mutations.
- **Error handling**: Use `logError()` / `logWarning()` from `@/lib/error-logger`, never `console.error`.
- **Revalidation**: Call `revalidatePath()` only for paths that display the changed data.
- **New data layer code**: Reads go in `src/lib/queries/`. Writes go in `src/lib/actions/`. Avoid adding to `data.ts`.

## Testing

- **Framework**: Vitest + jsdom. Run with `npm test`.
- **Factories**: `src/test/factories/index.ts` — `buildCustomer()`, `buildStorageRecord()`, `buildPayment()`, `buildWarehouse()`, `buildSubscription()`, `buildPlan()`.
- **Mock Supabase**: `src/test/mocks/supabase.ts` — chainable query builder with `.eq()`, `.is()`, `.single()`, in-memory data.
- **Pattern**: Extract pure logic from server actions, test the logic directly. Don't mock Next.js request infrastructure.
- **Style**: `describe()` → nested `describe()` → `it('should ...')`. Import `{ describe, it, expect }` from `vitest`.

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
