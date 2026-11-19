-- Cash-on-pickup completion now requires a buyer-uploaded photo.
-- Existing completed transactions remain unchanged.
BEGIN;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pickup_proof_path text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pickup_proof_uploaded_at timestamptz;
COMMENT ON COLUMN public.orders.pickup_proof_path IS
  'Private pickup-proofs object key, submitted by the buyer on cash-on-pickup completion.';

CREATE OR REPLACE FUNCTION public.require_cash_pickup_proof()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' AND OLD.pickup_proof_path IS NOT NULL
    AND (NEW.pickup_proof_path IS DISTINCT FROM OLD.pickup_proof_path
      OR NEW.pickup_proof_uploaded_at IS DISTINCT FROM OLD.pickup_proof_uploaded_at) THEN
    RAISE EXCEPTION 'Completed pickup photo proof cannot be changed' USING ERRCODE = '23514';
  END IF;
  IF COALESCE(NEW.payment_method, 'cod') <> 'paymongo' AND NEW.status = 'completed'
    AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed')
    AND (NULLIF(BTRIM(NEW.pickup_proof_path), '') IS NULL OR NEW.pickup_proof_uploaded_at IS NULL) THEN
    RAISE EXCEPTION 'A pickup photo is required before completing a cash-on-pickup order'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_require_cash_pickup_proof ON public.orders;
CREATE TRIGGER trg_require_cash_pickup_proof BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.require_cash_pickup_proof();
COMMIT;
