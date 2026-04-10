<p align="center">
  <img src="/public/logo-v4.png" alt="GrainFlow" width="80" height="80" />
</p>

<h1 align="center">GrainFlow</h1>

<p align="center">
  <strong>Warehouse management built for Indian agriculture</strong>
</p>

<p align="center">
  <a href="https://grainflow.vercel.app">Live Demo</a> &middot;
  <a href="docs/manual/00-index.md">User Manual</a> &middot;
  <a href="docs/ARCHITECTURE.md">Architecture</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/TypeScript-Strict-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase" alt="Supabase" />
  <img src="https://img.shields.io/badge/Tests-352%20passing-brightgreen" alt="Tests" />
  <img src="https://img.shields.io/badge/Build-passing-brightgreen" alt="Build" />
  <img src="https://img.shields.io/badge/License-Private-red" alt="License" />
</p>

---

GrainFlow replaces manual ledgers with real-time digital tracking, automated billing, and customer portals for agricultural warehouses. Multi-tenant, mobile-first, built for warehouse owners managing thousands of bags across multiple lots.

## What It Does

**For warehouse owners:**
- Track inflow and outflow per customer, per commodity, per lot
- Auto-calculate rent based on storage duration (6-month and yearly cycles)
- Bulk outflow with FIFO or manual per-record bag allocation
- Generate PDF receipts and Excel reports
- Send SMS notifications for transactions and payment reminders

**For customers:**
- Self-service portal to view storage status and payment history
- OTP-based passwordless login via mobile number

**For admins:**
- Multi-warehouse management with role-based access (Super Admin, Owner, Admin, Manager, Staff)
- Subscription management with activation codes and Razorpay payment links
- Real-time analytics dashboard with occupancy, revenue, and activity tracking

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict mode) |
| Database | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth (SSR cookies + middleware) |
| UI | shadcn/ui + Tailwind CSS 4 |
| Payments | Razorpay (payment links + webhooks) |
| SMS | TextBee API |
| Monitoring | Sentry (error tracking + performance) |
| Testing | Vitest (352 tests) + Playwright (10 E2E specs) |
| Hosting | Vercel (Edge Network) |

## Quick Start

```bash
git clone https://github.com/siva22101989/grainflow.git
cd grainflow
npm install
```

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Payments (optional)
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
NEXT_PUBLIC_RAZORPAY_KEY_ID=your_razorpay_key

# SMS (optional)
TEXTBEE_API_KEY=your_textbee_key
TEXTBEE_DEVICE_ID=your_device_id

# Cron security
CRON_SECRET=your_cron_secret
```

```bash
npm run dev    # http://localhost:9002
```

## Commands

```bash
npm run dev          # Development server (port 9002)
npm test             # Run 352 unit/integration tests (~5s)
npm run test:e2e     # Run Playwright E2E tests
npm run test:coverage # Coverage report
npx tsc --noEmit     # Type check (0 errors)
npx next build       # Production build
```

## Architecture

```
src/
  app/                    # Next.js pages and API routes
    (dashboard)/          # Authenticated pages (sidebar layout)
    (public)/             # Public pages (pricing)
    api/                  # Webhooks, cron jobs, health check
  components/             # React components (shadcn/ui + custom)
  lib/
    actions/              # Server actions (mutations, grouped by domain)
    queries/              # Read-only data fetching (React cache)
    services/             # Business logic (Razorpay, payments, billing)
    billing.ts            # Rent calculation engine
  hooks/                  # Client-side hooks
  middleware.ts           # Auth guard for all routes
  test/                   # 352 tests (unit + integration + security)
```

**Key patterns:**
- Multi-tenancy via Supabase RLS with `belongs_to_warehouse()` function
- Server actions for all mutations, wrapped in Sentry spans
- Zod validation on every form input
- Soft-delete with `deleted_at` timestamps (audit trail preservation)
- `sync_lot_stock` DB trigger for automatic stock reconciliation

## Features

### Inventory
- Inflow/outflow tracking with lot-level granularity
- QR code labels for storage records
- Bulk outflow with FIFO allocation or manual per-record editing
- Real-time stock dashboard with occupancy rates

### Billing
- Automated rent calculation (6-month and yearly billing cycles)
- Hamali (labor) charge tracking with auto-settlement on record closure
- Bulk payment allocation across multiple records
- Razorpay payment links sent via SMS

### Customers
- Customer profiles with 360-degree financial view
- Self-service portal with OTP login
- Payment history and downloadable statements (PDF/Excel)
- SMS notifications for inflow, outflow, and payment events

### Admin
- Multi-warehouse support with role-based access control
- Subscription management (Free, Starter, Professional, Enterprise)
- Activation code generation for offline sales
- User directory with role management
- Audit logs and analytics dashboard

### Reports
- Financial analytics (revenue, collections, outstanding dues)
- Operational analytics (capacity, inflow/outflow trends)
- Custom report builder with date ranges and filters
- Export to PDF and Excel

## Testing

352 tests across 30 test files, all passing in ~5 seconds.

| Category | Tests | Coverage |
|----------|-------|----------|
| Billing & rent calculations | 21 | BillingService, multi-year, edge cases |
| Payment allocation (FIFO, bulk) | 14 | Allocation logic, proportional distribution |
| Server action validation | 116 | All P0 actions (customers, payments, storage, subscriptions, outflow) |
| API route logic | 37 | Webhook routing, cron auth, health status, dues calculation |
| Bulk outflow preview | 24 | FIFO, manual overrides, exclusion, commodity filtering, hamali |
| Razorpay webhook | 4 | Signature verification, payment link lookup |
| Security guards | 5 | Auth checks, role verification, soft-delete enforcement |
| Subscription logic | 27 | State transitions, payment validation, grace periods |
| Integration flows | 2 | Payment flow, outflow process |
| E2E (Playwright) | 10 specs | Auth, core flow, financials, management, accessibility |

## Security

- **Auth middleware** on all dashboard and API routes
- **Row Level Security** (RLS) on every Supabase table
- **Webhook signature verification** (Razorpay HMAC-SHA256)
- **Rate limiting** on all mutation endpoints (fail-closed on security paths)
- **Content Security Policy** with no unsafe-eval/unsafe-inline
- **CODEOWNERS** enforced for security-sensitive files
- **Cron routes** protected by Bearer token
- **UserRole enum** for all role checks (no string comparisons)
- **Soft-delete** with `deleted_at` filter on all queries

## Performance

Benchmarked on production (Vercel Edge):

| Page | TTFB | FCP | Full Load | JS Bundle |
|------|------|-----|-----------|-----------|
| Landing | 38ms | 672ms | 860ms | 352KB |
| Pricing | 71ms | 804ms | 796ms | — |
| Login | 33ms | 612ms | 615ms | — |

Grade: **A** (all metrics under budget)

## License

Private. All rights reserved.
