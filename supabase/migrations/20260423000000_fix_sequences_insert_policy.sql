-- sequences table had SELECT/UPDATE policies for warehouse members but INSERT
-- only for super_admin. First-time invoice generation for a warehouse (creating
-- a new sequence row for e.g. 'inflow') therefore failed for owners with:
--   "new row violates row-level security policy for table sequences"
--
-- Fix: allow warehouse members (super_admin via belongs_to_warehouse() bypass,
-- owners via profile.warehouse_id, staff via warehouse_assignments) to INSERT
-- sequence rows for their own warehouse.

CREATE POLICY "Users can insert sequences for their warehouse" ON public.sequences
  FOR INSERT
  WITH CHECK (belongs_to_warehouse(warehouse_id));
