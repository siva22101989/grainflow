-- Add per-crop insurance premium (per bag rate charged at inflow)
-- Example: insurance_per_bag = 2.50 → customer pays ₹2.50/bag as insurance premium

ALTER TABLE public.crops
ADD COLUMN IF NOT EXISTS insurance_per_bag numeric(12, 2) NOT NULL DEFAULT 0
  CHECK (insurance_per_bag >= 0);

COMMENT ON COLUMN public.crops.insurance_per_bag IS
  'Per-bag insurance premium charged at inflow. Default 0 (no insurance).';
