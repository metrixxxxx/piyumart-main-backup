-- Apply after add_marketplace_payments.sql, before deploying the tiered checkout.
-- Existing orders/allocations/commission records and wallet balances are retained.
BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS bao_commission_amount numeric(14,2)
    CHECK (bao_commission_amount >= 0 AND bao_commission_amount <= total);
COMMENT ON COLUMN public.orders.bao_commission_amount IS
  'Checkout snapshot: sum of item-line commissions using unit-price tiers. NULL identifies legacy orders.';

-- A tiered order can have zero commission or an effective rate across mixed items.
-- It does not reference a legacy, single-percentage schedule entry.
ALTER TABLE public.order_commissions ALTER COLUMN commission_rate_id DROP NOT NULL;
ALTER TABLE public.order_commissions
  DROP CONSTRAINT IF EXISTS order_commissions_commission_rate_check;
ALTER TABLE public.order_commissions
  ADD CONSTRAINT order_commissions_commission_rate_check
    CHECK (commission_rate >= 0 AND commission_rate <= 100);

-- Replace the original fixed-3% constraint; allocation/refund total checks remain.
ALTER TABLE public.payment_allocations DROP CONSTRAINT IF EXISTS payment_allocations_check5;
ALTER TABLE public.payment_allocations DROP CONSTRAINT IF EXISTS payment_allocations_commission_limit;
ALTER TABLE public.payment_allocations ADD CONSTRAINT payment_allocations_commission_limit
  CHECK (commission_amount <= gross_amount);

-- Retain database enforcement of the checkout split, including mixed baskets.
CREATE OR REPLACE FUNCTION public.validate_bao_allocation_quote()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE expected_total numeric; expected_commission numeric;
BEGIN
  SELECT total, COALESCE(bao_commission_amount, ROUND(total * 0.03, 2))
    INTO expected_total, expected_commission FROM public.orders WHERE id = NEW.order_id;
  IF NEW.gross_amount IS DISTINCT FROM expected_total
     OR NEW.commission_amount IS DISTINCT FROM expected_commission THEN
    RAISE EXCEPTION 'Payment allocation must match the order commission quote'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_bao_allocation_quote ON public.payment_allocations;
CREATE TRIGGER trg_bao_allocation_quote
  BEFORE INSERT OR UPDATE OF order_id, gross_amount, commission_amount
  ON public.payment_allocations FOR EACH ROW
  EXECUTE FUNCTION public.validate_bao_allocation_quote();

COMMIT;
