-- Add flexible pricing slabs to crops table
-- Supports two billing modes: 'minimum_monthly' and 'slabs'
-- Falls back to rent_price_6m/rent_price_1y when null

ALTER TABLE public.crops
ADD COLUMN IF NOT EXISTS pricing_slabs jsonb DEFAULT NULL;

COMMENT ON COLUMN public.crops.pricing_slabs IS
  'Flexible billing config. Modes: minimum_monthly or slabs. Falls back to rent_price_6m/rent_price_1y when null.';
