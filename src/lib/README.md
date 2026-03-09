# `src/lib` - Core Logic & Data Access

This directory contains the core business logic, database queries, and data mutation functions for the GrainFlow application. It is designed to cleanly separate Database Access from API/Frontend concerns.

## Directory Structure

- **/actions/**
  Contains Next.js Server Actions. These functions are intended to be called directly from React components (e.g., using `useActionState` or form `action` handlers). They act as the "Controller" layer.
  - **Responsibilities:** Input validation (using Zod), rate limiting, authentication checks, calling the underlying `/data.ts` or `/billing.ts` logic, error handling, and returning standard `{ success, message }` objects to the frontend.
  - **Subdirectories:** Organized by domain (e.g., `/actions/storage`, `/actions/customers`).

- **/queries/**
  Contains Data Fetching logic. These functions execute Supabase `SELECT` statements and format the results. They are used by server components to render pages and by server actions to load data.
  - **Files:** `storage.ts` (fetching records, stats), `customers.ts` (customer lists), `auth.ts` (session data).

- **`data.ts`**
  The Data Access Layer (DAL) for "mutations". It handles all `INSERT`, `UPDATE`, and `DELETE` operations against the database.
  - **Design Rule:** Functions here should _only_ perform database operations. They should throw errors upon failure and let the UI/Action layer catch them. They should _not_ handle validation or format UI error messages.

- **`billing.ts`**
  The Financial Engine. Contains the `BillingService` class with static methods for purely mathematical calculations.
  - **Methods:** `calculateRent` (core formula), `calculateOutflowImpact` (computes the effect of an outflow on a storage record without mutating the DB directly).
  - **Design Rule:** These functions should be strictly deterministic and testable, devoid of side effects (`console.log` aside) or database calls.

- **`definitions.ts`**
  Contains TypeScript interfaces and type definitions used across the entire application (e.g., `StorageRecord`, `Customer`). Relying on this file ensures type safety between the DB layer, Action layer, and UI.

- **`error-logger.ts`** & **`logger.ts`**
  Utilities for logging errors (often wrapping Sentry and custom logic) and creating in-app user notifications.

- **`sms-event-actions.ts`** & **`textbee.ts`**
  Handles sending SMS receipts and confirmations to customers using the TextBee API. Contains templates and triggering logic for events like Inflow, Outflow, and Payments.

## Key Principles

1.  **Never expose Supabase `createClient` inside a UI Component:** If you need data, write a function in `queries/`, export it, and call it from the Server Component. If you need to mutate data from a form, create a Server Action in `actions/`.
2.  **Graceful Errors:** The UI expects a `FormState` object: `{ success: boolean, message: string }`. Server Actions map raw SQL errors into this format.
3.  **Validate First:** Every Server Action must validate its `FormData` using a Zod schema before processing.
