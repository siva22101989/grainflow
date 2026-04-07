# Chapter 25: Security

This chapter explains GrainFlow's security architecture in practical terms for administrators responsible for the system.

## Multi-Tenant Data Isolation

GrainFlow is a multi-tenant system where multiple warehouses share the same database. Data isolation is the most critical security property: Warehouse A must never see Warehouse B's customers, records, or payments.

This isolation is enforced at the database level using **Row Level Security (RLS)**.

### How Row Level Security Works

Every major table in the database (`storage_records`, `customers`, `payments`, `expenses`, etc.) has a `warehouse_id` column. Supabase RLS policies are attached to these tables that automatically filter queries based on the logged-in user's warehouse assignment.

In simple terms:

1. A user logs in and gets an auth session with their user ID.
2. When they query any table, the database checks: "Which warehouses is this user assigned to?"
3. The database only returns rows where `warehouse_id` matches one of the user's assigned warehouses.
4. This filtering is invisible to the application code -- it happens inside PostgreSQL before results are returned.

This means even if a bug in the application code forgets to add a `WHERE warehouse_id = ...` clause, the database will still enforce the filter. This is a defense-in-depth strategy.

### What RLS Does NOT Do

- RLS does not filter based on role (owner vs. staff). Role-based restrictions within a warehouse are handled at the application layer.
- RLS does not apply to database admin connections or service role keys. The Supabase service role key bypasses all RLS policies. Never expose this key to the client.

> **Warning:** The `SUPABASE_SERVICE_ROLE_KEY` bypasses all RLS. It is used only in server-side code for admin operations (cron jobs, webhooks). It must never be exposed to the browser or included in `NEXT_PUBLIC_` environment variables.

## Authentication

GrainFlow uses Supabase Auth with server-side rendering (SSR). Key security properties:

- **Session management:** Auth sessions are stored in HttpOnly cookies, not localStorage. This prevents JavaScript-based session theft (XSS attacks).
- **CSRF protection:** Built into the Supabase SSR auth flow.
- **Server-side verification:** Every server action re-verifies the user's auth session before processing. There is no trust of client-side session claims.

### Session Flow

1. User submits credentials to Supabase Auth.
2. Supabase returns a session token stored in an HttpOnly cookie.
3. On each server action call, the server reads the cookie, verifies the token with Supabase, and retrieves the current user.
4. If the token is invalid or expired, the user is redirected to `/login`.

## RBAC Enforcement

Role-Based Access Control is enforced at three layers, as described in Chapter 22. From a security perspective:

1. **UI layer** hides controls but is not a security boundary (can be bypassed with browser dev tools).
2. **Server action layer** is the primary enforcement point. Every `'use server'` function checks the user's role before performing operations.
3. **Database layer (RLS)** is the last line of defense, ensuring data access is constrained even if the server action layer has a bug.

### The authenticatedAction Pattern

Many server actions use a wrapper function called `authenticatedAction` that:

1. Retrieves the current user from the auth session.
2. Fetches the user's profile and role.
3. Passes the verified user, Supabase client, and role to the action handler.
4. Returns an error if authentication fails.

This centralizes auth checking and prevents individual actions from forgetting to verify the session.

## Audit Trail

All significant operations are recorded in the `audit_logs` table. This provides a tamper-evident record of who did what, when, and from where.

### Audit Log Structure

| Field | Description |
|---|---|
| `id` | Unique log entry identifier |
| `warehouse_id` | Which warehouse the action affected |
| `user_id` | Who performed the action |
| `action` | CREATE, UPDATE, DELETE, LOGIN, LOGOUT, EXPORT, BULK_ACTION |
| `entity` | STORAGE_RECORD, CUSTOMER, PAYMENT, INFLOW, OUTFLOW, USER, SETTINGS, SUBSCRIPTION |
| `entity_id` | The specific record affected |
| `details` | JSON with action-specific context (e.g., old values, new role, operation type) |
| `ip_address` | The actor's IP address (from x-forwarded-for or x-real-ip headers) |
| `created_at` | Timestamp of the action |

### Immutability

The audit log schema defines no `Update` type -- entries are write-once. The application never updates or deletes audit log rows. This ensures the trail cannot be tampered with through normal application operations.

### Non-Blocking Design

Audit logging is designed to never block the primary operation. If the audit log insert fails (network issue, database error), the failure is logged to Sentry but the main action still succeeds. This prevents audit logging bugs from breaking business operations.

## Soft Deletes

GrainFlow uses soft deletes throughout the system instead of hard deletes. When a record is "deleted":

1. The `deleted_at` column is set to the current timestamp.
2. The record remains in the database but is filtered out of normal queries.
3. Application queries include `WHERE deleted_at IS NULL` (or equivalent RLS policy) to exclude soft-deleted records.

This applies to:
- Warehouses (`warehouses.deleted_at`)
- Warehouse assignments (`warehouse_assignments.deleted_at`)
- Storage records (`storage_records.deleted_at`)

### Benefits

- **Audit integrity:** The audit trail references entity IDs that still exist in the database.
- **Recovery:** Accidentally deleted records can be restored by setting `deleted_at` back to NULL.
- **Compliance:** Data retention requirements can be met without losing records.

> **Warning:** Soft-deleted records still count toward storage usage in the database. If a warehouse has many soft-deleted records, they consume space but are not visible to users. Periodic cleanup of very old soft-deleted records should be done directly in the database with caution.

## Input Validation

All user inputs are validated using Zod schemas before reaching the database:

- **String sanitization:** The `sanitizeString` utility removes `<` and `>` characters to prevent XSS injection.
- **Phone number validation:** Phone numbers are stripped of non-digit characters and validated to 10 digits.
- **Email validation:** Standard email format validation via Zod.
- **Numeric validation:** Amounts, quantities, and IDs are type-checked and range-validated.

React's built-in JSX escaping provides an additional layer of XSS prevention. The application does not use `dangerouslySetInnerHTML`.

## Rate Limiting and API Security

### Server Actions

GrainFlow uses Next.js Server Actions instead of traditional API routes for most operations. Server Actions are:

- Automatically authenticated (cookie-based)
- Type-safe with TypeScript
- Validated with Zod schemas
- Not directly callable as REST endpoints

### Webhook Security

The Razorpay webhook endpoint (`/api/razorpay/webhook`) verifies the webhook signature using the `RAZORPAY_WEBHOOK_SECRET` before processing any payment event. Unverified webhooks are rejected.

### Payment Security

- Payment amounts are validated against plan prices with a tolerance of 1 rupee to prevent amount manipulation.
- Idempotency checks prevent double-processing of the same payment (checked via `razorpay_payment_id`).

## Encryption

### In Transit

All connections use TLS (HTTPS). Supabase enforces TLS 1.3 for database connections. The application is deployed on Vercel which enforces HTTPS for all traffic.

### At Rest

Data at rest is encrypted by Supabase's infrastructure. The database storage, backups, and connection strings are all encrypted. Sensitive environment variables are managed through the hosting provider's encrypted environment variable storage.

### Secrets Management

| Secret | Storage | Never Expose To |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Server env only | Browser, client code, logs |
| `RAZORPAY_KEY_SECRET` | Server env only | Browser, client code |
| `RAZORPAY_WEBHOOK_SECRET` | Server env only | Browser, client code |
| `TEXTBEE_API_KEY` | Server env only | Browser, client code |
| `SENTRY_AUTH_TOKEN` | Server env only | Browser, client code |
| `NEXT_PUBLIC_SUPABASE_URL` | Client-safe | N/A (public by design) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-safe | N/A (public, RLS protects data) |

> **Warning:** Never commit `.env.local` to version control. The `.gitignore` file should include this entry. Rotate secrets immediately if they are accidentally exposed.

## Error Handling and Logging

### Centralized Error Logger

All errors are logged through the `logError()` utility, which:

1. Sends the error to Sentry with structured context (operation name, user ID, warehouse ID, metadata).
2. Logs to the console in development mode.
3. Never exposes stack traces or internal details to the end user.

### Error Messages

User-facing error messages are generic and do not reveal implementation details. For example:
- "An unexpected error occurred" instead of database error messages
- "Unauthorized" instead of describing which permission check failed
- "Failed to send SMS" instead of exposing TextBee API error responses

This prevents information leakage that could help an attacker understand the system's internals.

## Security Monitoring

### Sentry Integration

All runtime errors are captured by Sentry with:
- **Tags:** Operation name for filtering (e.g., `activateSubscriptionPayment`)
- **User context:** User ID (when available)
- **Extra data:** Warehouse ID and action-specific metadata

### Recommended Monitoring Practices

1. Review Sentry alerts daily for unusual error patterns.
2. Run `npm audit` monthly to check for dependency vulnerabilities.
3. Review the audit log periodically for unusual admin actions.
4. Monitor the Supabase dashboard for unusual query patterns or auth failures.
5. Rotate API keys and secrets quarterly.

## Security Checklist for Administrators

- [ ] All environment variables are set correctly in production
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is not exposed in any `NEXT_PUBLIC_` variable
- [ ] HTTPS is enforced on the production domain
- [ ] Supabase RLS is enabled on all tables (verify in Supabase dashboard > Authentication > Policies)
- [ ] Sentry error monitoring is active and alerting
- [ ] Database backups are enabled in Supabase
- [ ] TextBee device is online and connected
- [ ] Razorpay webhook secret matches the dashboard configuration
- [ ] `.env.local` is in `.gitignore` and not committed
- [ ] Monthly `npm audit` is scheduled
