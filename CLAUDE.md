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
