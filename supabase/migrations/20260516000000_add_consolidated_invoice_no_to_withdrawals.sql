-- Bulk outflow generates ONE invoice number for the entire batch and stamps it
-- on every withdrawal_transactions row in that batch. The consolidated bill
-- (and statement grouping) keys off this column. Withdrawals from single
-- outflows leave it NULL.
--
-- Note: storage_records.outflow_invoice_no still exists for legacy single
-- outflow tracking; consolidated_invoice_no on the withdrawal is the new
-- source of truth for batch bills.
ALTER TABLE public.withdrawal_transactions
  ADD COLUMN IF NOT EXISTS consolidated_invoice_no TEXT;

CREATE INDEX IF NOT EXISTS idx_withdrawals_consolidated_invoice_no
  ON public.withdrawal_transactions (consolidated_invoice_no)
  WHERE consolidated_invoice_no IS NOT NULL;

COMMENT ON COLUMN public.withdrawal_transactions.consolidated_invoice_no IS
  'Shared invoice number across all withdrawals in a single bulk-outflow batch. NULL for single (non-batch) outflows.';
