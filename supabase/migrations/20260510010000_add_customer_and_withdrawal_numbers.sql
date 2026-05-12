-- Add per-warehouse sequential numeric IDs to customers and withdrawal_transactions
-- so Excel exports (and any human-facing surface) can show short integer IDs
-- like "1", "2", ... instead of UUID fragments.
--
-- Numbering strategy: per-warehouse, monotonically increasing, never reused,
-- assigned by BEFORE INSERT trigger as COALESCE(MAX(...), 0) + 1.
-- Existing rows are backfilled with ROW_NUMBER() ordered by created_at.

-- ============================================================
-- 1. customers.customer_number
-- ============================================================

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS customer_number integer;

-- Backfill existing rows per warehouse, ordered by created_at
WITH numbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY warehouse_id ORDER BY created_at, id) AS rn
  FROM public.customers
  WHERE customer_number IS NULL
)
UPDATE public.customers c
SET customer_number = n.rn
FROM numbered n
WHERE c.id = n.id;

CREATE INDEX IF NOT EXISTS idx_customers_warehouse_customer_number
  ON public.customers (warehouse_id, customer_number);

CREATE OR REPLACE FUNCTION public.assign_customer_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
  IF NEW.customer_number IS NULL THEN
    SELECT COALESCE(MAX(customer_number), 0) + 1
    INTO NEW.customer_number
    FROM public.customers
    WHERE warehouse_id = NEW.warehouse_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customers_assign_customer_number ON public.customers;
CREATE TRIGGER customers_assign_customer_number
  BEFORE INSERT ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_customer_number();

-- ============================================================
-- 2. withdrawal_transactions.withdrawal_number
-- ============================================================

ALTER TABLE public.withdrawal_transactions
  ADD COLUMN IF NOT EXISTS withdrawal_number integer;

WITH numbered AS (
  SELECT
    wt.id,
    ROW_NUMBER() OVER (
      PARTITION BY sr.warehouse_id
      ORDER BY wt.created_at, wt.id
    ) AS rn
  FROM public.withdrawal_transactions wt
  JOIN public.storage_records sr ON sr.id = wt.storage_record_id
  WHERE wt.withdrawal_number IS NULL
)
UPDATE public.withdrawal_transactions wt
SET withdrawal_number = n.rn
FROM numbered n
WHERE wt.id = n.id;

CREATE INDEX IF NOT EXISTS idx_withdrawals_warehouse_withdrawal_number
  ON public.withdrawal_transactions (withdrawal_number);

CREATE OR REPLACE FUNCTION public.assign_withdrawal_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_warehouse_id uuid;
BEGIN
  IF NEW.withdrawal_number IS NULL THEN
    SELECT warehouse_id INTO v_warehouse_id
    FROM public.storage_records
    WHERE id = NEW.storage_record_id;

    SELECT COALESCE(MAX(wt.withdrawal_number), 0) + 1
    INTO NEW.withdrawal_number
    FROM public.withdrawal_transactions wt
    JOIN public.storage_records sr ON sr.id = wt.storage_record_id
    WHERE sr.warehouse_id = v_warehouse_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS withdrawals_assign_withdrawal_number ON public.withdrawal_transactions;
CREATE TRIGGER withdrawals_assign_withdrawal_number
  BEFORE INSERT ON public.withdrawal_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_withdrawal_number();
