-- SMS activity log. The application already writes to this table from four
-- spots (inflow welcome, outflow confirmation, drying confirmation, payment
-- reminder), but the table was never created — all those writes were
-- silently erroring with "relation does not exist".

CREATE TABLE IF NOT EXISTS public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  record_id uuid REFERENCES public.storage_records(id) ON DELETE SET NULL,
  phone text NOT NULL,
  message_type text NOT NULL,
  message_id text,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending', 'delivered')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_logs_warehouse_created
  ON public.sms_logs (warehouse_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sms_logs_customer
  ON public.sms_logs (customer_id) WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sms_logs_record
  ON public.sms_logs (record_id) WHERE record_id IS NOT NULL;

-- Backfill warehouse_id from customer on insert if not provided
CREATE OR REPLACE FUNCTION public.sms_logs_fill_warehouse_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.warehouse_id IS NULL AND NEW.customer_id IS NOT NULL THEN
    SELECT warehouse_id INTO NEW.warehouse_id
    FROM public.customers
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sms_logs_fill_warehouse_id ON public.sms_logs;
CREATE TRIGGER trg_sms_logs_fill_warehouse_id
  BEFORE INSERT ON public.sms_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.sms_logs_fill_warehouse_id();

-- RLS
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Warehouse Isolation" ON public.sms_logs
  FOR ALL
  USING (warehouse_id IS NULL OR belongs_to_warehouse(warehouse_id))
  WITH CHECK (warehouse_id IS NULL OR belongs_to_warehouse(warehouse_id));

COMMENT ON TABLE public.sms_logs IS
  'Log of every SMS sent through the app. warehouse_id auto-fills from customer_id if omitted.';
