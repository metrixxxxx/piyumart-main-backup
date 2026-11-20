BEGIN;

ALTER TABLE public.payment_refunds
  ADD COLUMN IF NOT EXISTS order_id integer REFERENCES public.orders(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS payment_refunds_active_order
  ON public.payment_refunds(order_id)
  WHERE order_id IS NOT NULL AND status IN ('requesting', 'pending', 'succeeded');

COMMIT;
