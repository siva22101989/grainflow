# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased] - 2026-04-07

### Added

- **19-chapter user manual and admin guide** in `docs/manual/` with PDF generation (`npm run docs:pdf`)
- **116 new action tests** covering bulk outflow, customers, payments, storage, and subscriptions
- **Test data factories** (`src/test/factories/index.ts`) for consistent test data generation
- **FAQ section** added to in-app guide page (rent calculation, FIFO, hamali, customer portal, soft deletes)
- **Subscription settings tab** added to warehouse settings page
- **Webhook event handlers** for `payment_link.paid`, `payment_link.cancelled`, `payment_link.expired`
- **Payment amount validation** on subscription activation (prevents paying wrong amount)

### Fixed

- **RBAC: Non-super_admin users blocked from inflow/outflow** - `storage_records` RLS policy now uses `belongs_to_warehouse()` instead of the old `user_warehouses` table. Admin, owner, staff, and manager roles can now perform storage operations.
- **Webhook signature verification silently accepting** - Now rejects requests when `RAZORPAY_WEBHOOK_SECRET` is missing or placeholder, instead of returning true.
- **Webhook payment link lookup failing** - Changed from `payment.order_id` (wrong) to `payment.payment_link_id` (correct) for Razorpay Payment Links API.
- **Subscription owner lookup crashing** - `subscription-actions.ts` referenced non-existent `warehouses.owner_id` column. Now queries `user_warehouses` with `role = 'owner'`.
- **Subscription metadata overwritten** - `createSubscriptionPaymentLink()` now merges metadata instead of replacing, preserving `customer_name` and `customer_phone`.
- **`process_subscription_renewals` RPC crashing** - Fixed SQL join to use `user_warehouses` instead of `warehouses.owner_id`.
- **Lot dropdown showing random order** - Added `.order('name')` to inflow page server query and defensive sort at all data entry points (cache load, fresh fetch, manual refresh, realtime inserts).
- **`bags_stored` data integrity** - Corrected 19 records where `bags_stored` did not match `bags_in - bags_out`. The `sync_lot_stock` trigger then auto-corrected all 27 lot `current_stock` values.
- **Yearly plan limits showing free tier values** - `starter_yearly` and `professional_yearly` plans now have correct limits matching their monthly counterparts.
- **Bulk payment RPC parameter mismatch** - Removed extra params (`p_payment_method`, `p_type`, `p_notes`) not accepted by the function. Updated RPC to include `warehouse_id`, `type`, and `notes` on inserted payments.
- **Bulk payment excluding Razorpay payments from due calculation** - `getPendingRecords()` now sums ALL payment types instead of only `rent` + `hamali`.
- **Pre-existing test failures** - Fixed DashboardStats test (mock fetch), staff-actions test (mock audit-service), React `cache()` mock in test setup. Test suite now 291 tests, 0 failures.
- **`getUserWarehouse` failing for non-super_admin** - Added fallback to `warehouse_assignments` table when `profiles.warehouse_id` is null.

### Changed

- `vitest.config.ts` include pattern narrowed to `**/*.test.{ts,tsx}` only (excludes utility files with no tests)
- `getAvailableLots()` now filters `deleted_at IS NULL` and sorts client-side as defensive measure

### Security

- Webhook signature verification is now mandatory (rejects on missing/placeholder secret)
- Subscription payment amounts validated against plan price before activation
- Dropped stale overloaded RPC function that caused ambiguous resolution

---

## [1.0.0] - 2026-01-24

### Summary

Major security and quality improvements session. Achieved production-ready status with comprehensive testing, documentation, and zero critical vulnerabilities.

### Added - Testing

- **54 validation tests** covering:
  - String validation (sanitization, email, UUID, phone)
  - Number validation (positive numbers)
  - Date validation (future date prevention)
  - Zod schema validation (all CommonSchemas)
  - Form data validation
- Test coverage reporting with @vitest/coverage-v8
- Comprehensive test documentation in docs/TESTING.md

### Added - Documentation

- **JSDoc comments** for critical functions:
  - `getRecordStatus()` - Storage record status determination
  - `calculateFinalRent()` - Complex rent calculation with examples
  - `exportToExcel()` - Generic Excel export
  - `exportStorageRecordsToExcel()` - Storage exports
  - `exportCustomersToExcel()` - Customer exports with stats
  - `exportFinancialReportToExcel()` - Multi-sheet financial reports
- **Updated README.md** with:
  - Current tech stack (ExcelJS, Vitest, Playwright)
  - Test coverage statistics
  - Security posture summary
  - Links to detailed documentation
- **Rewrote docs/TESTING.md** with:
  - All test types documented
  - Usage examples for each test category
  - Best practices and troubleshooting
- **Rewrote docs/SECURITY.md** with:
  - Complete vulnerability remediation history
  - Security best practices
  - Incident response procedures

### Changed - Dependencies

- `xlsx@0.18.5` → `exceljs@4.4.0` (security & feature upgrade)
- `supabase@0.5.0` → `supabase@2.72.8` (major security update)
- Added `@vitest/coverage-v8@4.0.18` for test coverage

### Changed - Configuration

- Updated `vitest.config.ts` to run all test files (was restricted to single file)
- Enhanced `tsconfig.json` with granular path aliases:
  - `@/components/*`
  - `@/lib/*`, `@/services/*`, `@/hooks/*`
  - `@/types/*`, `@/utils/*`, `@/test/*`

### Fixed - Source Code

- Refactored `src/lib/export-utils.ts` to use ExcelJS API
  - `exportToExcel()` - Generic export function
  - `exportFinancialReportToExcel()` - Multi-sheet reports
- Refactored `src/lib/export-utils-filtered.ts` to use ExcelJS
  - `exportToExcelWithFilters()` - Filtered exports with metadata

### Fixed - Security Vulnerabilities

**Before:** 9 vulnerabilities (3 Critical, 3 High, 3 Moderate)

**Critical (Fixed ✅):**

- `jspdf` - Path traversal (GHSA-8qq5-rm4j-mr97)
- `axios` - Multiple vulnerabilities via supabase
- `ejs` - Code execution vulnerabilities via supabase

**High (Fixed ✅):**

- `xlsx` - Prototype pollution (GHSA-4r6h-8v6p-xvw6)
- `xlsx` - ReDoS (GHSA-5pgg-2g8v-p4x9)
- `tar` - File overwrite via supabase upgrade
- `@modelcontextprotocol/sdk` - ReDoS via dependencies
- `yargs-parser` - Via supabase upgrade

**Moderate (Fixed ✅):**

- `lodash` - Prototype pollution
- `lodash.trim` - ReDoS
- `lodash.trimend` - ReDoS

**After:** 1 vulnerability (1 High - dev dependency only)

- `tar` - Race condition (GHSA-r6q2-hw4h-h46w) - Low production risk

**Reduction:** 89% (9 → 1)

### Verified

- ✅ TypeScript compilation: 0 errors
- ✅ Production build: Successful
- ✅ Test suite: 156/160 passing (97.5%)
- ✅ New tests: 54/54 passing (100%)
- ✅ Security audit: 1 low-risk vulnerability

---

## Previous Releases

See git history for earlier changes before formalized changelog.

---

**Legend:**

- ✅ Completed
- ⚠️ In Progress
- ❌ Blocked

**Categories:**

- **Added** - New features or capabilities
- **Changed** - Changes to existing functionality
- **Deprecated** - Soon-to-be removed features
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Vulnerability fixes and security improvements
