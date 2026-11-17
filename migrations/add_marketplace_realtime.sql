-- Custom auth: broadcast invalidations only; private records stay behind the APIs.
-- Channels use unguessable topics issued only after checking the app session.
BEGIN;

CREATE TABLE IF NOT EXISTS public.marketplace_realtime_channels (
  user_id integer PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  topic uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketplace_realtime_channels ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_realtime_channels FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.emit_marketplace_change(recipient integer, resource text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE channel_topic uuid;
BEGIN
  SELECT topic INTO channel_topic FROM public.marketplace_realtime_channels WHERE user_id=recipient;
  IF channel_topic IS NOT NULL THEN
    -- No records, IDs, balances, account details or credentials in the broadcast.
    -- These are public Broadcast channels with opaque topics, not private JWT channels.
    PERFORM realtime.send(jsonb_build_object('scope',resource), 'marketplace:changed',
      'marketplace:' || channel_topic::text, false);
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- An unavailable live feed must not fail an order or financial transaction.
  RAISE WARNING 'Marketplace realtime delivery failed: %', SQLSTATE;
END;
$$;
REVOKE ALL ON FUNCTION public.emit_marketplace_change(integer,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.marketplace_realtime_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE data jsonb; previous jsonb; recipients integer[] := ARRAY[]::integer[];
  recipient integer; wallet_owner integer; resource text;
BEGIN
  IF TG_OP='UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NULL; END IF;
  IF TG_OP='DELETE' THEN data:=to_jsonb(OLD); ELSE data:=to_jsonb(NEW); END IF;
  IF TG_OP='UPDATE' THEN previous:=to_jsonb(OLD); END IF;
  CASE TG_TABLE_NAME
    WHEN 'orders' THEN
      resource:='orders';
      recipients:=ARRAY[(data->>'user_id')::integer,(data->>'seller_id')::integer,
        (previous->>'user_id')::integer,(previous->>'seller_id')::integer];
    WHEN 'payments' THEN
      resource:='payments'; recipients:=ARRAY[(data->>'user_id')::integer];
    WHEN 'wallet_transactions' THEN
      resource:='wallet';
      SELECT owner_id INTO wallet_owner FROM public.wallets WHERE id=(data->>'wallet_id')::uuid;
      recipients:=ARRAY[wallet_owner];
    WHEN 'wallet_destinations','cashout_requests' THEN
      resource:='wallet'; recipients:=ARRAY[(data->>'seller_id')::integer];
    WHEN 'finance_settings' THEN
      resource:='finance';
      SELECT array_agg(c.user_id) INTO recipients FROM public.marketplace_realtime_channels c
        JOIN public.users u ON u.id=c.user_id WHERE u.role='seller' AND u.status='active';
    ELSE RETURN NULL;
  END CASE;
  FOR recipient IN SELECT DISTINCT value FROM unnest(recipients) AS value WHERE value IS NOT NULL LOOP
    PERFORM public.emit_marketplace_change(recipient,resource);
  END LOOP;
  FOR recipient IN SELECT c.user_id FROM public.marketplace_realtime_channels c
    JOIN public.users u ON u.id=c.user_id WHERE u.role IN ('bao','admin') AND u.status='active' LOOP
    PERFORM public.emit_marketplace_change(recipient,resource);
  END LOOP;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_realtime_change() FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS marketplace_orders_realtime ON public.orders;
CREATE TRIGGER marketplace_orders_realtime AFTER INSERT OR UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_realtime_change();
DROP TRIGGER IF EXISTS marketplace_payments_realtime ON public.payments;
CREATE TRIGGER marketplace_payments_realtime AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_realtime_change();
DROP TRIGGER IF EXISTS marketplace_ledger_realtime ON public.wallet_transactions;
CREATE TRIGGER marketplace_ledger_realtime AFTER INSERT ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_realtime_change();
DROP TRIGGER IF EXISTS marketplace_destinations_realtime ON public.wallet_destinations;
CREATE TRIGGER marketplace_destinations_realtime AFTER INSERT OR UPDATE OR DELETE ON public.wallet_destinations
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_realtime_change();
DROP TRIGGER IF EXISTS marketplace_cashouts_realtime ON public.cashout_requests;
CREATE TRIGGER marketplace_cashouts_realtime AFTER INSERT OR UPDATE OR DELETE ON public.cashout_requests
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_realtime_change();
DROP TRIGGER IF EXISTS marketplace_settings_realtime ON public.finance_settings;
CREATE TRIGGER marketplace_settings_realtime AFTER UPDATE ON public.finance_settings
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_realtime_change();
COMMIT;
