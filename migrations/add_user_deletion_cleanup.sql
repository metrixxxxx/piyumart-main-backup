-- Permanent test-data deletion for both the dashboard and Supabase Table Editor.
-- Existing foreign keys, financial calculations, and history guards are retained.
BEGIN;

CREATE OR REPLACE FUNCTION public.lock_user_deletion()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  -- Acquire the payment lock before DELETE takes any user row locks.
  PERFORM pg_advisory_xact_lock(817206,71);
  PERFORM pg_advisory_xact_lock(817206,3);
  LOCK TABLE public.users, public.products, public.orders, public.order_items,
    public.payments, public.payment_allocations, public.payment_refunds,
    public.wallets, public.wallet_transactions, public.wallet_destinations,
    public.cashout_requests, public.payouts, public.order_commissions,
    public.bao_audit_logs, public.bao_commission_rates, public.finance_settings,
    public.marketplace_reports, public.marketplace_report_updates,
    public.conversations, public.messages, public.carts, public.cart_items,
    public.wishlist, public.ratings, public.product_reviews, public.user_activity,
    public.notifications, public.seller_applications,
    public.marketplace_realtime_channels, public.product_attributes,
    public.product_images, public.product_variants IN SHARE ROW EXCLUSIVE MODE;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_user_dependencies()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE
  product_ids integer[]; order_ids integer[]; payment_ids uuid[];
  wallet_ids uuid[]; destination_ids uuid[]; cashout_ids uuid[];
  ledger_ids uuid[]; report_ids uuid[]; conversation_ids integer[];
  reviewed_product_ids integer[]; guard record;
BEGIN
  IF OLD.role IS NULL OR OLD.role NOT IN ('user','seller') THEN
    RAISE EXCEPTION 'Cannot delete user: admin and BAO accounts are protected.';
  END IF;
  SELECT COALESCE(array_agg(id),'{}') INTO product_ids FROM public.products WHERE seller_id=OLD.id;
  SELECT COALESCE(array_agg(o.id),'{}') INTO order_ids FROM public.orders o
    WHERE o.user_id=OLD.id OR o.seller_id=OLD.id OR EXISTS (
      SELECT 1 FROM public.order_items i WHERE i.order_id=o.id AND i.product_id=ANY(product_ids));
  IF EXISTS (SELECT 1 FROM public.orders o JOIN public.order_items i ON i.order_id=o.id
    WHERE o.id=ANY(order_ids) AND o.user_id IS DISTINCT FROM OLD.id
      AND o.seller_id IS DISTINCT FROM OLD.id AND NOT i.product_id=ANY(product_ids)) THEN
    RAISE EXCEPTION 'Cannot delete user: a legacy order also contains another seller''s products. Separate that order first.';
  END IF;
  SELECT COALESCE(array_agg(p.id),'{}') INTO payment_ids FROM public.payments p
    WHERE p.user_id=OLD.id OR EXISTS (SELECT 1 FROM public.payment_allocations a
      WHERE a.payment_id=p.id AND (a.order_id=ANY(order_ids) OR a.seller_id=OLD.id));
  IF EXISTS (SELECT 1 FROM public.payments WHERE id=ANY(payment_ids) AND livemode IS DISTINCT FROM false) THEN
    RAISE EXCEPTION 'Cannot delete user: live payment history requires separate reconciliation.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.payments WHERE id=ANY(payment_ids) AND status IN ('initializing','pending')) THEN
    RAISE EXCEPTION 'Cannot delete user: cancel or resolve pending online payments first.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.payment_allocations WHERE payment_id=ANY(payment_ids) AND NOT order_id=ANY(order_ids)) THEN
    RAISE EXCEPTION 'Cannot delete user: a payment is shared with another seller''s orders. Reconcile that test checkout first.';
  END IF;
  SELECT COALESCE(array_agg(id),'{}') INTO wallet_ids FROM public.wallets WHERE owner_id=OLD.id;
  SELECT COALESCE(array_agg(id),'{}') INTO destination_ids FROM public.wallet_destinations
    WHERE seller_id=OLD.id OR wallet_id=ANY(wallet_ids);
  SELECT COALESCE(array_agg(id),'{}') INTO cashout_ids FROM public.cashout_requests
    WHERE seller_id=OLD.id OR wallet_id=ANY(wallet_ids);
  IF EXISTS (SELECT 1 FROM public.payouts WHERE cashout_id=ANY(cashout_ids))
    OR EXISTS (SELECT 1 FROM public.cashout_requests WHERE id=ANY(cashout_ids) AND status IN ('processing','completed')) THEN
    RAISE EXCEPTION 'Cannot delete user: reconcile recorded payouts before deleting the account.';
  END IF;
  SELECT COALESCE(array_agg(id),'{}') INTO ledger_ids FROM public.wallet_transactions
    WHERE wallet_id=ANY(wallet_ids) OR order_id=ANY(order_ids)
      OR payment_id=ANY(payment_ids) OR cashout_id=ANY(cashout_ids);
  IF EXISTS (SELECT 1 FROM public.wallet_transactions WHERE NOT id=ANY(ledger_ids)
    GROUP BY wallet_id,bucket HAVING SUM(amount)<0) THEN
    RAISE EXCEPTION 'Cannot delete user: these test earnings have funded another withdrawal. Reconcile wallet balances first.';
  END IF;
  SELECT COALESCE(array_agg(id),'{}') INTO report_ids FROM public.marketplace_reports
    WHERE reporter_id=OLD.id OR related_seller_id=OLD.id
      OR related_order_id=ANY(order_ids) OR related_product_id=ANY(product_ids);
  -- Do not remove global commission settings or staff decisions for other users.
  IF EXISTS (SELECT 1 FROM public.bao_commission_rates WHERE changed_by=OLD.id)
    OR EXISTS (SELECT 1 FROM public.finance_settings WHERE updated_by=OLD.id)
    OR EXISTS (SELECT 1 FROM public.marketplace_reports WHERE assigned_to=OLD.id AND NOT id=ANY(report_ids))
    OR EXISTS (SELECT 1 FROM public.marketplace_report_updates WHERE updated_by=OLD.id AND NOT report_id=ANY(report_ids))
    OR EXISTS (SELECT 1 FROM public.seller_applications WHERE reviewed_by=OLD.id AND user_id<>OLD.id)
    OR EXISTS (SELECT 1 FROM public.payouts WHERE recorded_by=OLD.id)
    OR EXISTS (SELECT 1 FROM public.cashout_requests WHERE (requested_by=OLD.id OR reviewed_by=OLD.id) AND NOT id=ANY(cashout_ids))
    OR EXISTS (SELECT 1 FROM public.wallet_destinations WHERE (submitted_by=OLD.id OR reviewed_by=OLD.id) AND NOT id=ANY(destination_ids)) THEN
    RAISE EXCEPTION 'Cannot delete user: this account is attributed to shared staff records. Reassign those records first.';
  END IF;
  SELECT COALESCE(array_agg(id),'{}') INTO conversation_ids FROM public.conversations
    WHERE buyer_id=OLD.id OR seller_id=OLD.id OR product_id=ANY(product_ids);
  SELECT COALESCE(array_agg(DISTINCT product_id),'{}') INTO reviewed_product_ids
    FROM public.product_reviews WHERE user_id=OLD.id AND NOT product_id=ANY(product_ids);

  -- These locks were taken by the statement trigger. Only the named guards
  -- pause; foreign keys and realtime triggers stay enabled throughout.
  FOR guard IN SELECT * FROM (VALUES
    ('wallet_transactions','protect_wallet_ledger'),
    ('order_commissions','trg_commission_immutable'),
    ('marketplace_report_updates','trg_report_updates_immutable'),
    ('bao_audit_logs','trg_bao_audit_immutable')) AS g(table_name,trigger_name)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=format('public.%I',guard.table_name)::regclass
      AND tgname=guard.trigger_name AND tgenabled='O') THEN
      RAISE EXCEPTION 'Cannot delete user: an expected history protection is unavailable.';
    END IF;
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER %I',guard.table_name,guard.trigger_name);
  END LOOP;

  -- Undo only reservations and completed-sale counters for the removed orders.
  UPDATE public.products p SET stock=p.stock+x.quantity FROM (
    SELECT i.product_id,SUM(i.quantity)::integer AS quantity FROM public.order_items i
    JOIN public.orders o ON o.id=i.order_id WHERE o.id=ANY(order_ids)
      AND o.stock_reserved AND o.status NOT IN ('completed','cancelled')
      AND NOT i.product_id=ANY(product_ids) GROUP BY i.product_id
  ) x WHERE p.id=x.product_id;
  UPDATE public.products p SET sold_count=GREATEST(0,COALESCE(p.sold_count,0)-x.quantity) FROM (
    SELECT i.product_id,SUM(i.quantity)::integer AS quantity FROM public.order_items i
    JOIN public.orders o ON o.id=i.order_id WHERE o.id=ANY(order_ids)
      AND o.status='completed' AND NOT i.product_id=ANY(product_ids) GROUP BY i.product_id
  ) x WHERE p.id=x.product_id;

  DELETE FROM public.wallet_transactions WHERE id=ANY(ledger_ids);
  DELETE FROM public.payment_refunds WHERE payment_id=ANY(payment_ids);
  DELETE FROM public.payment_allocations WHERE order_id=ANY(order_ids);
  DELETE FROM public.cashout_requests WHERE id=ANY(cashout_ids);
  DELETE FROM public.wallet_destinations WHERE id=ANY(destination_ids);
  DELETE FROM public.wallets WHERE id=ANY(wallet_ids);
  DELETE FROM public.order_commissions WHERE order_id=ANY(order_ids);
  DELETE FROM public.marketplace_report_updates WHERE report_id=ANY(report_ids);
  DELETE FROM public.marketplace_reports WHERE id=ANY(report_ids);
  DELETE FROM public.bao_audit_logs WHERE actor_id=OLD.id OR
    (entity_type IN ('user','seller') AND entity_id=OLD.id::text) OR
    (entity_type='product' AND entity_id=ANY(product_ids::text[])) OR
    (entity_type='order' AND entity_id=ANY(order_ids::text[])) OR
    (entity_type='payment' AND entity_id=ANY(payment_ids::text[])) OR
    (entity_type='wallet' AND entity_id=ANY(wallet_ids::text[])) OR
    (entity_type='wallet_destination' AND entity_id=ANY(destination_ids::text[])) OR
    (entity_type='cashout_request' AND entity_id=ANY(cashout_ids::text[])) OR
    (entity_type IN ('report','marketplace_report') AND entity_id=ANY(report_ids::text[])) OR
    (entity_type='seller_application' AND entity_id IN (SELECT id::text FROM public.seller_applications WHERE user_id=OLD.id));
  DELETE FROM public.messages WHERE sender_id=OLD.id OR conversation_id=ANY(conversation_ids);
  DELETE FROM public.conversations WHERE id=ANY(conversation_ids);
  DELETE FROM public.cart_items WHERE product_id=ANY(product_ids)
    OR cart_id IN (SELECT id FROM public.carts WHERE user_id=OLD.id);
  DELETE FROM public.carts WHERE user_id=OLD.id;
  DELETE FROM public.wishlist WHERE user_id=OLD.id OR product_id=ANY(product_ids);
  DELETE FROM public.ratings WHERE user_id=OLD.id OR product_id=ANY(product_ids);
  DELETE FROM public.product_reviews WHERE user_id=OLD.id OR product_id=ANY(product_ids);
  DELETE FROM public.user_activity WHERE user_id=OLD.id OR product_id=ANY(product_ids);
  DELETE FROM public.notifications n WHERE n.user_id=OLD.id OR (n.type IN ('payment','order') AND (
    (cardinality(order_ids)>0 AND n.message ~ ('#('||array_to_string(order_ids,'|')||')([^0-9]|$)'))
    OR EXISTS (SELECT 1 FROM public.payments p WHERE p.id=ANY(payment_ids) AND strpos(n.message,p.reference)>0)));
  DELETE FROM public.seller_applications WHERE user_id=OLD.id;
  DELETE FROM public.marketplace_realtime_channels WHERE user_id=OLD.id;
  DELETE FROM public.order_items WHERE order_id=ANY(order_ids);
  DELETE FROM public.orders WHERE id=ANY(order_ids);
  DELETE FROM public.payments WHERE id=ANY(payment_ids);
  DELETE FROM public.product_attributes WHERE product_id=ANY(product_ids);
  DELETE FROM public.product_images WHERE product_id=ANY(product_ids);
  DELETE FROM public.product_variants WHERE product_id=ANY(product_ids);
  DELETE FROM public.products WHERE id=ANY(product_ids);
  UPDATE public.products p SET average_rating=(SELECT ROUND(AVG(r.rating)::numeric,2)
      FROM public.product_reviews r WHERE r.product_id=p.id),
    total_ratings=(SELECT COUNT(*) FROM public.product_reviews r WHERE r.product_id=p.id)
    WHERE p.id=ANY(reviewed_product_ids);

  FOR guard IN SELECT * FROM (VALUES
    ('wallet_transactions','protect_wallet_ledger'),
    ('order_commissions','trg_commission_immutable'),
    ('marketplace_report_updates','trg_report_updates_immutable'),
    ('bao_audit_logs','trg_bao_audit_immutable')) AS g(table_name,trigger_name)
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER %I',guard.table_name,guard.trigger_name);
  END LOOP;
  RETURN OLD;
END;
$$;

-- Invoker rights: no new privileged RPC or browser access is exposed.
REVOKE ALL ON FUNCTION public.lock_user_deletion() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.cleanup_user_dependencies() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS users_delete_lock ON public.users;
CREATE TRIGGER users_delete_lock BEFORE DELETE ON public.users
  FOR EACH STATEMENT EXECUTE FUNCTION public.lock_user_deletion();
DROP TRIGGER IF EXISTS users_delete_cleanup ON public.users;
CREATE TRIGGER users_delete_cleanup BEFORE DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_user_dependencies();
COMMIT;
