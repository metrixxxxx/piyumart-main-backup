-- Reviewed against the existing integer users/orders IDs and UUID commission IDs.
-- Run separately in Supabase SQL Editor. No existing financial history is rewritten.
BEGIN;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS checkout_key uuid;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stock_reserved boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS orders_checkout_seller ON public.orders(user_id, checkout_key, seller_id) WHERE checkout_key IS NOT NULL;

CREATE TABLE public.finance_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  minimum_cashout numeric(14,2) NOT NULL DEFAULT 100 CHECK (minimum_cashout > 0),
  release_policy text NOT NULL DEFAULT 'buyer_confirmation' CHECK (release_policy IN ('buyer_confirmation','payment_confirmed')),
  updated_by integer REFERENCES public.users(id), updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.finance_settings(id) VALUES(true);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id integer NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  reference text NOT NULL UNIQUE,
  idempotency_key uuid NOT NULL,
  request_hash text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0), currency text NOT NULL DEFAULT 'PHP' CHECK(currency='PHP'),
  status text NOT NULL DEFAULT 'initializing' CHECK(status IN ('initializing','pending','paid','failed','expired','cancelled','partially_refunded','refunded')),
  checkout_session_id text UNIQUE, payment_intent_id text, provider_payment_id text UNIQUE, checkout_url text,
  refunded_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK(refunded_amount>=0 AND refunded_amount<=amount),
  fee_amount numeric(14,2) CHECK(fee_amount>=0),
  livemode boolean NOT NULL DEFAULT false CHECK(NOT livemode),
  error_code text, paid_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,idempotency_key)
);
CREATE INDEX payments_user_created ON public.payments(user_id,created_at DESC);
CREATE INDEX payments_intent ON public.payments(payment_intent_id);
CREATE TABLE public.payment_allocations (
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  order_id integer PRIMARY KEY REFERENCES public.orders(id) ON DELETE RESTRICT,
  seller_id integer NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  gross_amount numeric(14,2) NOT NULL CHECK(gross_amount>0),
  commission_amount numeric(14,2) NOT NULL CHECK(commission_amount>=0),
  seller_amount numeric(14,2) NOT NULL CHECK(seller_amount>=0),
  refunded_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK(refunded_amount>=0 AND refunded_amount<=gross_amount),
  seller_refunded numeric(14,2) NOT NULL DEFAULT 0 CHECK(seller_refunded>=0 AND seller_refunded<=seller_amount),
  commission_refunded numeric(14,2) NOT NULL DEFAULT 0 CHECK(commission_refunded>=0 AND commission_refunded<=commission_amount),
  released boolean NOT NULL DEFAULT false,
  CHECK(seller_amount+commission_amount=gross_amount),
  CHECK(seller_refunded+commission_refunded=refunded_amount),
  CHECK(commission_amount=round(gross_amount*0.03,2))
);
CREATE INDEX payment_allocations_payment ON public.payment_allocations(payment_id);
CREATE INDEX payment_allocations_seller ON public.payment_allocations(seller_id);
CREATE TABLE public.payment_webhook_events (
  event_id text PRIMARY KEY, event_type text NOT NULL, payload_hash text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.payment_refunds (
  provider_refund_id text PRIMARY KEY, payment_id uuid NOT NULL REFERENCES public.payments(id),
  amount numeric(14,2) NOT NULL CHECK(amount>0), status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id integer REFERENCES public.users(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK(kind IN ('seller','bao')), created_at timestamptz NOT NULL DEFAULT now(),
  CHECK((kind='seller' AND owner_id IS NOT NULL) OR (kind='bao' AND owner_id IS NULL))
);
CREATE UNIQUE INDEX wallets_seller ON public.wallets(owner_id) WHERE kind='seller';
CREATE UNIQUE INDEX wallets_bao ON public.wallets(kind) WHERE kind='bao';
INSERT INTO public.wallets(kind) VALUES('bao');
INSERT INTO public.wallets(owner_id,kind) SELECT id,'seller' FROM public.users WHERE role='seller';

CREATE TABLE public.wallet_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), seller_id integer NOT NULL REFERENCES public.users(id),
  institution text NOT NULL, account_name text NOT NULL, account_number_encrypted text NOT NULL,
  account_last_four text NOT NULL, fingerprint text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  reviewed_by integer REFERENCES public.users(id), reviewed_at timestamptz, remarks text,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(seller_id,fingerprint)
);
CREATE TABLE public.cashout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), wallet_id uuid NOT NULL REFERENCES public.wallets(id),
  seller_id integer NOT NULL REFERENCES public.users(id), destination_id uuid NOT NULL REFERENCES public.wallet_destinations(id),
  amount numeric(14,2) NOT NULL CHECK(amount>0),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','processing','completed','rejected','failed')),
  idempotency_key uuid NOT NULL, reason text,
  reviewed_by integer REFERENCES public.users(id), reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(seller_id,idempotency_key)
);
CREATE INDEX cashout_status_created ON public.cashout_requests(status,created_at DESC);
CREATE TABLE public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cashout_id uuid NOT NULL UNIQUE REFERENCES public.cashout_requests(id),
  provider text NOT NULL DEFAULT 'paymongo' CHECK(provider='paymongo'), provider_transfer_id text NOT NULL UNIQUE,
  reference text, status text NOT NULL CHECK(status IN ('processing','succeeded','failed')),
  proof jsonb NOT NULL DEFAULT '{}', recorded_by integer NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(), confirmed_at timestamptz
);
CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), wallet_id uuid NOT NULL REFERENCES public.wallets(id),
  bucket text NOT NULL CHECK(bucket IN ('pending','available','reserved','debt')),
  amount numeric(14,2) NOT NULL CHECK(amount<>0), kind text NOT NULL,
  payment_id uuid REFERENCES public.payments(id), order_id integer REFERENCES public.orders(id), cashout_id uuid REFERENCES public.cashout_requests(id),
  idempotency_key text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wallet_transactions_wallet_created ON public.wallet_transactions(wallet_id,created_at DESC);
CREATE FUNCTION public.protect_wallet_ledger() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE current_balance numeric;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Wallet history is immutable'; END IF;
  PERFORM 1 FROM wallets WHERE id=NEW.wallet_id FOR UPDATE;
  SELECT COALESCE(SUM(amount),0) INTO current_balance FROM wallet_transactions WHERE wallet_id=NEW.wallet_id AND bucket=NEW.bucket;
  IF current_balance+NEW.amount < 0 THEN RAISE EXCEPTION 'Insufficient wallet balance' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_wallet_ledger BEFORE INSERT OR UPDATE OR DELETE ON public.wallet_transactions FOR EACH ROW EXECUTE FUNCTION public.protect_wallet_ledger();

-- The app uses custom auth and server-side pg, not Supabase Auth JWT identities.
-- No browser/client role can read or mutate financial tables directly.
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['finance_settings','payments','payment_allocations','payment_webhook_events','payment_refunds','wallets','wallet_destinations','cashout_requests','payouts','wallet_transactions'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',table_name);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated',table_name);
  END LOOP;
END $$;
COMMIT;
