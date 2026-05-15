-- Guard against accidentally orphaning a warehouse by removing or demoting
-- its only owner. Subscription billing, SMS-to-owner, and other flows all
-- require exactly one identifiable owner per active warehouse.
--
-- Backfill: Nikhil WareHouse and Test WareHouse were orphaned because their
-- user_warehouses rows said role='admin' / 'super_admin' even though their
-- profiles or platform context said otherwise. Those were fixed manually
-- before this trigger was added; the trigger ensures it can't happen again.
--
-- Fires on BEFORE UPDATE/DELETE of user_warehouses. If the row being
-- touched is the LAST role='owner' row for a non-deleted warehouse, the
-- operation is blocked unless the warehouse itself is being soft-deleted
-- (cleanup path).

CREATE OR REPLACE FUNCTION public.prevent_last_owner_removal()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_owner_count integer;
  v_warehouse_deleted boolean;
BEGIN
  -- Only enforce when the row being removed/demoted IS an owner row
  IF (TG_OP = 'DELETE' AND OLD.role = 'owner')
     OR (TG_OP = 'UPDATE' AND OLD.role = 'owner' AND (NEW.role IS DISTINCT FROM 'owner'))
  THEN
    -- Skip the check if the warehouse itself is being / has been deleted
    SELECT (deleted_at IS NOT NULL) INTO v_warehouse_deleted
    FROM warehouses WHERE id = OLD.warehouse_id;

    IF v_warehouse_deleted THEN
      RETURN COALESCE(NEW, OLD);
    END IF;

    -- Count remaining owners AFTER this operation
    SELECT count(*) INTO v_owner_count
    FROM user_warehouses
    WHERE warehouse_id = OLD.warehouse_id
      AND role = 'owner'
      AND id <> OLD.id;

    IF v_owner_count = 0 THEN
      RAISE EXCEPTION
        'Cannot remove or demote the last owner of warehouse %. Promote another user to owner first.',
        OLD.warehouse_id
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS user_warehouses_protect_last_owner ON public.user_warehouses;
CREATE TRIGGER user_warehouses_protect_last_owner
  BEFORE UPDATE OR DELETE ON public.user_warehouses
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_last_owner_removal();

COMMENT ON TRIGGER user_warehouses_protect_last_owner ON public.user_warehouses IS
  'Blocks any UPDATE/DELETE that would leave an active warehouse with zero owners. Soft-deleted warehouses are exempt.';
