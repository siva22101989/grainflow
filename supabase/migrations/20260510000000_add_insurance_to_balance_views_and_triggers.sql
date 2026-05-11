-- V2 of the insurance feature added storage_records.insurance_payable but
-- several pre-existing balance computations (matview, trigger) were not
-- updated. Result: customers with insurance-only dues were invisible to
-- customer-list balance badges, pending-payment lists, outflow-trigger
-- notifications, and bulk-payment FIFO allocation.
--
-- This migration fixes:
--   1. public.customer_balances_mat — matview definition now includes
--      insurance_payable in total_billed (and therefore balance).
--   2. public.notify_pending_dues() — outflow trigger now includes
--      insurance in the dues check.

-- ============================================================
-- 1. Drop and recreate the customer_balances_mat materialized view
--    with insurance_payable included.
-- ============================================================

DROP MATERIALIZED VIEW IF EXISTS public.customer_balances_mat CASCADE;

CREATE MATERIALIZED VIEW public.customer_balances_mat AS
SELECT
  c.id AS customer_id,
  c.warehouse_id,
  c.name AS customer_name,
  c.phone,
  c.email,
  c.village,
  (
    COALESCE(SUM(sr.hamali_payable), 0::numeric) +
    COALESCE(SUM(sr.total_rent_billed), 0::numeric) +
    COALESCE(SUM(sr.insurance_payable), 0::numeric)
  ) AS total_billed,
  COALESCE((
    SELECT SUM(p.amount)
    FROM payments p
    JOIN storage_records sr2 ON p.storage_record_id = sr2.id
    WHERE sr2.customer_id = c.id
      AND sr2.deleted_at IS NULL
      AND p.deleted_at IS NULL
  ), 0::numeric) AS total_paid,
  (
    (
      COALESCE(SUM(sr.hamali_payable), 0::numeric) +
      COALESCE(SUM(sr.total_rent_billed), 0::numeric) +
      COALESCE(SUM(sr.insurance_payable), 0::numeric)
    )
    -
    COALESCE((
      SELECT SUM(p.amount)
      FROM payments p
      JOIN storage_records sr2 ON p.storage_record_id = sr2.id
      WHERE sr2.customer_id = c.id
        AND sr2.deleted_at IS NULL
        AND p.deleted_at IS NULL
    ), 0::numeric)
  ) AS balance,
  COUNT(CASE WHEN sr.storage_end_date IS NULL AND sr.id IS NOT NULL THEN 1 END) AS active_records_count,
  MAX(sr.storage_start_date) AS last_transaction_date
FROM customers c
LEFT JOIN storage_records sr ON c.id = sr.customer_id AND sr.deleted_at IS NULL
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.warehouse_id, c.name, c.phone, c.email, c.village;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_balances_mat_customer_id
  ON public.customer_balances_mat (customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_balances_mat_warehouse_balance
  ON public.customer_balances_mat (warehouse_id, balance);

CREATE OR REPLACE VIEW public.customer_balances AS
SELECT * FROM public.customer_balances_mat;

REFRESH MATERIALIZED VIEW public.customer_balances_mat;

-- ============================================================
-- 2. Update notify_pending_dues() trigger to include insurance
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_pending_dues()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_customer_name text;
    v_total_billed numeric;
    v_total_paid numeric;
    v_balance numeric;
BEGIN
    IF NEW.storage_end_date IS NOT NULL AND OLD.storage_end_date IS NULL THEN

        SELECT c.name INTO v_customer_name
        FROM customers c WHERE c.id = NEW.customer_id;

        v_total_billed :=
            COALESCE(NEW.total_rent_billed, 0) +
            COALESCE(NEW.hamali_payable, 0) +
            COALESCE(NEW.insurance_payable, 0);

        SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
        FROM payments
        WHERE storage_record_id = NEW.id AND deleted_at IS NULL;

        v_balance := v_total_billed - v_total_paid;

        IF v_balance > 100 THEN
            PERFORM create_notification(
                NEW.warehouse_id,
                NULL,
                'Pending Payment',
                format('%s has pending dues of ₹%s (Record: %s)',
                       v_customer_name,
                       ROUND(v_balance),
                       NEW.record_number),
                'warning',
                format('/customers?search=%s', NEW.record_number)
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;
