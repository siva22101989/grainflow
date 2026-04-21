-- Standardize unloading_records + crops RLS to use belongs_to_warehouse()
-- so super_admin, primary profile warehouse, AND warehouse_assignments all work uniformly.
--
-- Previously:
--   unloading_records used `warehouse_id IN (SELECT profiles.warehouse_id ...)` directly,
--   bypassing super_admin and missing the warehouse_assignments fallback. If a user had
--   profile.warehouse_id NULL but a row in warehouse_assignments, they couldn't operate.
--
--   crops INSERT used the legacy `user_warehouses` table. New staff added via the
--   warehouse_assignments flow couldn't insert crops.

-- 1. unloading_records: replace three profile-only policies with belongs_to_warehouse
DROP POLICY IF EXISTS "Users can insert unloading records for their warehouse" ON public.unloading_records;
DROP POLICY IF EXISTS "Users can view unloading records for their warehouse" ON public.unloading_records;
DROP POLICY IF EXISTS "Users can update unloading records for their warehouse" ON public.unloading_records;

CREATE POLICY "Warehouse Isolation" ON public.unloading_records
  FOR ALL
  USING (belongs_to_warehouse(warehouse_id))
  WITH CHECK (belongs_to_warehouse(warehouse_id));

-- 2. crops: fix the INSERT policy that used the legacy user_warehouses table
DROP POLICY IF EXISTS "Users can insert crops" ON public.crops;

CREATE POLICY "Users can insert crops" ON public.crops
  FOR INSERT
  WITH CHECK (belongs_to_warehouse(warehouse_id));
