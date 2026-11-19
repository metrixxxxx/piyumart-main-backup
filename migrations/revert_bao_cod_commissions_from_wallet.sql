-- Keep COD commission in reports, but remove it from the BAO cashout wallet.
-- Reverses add_bao_cod_commissions_to_wallet.sql without deleting ledger history.
-- Untransferred BAO cashouts unsupported by online funds are cancelled first.
BEGIN;

SELECT pg_advisory_xact_lock(817206, 71);

DO $$
DECLARE
  bao_wallet_id uuid;
  actor_id integer;
  actor_role text;
  actor_status text;
  non_cod_liquid numeric(14,2);
  active_cashout_total numeric(14,2);
  request record;
  debt_balance numeric(14,2);
  repayment_amount numeric(14,2);
  available_amount numeric(14,2);
  cod_available_total numeric(14,2);
  wallet_available numeric(14,2);
  cod_entry record;
  transaction_id uuid;
  transaction_key text;
  cancel_reason text := 'COD commissions are not eligible for cashout.';
BEGIN
  SELECT id INTO bao_wallet_id
  FROM public.wallets
  WHERE kind = 'bao' AND owner_id IS NULL
  FOR UPDATE;

  IF bao_wallet_id IS NULL THEN
    RAISE EXCEPTION 'BAO commission wallet was not found.';
  END IF;

  SELECT COALESCE(SUM(wt.amount) FILTER (WHERE wt.bucket IN ('available', 'reserved')), 0)
  INTO non_cod_liquid
  FROM public.wallet_transactions wt
  WHERE wt.wallet_id = bao_wallet_id
    AND wt.idempotency_key NOT LIKE 'cod-commission:%';

  SELECT COALESCE(SUM(c.amount), 0)
  INTO active_cashout_total
  FROM public.cashout_requests c
  WHERE c.wallet_id = bao_wallet_id AND c.status IN ('pending', 'approved');

  WHILE active_cashout_total > non_cod_liquid LOOP
    SELECT c.*
    INTO request
    FROM public.cashout_requests c
    WHERE c.wallet_id = bao_wallet_id
      AND c.status IN ('pending', 'approved')
      AND NOT EXISTS (SELECT 1 FROM public.payouts p WHERE p.cashout_id = c.id)
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT 1
    FOR UPDATE;

    IF request.id IS NULL THEN
      RAISE EXCEPTION 'An in-progress BAO transfer must be reviewed before COD commission can be removed.';
    END IF;

    SELECT role, status INTO actor_role, actor_status
    FROM public.users
    WHERE id = request.requested_by
    FOR SHARE;

    IF COALESCE(actor_status, '') <> 'active' OR COALESCE(actor_role, '') NOT IN ('bao', 'admin') THEN
      RAISE EXCEPTION 'The BAO cashout requester is not an active staff account.';
    END IF;
    actor_id := request.requested_by;

    INSERT INTO public.wallet_transactions
      (wallet_id, bucket, amount, kind, idempotency_key, cashout_id)
    VALUES
      (bao_wallet_id, 'reserved', -request.amount, 'cashout_released',
       'reject:' || request.id::text || ':reserved', request.id)
    ON CONFLICT (idempotency_key) DO NOTHING;

    SELECT COALESCE(SUM(amount), 0)
    INTO debt_balance
    FROM public.wallet_transactions
    WHERE wallet_id = bao_wallet_id AND bucket = 'debt';

    repayment_amount := LEAST(debt_balance, request.amount);
    available_amount := request.amount - repayment_amount;

    IF repayment_amount > 0 THEN
      INSERT INTO public.wallet_transactions
        (wallet_id, bucket, amount, kind, idempotency_key, cashout_id)
      VALUES
        (bao_wallet_id, 'debt', -repayment_amount, 'debt_repayment',
         'reject:' || request.id::text || ':debt', request.id)
      ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;

    IF available_amount > 0 THEN
      INSERT INTO public.wallet_transactions
        (wallet_id, bucket, amount, kind, idempotency_key, cashout_id)
      VALUES
        (bao_wallet_id, 'available', available_amount, 'cashout_released',
         'reject:' || request.id::text || ':available', request.id)
      ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;

    UPDATE public.cashout_requests
    SET status = 'cancelled', reason = cancel_reason, reviewed_by = actor_id,
        reviewed_at = now(), updated_at = now()
    WHERE id = request.id;

    INSERT INTO public.bao_audit_logs
      (actor_id, action, entity_type, entity_id, reason, metadata)
    VALUES
      (actor_id, 'bao_cashout_cancelled', 'cashout_request', request.id::text, cancel_reason, '{}'::jsonb);

    INSERT INTO public.notifications (user_id, type, message)
    VALUES
      (request.requested_by, 'payment',
       format('Your cashout request for PHP %s was cancelled. COD commission cannot be withdrawn.', request.amount));

    active_cashout_total := active_cashout_total - request.amount;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM public.cashout_requests c
    JOIN public.wallet_transactions wt ON wt.wallet_id = c.wallet_id
    WHERE c.wallet_id = bao_wallet_id
      AND c.status IN ('processing', 'completed')
      AND wt.idempotency_key LIKE 'cod-commission:%:available'
      AND c.created_at >= wt.created_at
  ) THEN
    RAISE EXCEPTION 'A COD-era transfer is already in progress or completed; reconcile it before reversing COD wallet credits.';
  END IF;

  SELECT COALESCE(SUM(wt.amount), 0)
  INTO cod_available_total
  FROM public.wallet_transactions wt
  WHERE wt.wallet_id = bao_wallet_id
    AND wt.bucket = 'available'
    AND wt.kind = 'cod_commission'
    AND wt.idempotency_key LIKE 'cod-commission:%:available'
    AND NOT EXISTS (
      SELECT 1
      FROM public.wallet_transactions reversal
      WHERE reversal.wallet_id = bao_wallet_id
        AND reversal.order_id = wt.order_id
        AND reversal.idempotency_key = 'cod-commission:' || wt.order_id::text || ':reversal'
    );

  SELECT COALESCE(SUM(amount), 0)
  INTO wallet_available
  FROM public.wallet_transactions
  WHERE wallet_id = bao_wallet_id AND bucket = 'available';

  IF wallet_available < cod_available_total THEN
    RAISE EXCEPTION 'COD wallet credits have already been spent; manual reconciliation is required.';
  END IF;

  FOR cod_entry IN
    SELECT wt.order_id, wt.amount
    FROM public.wallet_transactions wt
    WHERE wt.wallet_id = bao_wallet_id
      AND wt.bucket = 'available'
      AND wt.kind = 'cod_commission'
      AND wt.idempotency_key LIKE 'cod-commission:%:available'
      AND NOT EXISTS (
        SELECT 1
        FROM public.wallet_transactions reversal
        WHERE reversal.wallet_id = bao_wallet_id
          AND reversal.order_id = wt.order_id
          AND reversal.idempotency_key = 'cod-commission:' || wt.order_id::text || ':reversal'
      )
    ORDER BY wt.order_id
  LOOP
    INSERT INTO public.wallet_transactions
      (wallet_id, bucket, amount, kind, order_id, idempotency_key)
    VALUES
      (bao_wallet_id, 'available', -cod_entry.amount, 'cod_commission_reversal',
       cod_entry.order_id, 'cod-commission:' || cod_entry.order_id::text || ':reversal')
    ON CONFLICT (idempotency_key) DO NOTHING;
  END LOOP;

  FOR cod_entry IN
    SELECT wt.order_id, wt.amount
    FROM public.wallet_transactions wt
    WHERE wt.wallet_id = bao_wallet_id
      AND wt.bucket = 'debt'
      AND wt.kind = 'debt_repayment'
      AND wt.idempotency_key LIKE 'cod-commission:%:debt'
      AND NOT EXISTS (
        SELECT 1
        FROM public.wallet_transactions reversal
        WHERE reversal.wallet_id = bao_wallet_id
          AND reversal.order_id = wt.order_id
          AND reversal.idempotency_key = 'cod-commission:' || wt.order_id::text || ':debt-reversal'
      )
    ORDER BY wt.order_id
  LOOP
    INSERT INTO public.wallet_transactions
      (wallet_id, bucket, amount, kind, order_id, idempotency_key)
    VALUES
      (bao_wallet_id, 'debt', -cod_entry.amount, 'cod_commission_reversal',
       cod_entry.order_id, 'cod-commission:' || cod_entry.order_id::text || ':debt-reversal')
    ON CONFLICT (idempotency_key) DO NOTHING;
  END LOOP;
END;
$$;

COMMIT;
