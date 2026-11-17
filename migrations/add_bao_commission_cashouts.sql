-- Extend the existing cashout flow to the shared BAO commission wallet.
-- Existing seller destinations, requests and ledger balances are retained.
BEGIN;
ALTER TABLE public.wallet_destinations
  ADD COLUMN IF NOT EXISTS wallet_id uuid REFERENCES public.wallets(id),
  ADD COLUMN IF NOT EXISTS submitted_by integer REFERENCES public.users(id);
ALTER TABLE public.cashout_requests
  ADD COLUMN IF NOT EXISTS requested_by integer REFERENCES public.users(id);

INSERT INTO public.wallets(owner_id,kind)
  SELECT DISTINCT seller_id,'seller' FROM public.wallet_destinations WHERE seller_id IS NOT NULL
  ON CONFLICT DO NOTHING;
UPDATE public.wallet_destinations d SET wallet_id=w.id
  FROM public.wallets w WHERE d.wallet_id IS NULL AND w.owner_id=d.seller_id AND w.kind='seller';
UPDATE public.wallet_destinations SET submitted_by=seller_id WHERE submitted_by IS NULL;
UPDATE public.cashout_requests SET requested_by=seller_id WHERE requested_by IS NULL;

ALTER TABLE public.wallet_destinations
  ALTER COLUMN wallet_id SET NOT NULL,
  ALTER COLUMN submitted_by SET NOT NULL,
  ALTER COLUMN seller_id DROP NOT NULL;
ALTER TABLE public.cashout_requests
  ALTER COLUMN requested_by SET NOT NULL,
  ALTER COLUMN seller_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_destinations_wallet_fingerprint ON public.wallet_destinations(wallet_id,fingerprint);
CREATE UNIQUE INDEX IF NOT EXISTS wallet_destinations_id_wallet ON public.wallet_destinations(id,wallet_id);
CREATE UNIQUE INDEX IF NOT EXISTS cashouts_wallet_idempotency ON public.cashout_requests(wallet_id,idempotency_key);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.cashout_requests'::regclass AND conname='cashouts_destination_wallet') THEN
    ALTER TABLE public.cashout_requests ADD CONSTRAINT cashouts_destination_wallet
      FOREIGN KEY(destination_id,wallet_id) REFERENCES public.wallet_destinations(id,wallet_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_payout_wallet_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE owner integer;
BEGIN
  -- Keep the previous deployed seller APIs working during the code rollout.
  IF TG_TABLE_NAME='wallet_destinations' THEN
    IF NEW.wallet_id IS NULL AND NEW.seller_id IS NOT NULL THEN
      INSERT INTO public.wallets(owner_id,kind) VALUES(NEW.seller_id,'seller') ON CONFLICT DO NOTHING;
      SELECT id INTO NEW.wallet_id FROM public.wallets WHERE owner_id=NEW.seller_id AND kind='seller';
    END IF;
    NEW.submitted_by:=COALESCE(NEW.submitted_by,NEW.seller_id);
  ELSE
    NEW.requested_by:=COALESCE(NEW.requested_by,NEW.seller_id);
  END IF;
  SELECT owner_id INTO owner FROM public.wallets WHERE id=NEW.wallet_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found' USING ERRCODE='23503'; END IF;
  IF NEW.seller_id IS DISTINCT FROM owner THEN
    RAISE EXCEPTION 'Payout owner does not match wallet' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_payout_wallet_scope() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS payout_destination_wallet_scope ON public.wallet_destinations;
CREATE TRIGGER payout_destination_wallet_scope BEFORE INSERT OR UPDATE OF wallet_id,seller_id
  ON public.wallet_destinations FOR EACH ROW EXECUTE FUNCTION public.enforce_payout_wallet_scope();
DROP TRIGGER IF EXISTS cashout_wallet_scope ON public.cashout_requests;
CREATE TRIGGER cashout_wallet_scope BEFORE INSERT OR UPDATE OF wallet_id,seller_id
  ON public.cashout_requests FOR EACH ROW EXECUTE FUNCTION public.enforce_payout_wallet_scope();
COMMIT;
