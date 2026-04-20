-- Add plot-related columns to unloading_records table
-- These columns are referenced by src/lib/unloading-actions.ts (recordUnloading, movePlotToStorage)
-- but were missing from the schema, causing:
--   "Could not find the 'bags_remaining_in_plot' column of 'unloading_records' in the schema cache"

ALTER TABLE public.unloading_records
ADD COLUMN IF NOT EXISTS destination text DEFAULT 'storage' CHECK (destination IN ('storage', 'plot'));

ALTER TABLE public.unloading_records
ADD COLUMN IF NOT EXISTS plot_location text DEFAULT NULL;

ALTER TABLE public.unloading_records
ADD COLUMN IF NOT EXISTS bags_remaining_in_plot integer DEFAULT 0 CHECK (bags_remaining_in_plot >= 0);

-- Index for plot location lookup
CREATE INDEX IF NOT EXISTS idx_unloading_records_plot_location
ON public.unloading_records (warehouse_id, plot_location)
WHERE plot_location IS NOT NULL;

COMMENT ON COLUMN public.unloading_records.destination IS
  'Where the bags were sent after unloading: "storage" (goes into storage_records) or "plot" (temporary plot holding).';
COMMENT ON COLUMN public.unloading_records.plot_location IS
  'Plot location name when destination = plot.';
COMMENT ON COLUMN public.unloading_records.bags_remaining_in_plot IS
  'Bags still sitting in plot (not yet moved to storage). Decreases as bags are moved via movePlotToStorage.';
