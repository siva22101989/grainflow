-- Fix: process_bulk_payment_atomic was inserting into payments.warehouse_id,
-- which does not exist (payments inherits warehouse via storage_record_id).
-- The "column does not exist" error was hidden by EXCEPTION WHEN OTHERS,
-- surfacing only as the generic "Bulk payment failed and was rolled back".
--
-- This migration:
--   1. Drops warehouse_id from the INSERT.
--   2. Adds a defensive check that every storage_record actually belongs to
--      the caller's p_warehouse_id (prevents cross-warehouse writes).
--   3. Includes SQLSTATE in the error response and RAISE WARNING so future
--      failures surface in Postgres logs.

CREATE OR REPLACE FUNCTION public.process_bulk_payment_atomic(
  p_customer_id uuid,
  p_payment_date date,
  p_warehouse_id uuid,
  p_allocations jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_payment_id UUID;
  v_allocation JSONB;
  v_record_id UUID;
  v_amount DECIMAL;
  v_total_inserted INTEGER := 0;
  v_record_warehouse UUID;
BEGIN
  FOR v_allocation IN SELECT * FROM jsonb_array_elements(p_allocations)
  LOOP
    v_record_id := (v_allocation->>'recordId')::UUID;
    v_amount := (v_allocation->>'amount')::DECIMAL;

    IF v_amount <= 0 THEN
      CONTINUE;
    END IF;

    SELECT warehouse_id INTO v_record_warehouse
      FROM public.storage_records
     WHERE id = v_record_id AND deleted_at IS NULL;

    IF v_record_warehouse IS NULL THEN
      RAISE EXCEPTION 'Storage record % not found or deleted', v_record_id;
    END IF;

    IF v_record_warehouse <> p_warehouse_id THEN
      RAISE EXCEPTION 'Storage record % does not belong to warehouse %', v_record_id, p_warehouse_id;
    END IF;

    INSERT INTO payments (
      storage_record_id,
      amount,
      payment_date,
      type,
      payment_method,
      notes,
      created_at
    ) VALUES (
      v_record_id,
      v_amount,
      p_payment_date,
      'rent',
      'cash',
      'Bulk payment allocation',
      NOW()
    ) RETURNING id INTO v_payment_id;

    v_total_inserted := v_total_inserted + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'payments_created', v_total_inserted,
    'message', 'Bulk payment processed successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'process_bulk_payment_atomic failed: % (SQLSTATE %)', SQLERRM, SQLSTATE;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'sqlstate', SQLSTATE,
    'message', 'Bulk payment failed and was rolled back'
  );
END;
$function$;
