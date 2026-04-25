-- Auto-normalize customer.phone on every INSERT/UPDATE so it's always
-- stored as exactly 10 digits.
--
-- Strips +91 prefix, strips all non-digits, takes last 10 digits.
-- Examples that all become "9618615207":
--   "09618615207"     (leading zero, Indian dialing convention)
--   "+919618615207"   (with country code)
--   "919618615207"    (country code without +)
--   "+91 96186 15207" (with spaces)
--   "9618615207"      (already clean)
--
-- If after normalization the phone isn't exactly 10 digits starting with
-- 6/7/8/9, it's left as-is so caller-side Zod validation can catch it.
-- We don't want to silently drop a clearly-invalid value.

CREATE OR REPLACE FUNCTION public.normalize_customer_phone()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_digits text;
  v_last10 text;
BEGIN
  IF NEW.phone IS NULL OR NEW.phone = '' THEN
    RETURN NEW;
  END IF;
  v_digits := REGEXP_REPLACE(NEW.phone, '[^0-9]', '', 'g');
  v_last10 := RIGHT(v_digits, 10);
  IF LENGTH(v_last10) = 10 AND v_last10 ~ '^[6-9][0-9]{9}$' THEN
    NEW.phone := v_last10;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_customer_phone ON public.customers;
CREATE TRIGGER trg_normalize_customer_phone
  BEFORE INSERT OR UPDATE OF phone ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_customer_phone();

COMMENT ON FUNCTION public.normalize_customer_phone() IS
  'Stores customer phone as 10-digit Indian mobile, stripping +91 and leading 0.';
