-- Credit completed cash-on-pickup commissions to the BAO wallet.
-- Run after add_bao_commission_cashouts.sql in Supabase SQL Editor.
BEGIN;

SELECT pg_advisory_xact_lock(817206, 71);

INSERT INTO public.wallets(owner_id, kind)
VALUES (NULL, 'bao')
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  bao_wallet_id uuid;
  debt_balance numeric(14,2);
  commission_record record;
  repayment_amount numeric(14,2);
  available_amount numeric(14,2);
  transaction_id uuid;
  transaction_key text;
BEGIN
  SELECT id INTO bao_wallet_id
  FROM public.wallets
  WHERE kind = 'bao' AND owner_id IS NULL
  FOR UPDATE;

  SELECT COALESCE(SUM(amount), 0)
  INTO debt_balance
  FROM public.wallet_transactions
  WHERE wallet_id = bao_wallet_id AND bucket = 'debt';

  FOR commission_record IN
    SELECT oc.order_id, oc.commission_amount, COALESCE(o.completed_at, oc.created_at) AS earned_at
    FROM public.order_commissions oc
    JOIN public.orders o ON o.id = oc.order_id
    WHERE o.status = 'completed'
      AND COALESCE(o.payment_method, 'cod') <> 'paymongo'
      AND oc.commission_amount > 0
    ORDER BY earned_at, oc.order_id
  LOOP
    transaction_key := 'cod-commission:' || commission_record.order_id::text;

    IF EXISTS (
      SELECT 1
      FROM public.wallet_transactions
      WHERE wallet_id = bao_wallet_id
        AND idempotency_key LIKE transaction_key || ':%'
    ) THEN
      CONTINUE;
    END IF;

    repayment_amount := LEAST(debt_balance, commission_record.commission_amount);
    available_amount := commission_record.commission_amount - repayment_amount;

    IF repayment_amount > 0 THEN
      transaction_id := NULL;
      INSERT INTO public.wallet_transactions
        (wallet_id, bucket, amount, kind, order_id, idempotency_key)
      VALUES
        (bao_wallet_id, 'debt', -repayment_amount, 'debt_repayment',
         commission_record.order_id, transaction_key || ':debt')
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id INTO transaction_id;

      IF transaction_id IS NOT NULL THEN
        debt_balance := debt_balance - repayment_amount;
      END IF;
    END IF;

    IF available_amount > 0 THEN
      INSERT INTO public.wallet_transactions
        (wallet_id, bucket, amount, kind, order_id, idempotency_key)
      VALUES
        (bao_wallet_id, 'available', available_amount, 'cod_commission',
         commission_record.order_id, transaction_key || ':available')
      ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

COMMIT;
