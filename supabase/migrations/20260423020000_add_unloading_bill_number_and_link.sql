-- Add a human-friendly bill number to unloading_records (per-warehouse sequence)
-- and persist the link from storage_records → unloading_records so we can
-- retrieve the full inflow journey (unloading → plot → storage) for SMS and reports.

-- 1. Sequential bill number per warehouse on unloading_records
ALTER TABLE public.unloading_records
  ADD COLUMN IF NOT EXISTS record_number integer;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY warehouse_id ORDER BY created_at) AS rn
  FROM public.unloading_records
)
UPDATE public.unloading_records u
SET record_number = numbered.rn
FROM numbered
WHERE u.id = numbered.id AND u.record_number IS NULL;

CREATE OR REPLACE FUNCTION public.unloading_records_assign_record_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.record_number IS NULL THEN
    SELECT COALESCE(MAX(record_number), 0) + 1
    INTO NEW.record_number
    FROM public.unloading_records
    WHERE warehouse_id = NEW.warehouse_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_unloading_records_assign_record_number ON public.unloading_records;
CREATE TRIGGER trg_unloading_records_assign_record_number
  BEFORE INSERT ON public.unloading_records
  FOR EACH ROW
  EXECUTE FUNCTION public.unloading_records_assign_record_number();

-- 2. Persist the link on storage_records
ALTER TABLE public.storage_records
  ADD COLUMN IF NOT EXISTS unloading_record_id uuid
    REFERENCES public.unloading_records(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_storage_records_unloading_record_id
  ON public.storage_records (unloading_record_id)
  WHERE unloading_record_id IS NOT NULL;

COMMENT ON COLUMN public.unloading_records.record_number IS
  'Per-warehouse sequential bill number shown to customers (e.g., "Bill #3").';
COMMENT ON COLUMN public.storage_records.unloading_record_id IS
  'Link to the unloading record this inflow originated from (for Plot inflows).';
