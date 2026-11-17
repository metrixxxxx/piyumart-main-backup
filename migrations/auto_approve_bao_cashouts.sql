-- BAO commission destinations and cashouts no longer need manual review.
-- Seller reviews and all ledger reservations remain unchanged.
BEGIN;
SELECT pg_advisory_xact_lock(817206,71);

ALTER TABLE public.cashout_requests DROP CONSTRAINT IF EXISTS cashout_requests_status_check;
ALTER TABLE public.cashout_requests ADD CONSTRAINT cashout_requests_status_check
  CHECK(status IN ('pending','approved','processing','completed','rejected','failed','cancelled'));

CREATE OR REPLACE FUNCTION public.auto_approve_bao_wallet_activity()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.status='pending' AND EXISTS (
    SELECT 1 FROM public.wallets WHERE id=NEW.wallet_id AND kind='bao'
  ) THEN
    NEW.status:='approved';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.auto_approve_bao_wallet_activity() FROM PUBLIC,anon,authenticated;
-- These run after the existing ownership/compatibility triggers by name.
DROP TRIGGER IF EXISTS wallet_destination_auto_approval ON public.wallet_destinations;
CREATE TRIGGER wallet_destination_auto_approval BEFORE INSERT ON public.wallet_destinations
  FOR EACH ROW EXECUTE FUNCTION public.auto_approve_bao_wallet_activity();
DROP TRIGGER IF EXISTS wallet_cashout_auto_approval ON public.cashout_requests;
CREATE TRIGGER wallet_cashout_auto_approval BEFORE INSERT ON public.cashout_requests
  FOR EACH ROW EXECUTE FUNCTION public.auto_approve_bao_wallet_activity();

-- Include records already waiting for review. Do not invent a human reviewer.
WITH changed AS (
  UPDATE public.wallet_destinations d SET status='approved'
    FROM public.wallets w WHERE w.id=d.wallet_id AND w.kind='bao' AND d.status='pending'
    RETURNING d.id,d.submitted_by
)
INSERT INTO public.bao_audit_logs(actor_id,action,entity_type,entity_id,reason,metadata)
  SELECT submitted_by,'bao_payout_destination_auto_approved','wallet_destination',id::text,
    'BAO payout destinations no longer require manual review.',
    '{"review_required":false,"previous_status":"pending"}'::jsonb FROM changed;
WITH changed AS (
  UPDATE public.cashout_requests c SET status='approved',updated_at=now()
    FROM public.wallets w WHERE w.id=c.wallet_id AND w.kind='bao' AND c.status='pending'
    RETURNING c.id,c.requested_by
)
INSERT INTO public.bao_audit_logs(actor_id,action,entity_type,entity_id,reason,metadata)
  SELECT requested_by,'bao_cashout_auto_approved','cashout_request',id::text,
    'BAO commission withdrawals no longer require manual review; funds remain reserved until transfer.',
    '{"review_required":false,"previous_status":"pending"}'::jsonb FROM changed;
COMMIT;
