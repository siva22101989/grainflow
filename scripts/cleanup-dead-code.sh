#!/usr/bin/env bash
#
# Removes dead code verified unreferenced on 2026-09-24.
#
# Verification method: every import specifier in src/, tests/, scripts/ and
# supabase/ was resolved to a repo path (handling both the "@/" alias and
# relative paths, including directory/index imports), then each candidate was
# checked for inbound edges. Only files with zero inbound edges are listed here.
#
# Two knip findings were deliberately NOT included:
#   - src/test/** and src/mocks/**        test scaffolding, kept on purpose
#   - src/scripts/create-admin.ts,        ops entry points invoked outside the
#     src/ai/dev.ts                       import graph
#
# Everything here is tracked by git, so `git checkout -- .` undoes it.
#
# Usage:  bash scripts/cleanup-dead-code.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Removing dead components"
git rm -q \
  "src/components/dashboard/edit-storage-dialog.tsx" \
  "src/components/dashboard/storage-table.tsx" \
  "src/components/error-boundary.tsx" \
  "src/components/expenses/delete-expense-button.tsx" \
  "src/components/inflow/plot-inventory.tsx" \
  "src/components/outflow/delete-outflow-button.tsx" \
  "src/components/payments/record-payment-dialog.tsx" \
  "src/components/reports/report-client.tsx" \
  "src/components/shared/paid-feature.tsx" \
  "src/components/storage/page.tsx" \
  "src/components/storage/record-qr-code.tsx" \
  "src/components/theme-provider.tsx" \
  "src/components/warehouses/manage-access-dialog.tsx"

echo "==> Removing unused shadcn/ui primitives"
# Each of these is the sole consumer of a runtime dependency (removed below).
git rm -q \
  "src/components/ui/carousel.tsx" \
  "src/components/ui/chart.tsx" \
  "src/components/ui/collapsible.tsx" \
  "src/components/ui/confirm-dialog.tsx" \
  "src/components/ui/form.tsx" \
  "src/components/ui/menubar.tsx" \
  "src/components/ui/sidebar.tsx" \
  "src/components/ui/slider.tsx"

echo "==> Removing dead hooks and lib modules"
# use-mobile is reachable only from ui/sidebar.tsx, which dies above.
# notification-service is reachable only from smart-alerts.ts, likewise.
git rm -q \
  "src/hooks/use-customers-query.ts" \
  "src/hooks/use-dashboard-query.ts" \
  "src/hooks/use-mobile.tsx" \
  "src/lib/fonts.ts" \
  "src/lib/placeholder-images.ts" \
  "src/lib/validation-utils.ts" \
  "src/lib/types/cache-config.ts" \
  "src/lib/services/smart-alerts.ts" \
  "src/lib/services/notification-service.ts" \
  "src/app/(dashboard)/market-prices/client.ts"

echo "==> Removing dead 'use server' actions"
# seed-actions.ts exports resetAndSeedDatabase(), which hard-DELETEs every row
# from notifications, payments, storage_records, expenses, customers,
# warehouse_lots and crops -- bypassing the project's soft-delete convention.
# It is unreferenced; deleting it removes the hazard outright.
git rm -q \
  "src/lib/seed-actions.ts" \
  "src/lib/test-actions.ts"

echo "==> Removing dependencies whose only consumer was deleted above"
# NOTE: Capacitor plugins (@capacitor/preferences, push-notifications,
# splash-screen, status-bar) also show as unimported, but they are registered
# by the native Android project rather than by JS imports. Do NOT remove them
# without checking android/app/src/main/java/**/MainActivity.java first.
npm uninstall \
  embla-carousel-react \
  @radix-ui/react-collapsible \
  @radix-ui/react-menubar \
  @radix-ui/react-slider \
  react-hook-form \
  @hookform/resolvers

echo
echo "==> Verifying"
rm -rf .next/dev          # stale generated types produce phantom tsc errors
npx tsc --noEmit
npm test -- --run
npx next build

echo
echo "Done. Review with: git status && git diff --cached --stat"
