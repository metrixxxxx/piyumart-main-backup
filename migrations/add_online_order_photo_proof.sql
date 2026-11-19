-- Apply after add_cash_pickup_proof.sql. Both payment methods now require proof.
-- Existing completed orders and financial records are retained.
BEGIN;
COMMENT ON COLUMN public.orders.pickup_proof_path IS
  'Private pickup-proofs object key, submitted by the buyer when confirming receipt of cash or online orders.';
CREATE OR REPLACE FUNCTION public.require_cash_pickup_proof()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' AND OLD.pickup_proof_path IS NOT NULL
    AND (NEW.pickup_proof_path IS DISTINCT FROM OLD.pickup_proof_path
      OR NEW.pickup_proof_uploaded_at IS DISTINCT FROM OLD.pickup_proof_uploaded_at) THEN
    RAISE EXCEPTION 'Completed order photo proof cannot be changed' USING ERRCODE = '23514';
  END IF;
  IF NEW.status = 'completed'
    AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed')
    AND (NULLIF(BTRIM(NEW.pickup_proof_path), '') IS NULL OR NEW.pickup_proof_uploaded_at IS NULL) THEN
    RAISE EXCEPTION 'Photo proof is required before completing an order' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
COMMIT;
