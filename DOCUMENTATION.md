# GrainFlow Architecture & Documentation Guide

Welcome to the documentation for the GrainFlow Storage & Billing Management System. This document serves as the master guide for new developers to understand the project's features, data flow, architecture, and business logic.

## Overview

GrainFlow is a comprehensive Next.js application designed to manage agricultural storage facilities (warehouses/cold storage). It tracks inventory inflows (deposits), outflows (withdrawals), billing (rent, hamali/labor charges), and customer accounts.

### Key Technologies

- **Framework:** Next.js (App Router)
- **Database & Auth:** Supabase (PostgreSQL)
- **UI Components:** React, Tailwind CSS, Radix UI (shadcn/ui)
- **State Management/Data Fetching:** React Server Actions, `useActionState`
- **Validation:** Zod
- **Error Tracking:** Sentry

---

## 1. Core Data Models (Supabase)

Understanding the database schema is crucial. The primary tables are:

- **`customers`**: Stores farmer/agent details (name, phone, village, father's name).
- **`storage_records`**: The heart of the system. Represents a specific "lot" or "batch" of bags brought in by a customer on a specific date.
  - `bags_in` (alias: `bagsStored`): Initial bags deposited.
  - `bags_out` (calculated): Total bags withdrawn over time.
  - _Current Stock_ is dynamically calculated as `bags_in - bags_out`.
  - Tracks financial state: rent due, hamali payable, khata (advances).
- **`withdrawal_transactions`**: Logs every outflow event associated with a `storage_record`, including the date, bags withdrawn, rent charged for that specific withdrawal, and any discounts applied.
- **`payments`** & **`expenses`**: Financial tables to track incoming rent payments and outgoing operational expenses (like labor payouts).
- **`warehouse_lots`**: Represents physical storage areas in the warehouse with a defined `capacity`.

---

## 2. Core Business Workflows

### 2.1. Inflow (Depositing Bags)

**File:** `src/lib/actions/storage/inflow.ts`

When a customer brings bags to the warehouse:

1.  User selects a customer and lot.
2.  `addInflow` action is triggered.
3.  Validates lot capacity limit.
4.  Creates a new `storage_record`.
5.  Updates the physical `warehouse_lot` stock.

### 2.2. Outflow (Withdrawing Bags)

**File:** `src/lib/actions/storage/outflow.ts`

When a customer removes bags, rent must be calculated up to the withdrawal date.

1.  User selects an active `storage_record`.
2.  Provides `bagsToWithdraw`, `withdrawalDate`, and optionally `discount` or `amountPaidNow`.
3.  `BillingService.calculateOutflowImpact` calculates the rent specifically for those bags for the duration they were stored.
4.  A `withdrawal_transactions` row is created.
5.  The `storage_record` is updated (bags_out increases, rent due increases).
6.  If the balance of bags reaches 0, the record is marked "Completed" (`storage_end_date` is set).

### 2.3. Bulk Outflow

**File:** `src/lib/actions/storage/bulk-outflow.ts`

Customers often withdraw bags across multiple storage records simultaneously (e.g., pulling 500 bags of Maize, but they were deposited across 3 different lots over 2 months).

1.  The system finds all active `storage_records` for that customer & commodity.
2.  It uses a **FIFO (First-In-First-Out)** algorithm based on `storage_start_date` to deduct the requested bags sequentially from the oldest records first.
3.  Rent is calculated per-record. Discounts and payments collected at the "bulk" level are distributed proportionally based on each record's share of the total rent.

---

## 3. Financial Logic & Billing

**File:** `src/lib/billing.ts` (`BillingService`)

Financial calculations are isolated in `BillingService` to ensure consistency.

- **Rent Calculation (`calculateRent`)**:
  Calculates rent based on the number of bags, duration (in months, rounded appropriately based on business rules), and the storage rate.
- **State Updates (`calculateOutflowImpact`)**:
  When an outflow happens, it returns exactly how the `storage_record` should be mutated without touching the database itself. This separation of concerns simplifies testing.

---

## 4. Architecture Pattern: Data vs Execution Layers

The backend is split into distinct layers to promote maintainability:

1.  **Data Layer (`src/lib/data.ts`)**: Contains "dumb" generic data access methods (e.g., `updateStorageRecord`, `saveCustomer`). These purely throw errors on DB failure and do not handle HTTP responses or form state.
2.  **Query Layer (`src/lib/queries/storage.ts`)**: Contains complex `SELECT` operations, often involving joins and aggregations to format data specifically for the frontend.
3.  **Action Layer (`src/lib/actions/*.ts`)**: The "Controller". Next.js Server Actions handle form validation (Zod), authorization/rate limiting, call the Query/Data layers, handle errors gracefully, and return standard `FormState` objects (`{ success: boolean, message: string }`) to the React components.

_Rule of Thumb:_ Never call `createClient` inside a UI component directly if it involves business logic or mutations. Always use a Server Action.

---

## 5. Standard Error Handling Protocol

- **Data Layer:** Uses typical `try/catch`. If Supabase responds with an error, the function `throw new Error(msg)` so the caller knows it failed.
- **Action Layer:** Wraps operations in try/catch. Catches the error, logs it via Sentry/`logError`, and returns a safe object to the UI: `return { success: false, message: 'Friendly error message' }`.
- **UI Components:** Use React's `useActionState` (or similar mechanisms) to read the `success` and `message` properties and display Toast notifications to the user without crashing the app.

---

## 6. Where to Find Things

- `src/app/(dashboard)/*`: The main UI pages.
- `src/components/*`: Reusable React components (Tables, Modals, Forms).
- `src/lib/actions/*`: Server Actions (Mutations).
- `src/lib/queries/*`: Data Fetching.
- `src/lib/billing.ts`: Rent math.
- `src/lib/data.ts`: Database insert/update functions.
- `src/lib/definitions.ts`: Shared TypeScript interfaces.

_For specific feature documentation, please refer to the `README.md` files located within individual module directories (e.g., `src/lib/README.md`)._
