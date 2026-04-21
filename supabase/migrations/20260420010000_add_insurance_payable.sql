-- Track insurance amount billed on each storage record
-- Computed at inflow time as: crop.insurance_per_bag * inflowBags
-- Paid via payments with type='insurance' (or 'other' for auto-allocation)

ALTER TABLE public.storage_records
ADD COLUMN IF NOT EXISTS insurance_payable numeric(12, 2) NOT NULL DEFAULT 0
  CHECK (insurance_payable >= 0);

COMMENT ON COLUMN public.storage_records.insurance_payable IS
  'Insurance amount billed at inflow. Computed as crop.insurance_per_bag * bags.';
