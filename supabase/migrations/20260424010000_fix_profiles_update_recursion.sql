-- "Manager Update Team Members" policy on profiles had two inline subqueries
-- against profiles itself:
--   warehouse_id IN (SELECT warehouse_id FROM profiles WHERE id = auth.uid())
--   EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = ANY(...))
--
-- When Postgres evaluates an UPDATE on profiles (e.g., the warehouse switcher
-- updating profiles.warehouse_id), it re-runs the policy, which re-runs the
-- subquery on profiles, which re-triggers the policy → infinite recursion.
-- Symptom: "infinite recursion detected in policy for relation 'profiles'".
--
-- Fix: use SECURITY DEFINER helpers (is_admin(), is_super_admin(),
-- get_user_warehouse_id()) which bypass RLS internally. These were already
-- created and are used safely by the other policies on this table.

DROP POLICY IF EXISTS "Manager Update Team Members" ON public.profiles;

CREATE POLICY "Manager Update Team Members" ON public.profiles
  FOR UPDATE
  USING (
    -- Super admin can update anyone
    is_super_admin()
    OR
    -- Owner / admin / manager can update profiles in their warehouse
    (
      is_admin()
      AND warehouse_id IS NOT NULL
      AND warehouse_id = get_user_warehouse_id()
    )
  )
  WITH CHECK (
    is_super_admin()
    OR
    (
      is_admin()
      AND warehouse_id IS NOT NULL
      AND warehouse_id = get_user_warehouse_id()
    )
  );
