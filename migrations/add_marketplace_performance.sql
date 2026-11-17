-- Additive, replayable. Apply after add_marketplace_realtime.sql.
BEGIN;
CREATE INDEX IF NOT EXISTS products_public_newest ON public.products(id DESC) WHERE status='approved' AND is_visible=true;
CREATE INDEX IF NOT EXISTS products_public_category ON public.products(category_id,id DESC) WHERE status='approved' AND is_visible=true;
CREATE INDEX IF NOT EXISTS products_seller_page ON public.products(seller_id,id DESC);
CREATE INDEX IF NOT EXISTS orders_buyer_page ON public.orders(user_id,id DESC);
CREATE INDEX IF NOT EXISTS orders_buyer_status_page ON public.orders(user_id,status,id DESC);
CREATE INDEX IF NOT EXISTS orders_seller_page ON public.orders(seller_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS product_images_page ON public.product_images(product_id,sort_order,id);
CREATE INDEX IF NOT EXISTS product_variants_label_lookup ON public.product_variants(product_id,label);
CREATE INDEX IF NOT EXISTS product_reviews_page ON public.product_reviews(product_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS seller_applications_status_page ON public.seller_applications(status,submitted_at DESC,id DESC);

CREATE OR REPLACE FUNCTION public.marketplace_catalog_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE data jsonb; previous jsonb; owner integer; publish boolean:=false;
BEGIN
  IF TG_OP='UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NULL; END IF;
  IF TG_OP='DELETE' THEN data:=to_jsonb(OLD); ELSE data:=to_jsonb(NEW); END IF;
  IF TG_OP='UPDATE' THEN previous:=to_jsonb(OLD); END IF;
  IF TG_TABLE_NAME='products' THEN
    owner:=(data->>'seller_id')::integer;
    PERFORM public.emit_marketplace_change(owner,'inventory');
    IF (previous->>'seller_id')::integer IS DISTINCT FROM owner THEN
      PERFORM public.emit_marketplace_change((previous->>'seller_id')::integer,'inventory');
    END IF;
    publish:=((data->>'status')='approved' AND (data->>'is_visible')::boolean)
      OR ((previous->>'status')='approved' AND (previous->>'is_visible')::boolean);
  ELSIF TG_TABLE_NAME='product_reviews' THEN
    SELECT seller_id INTO owner FROM public.products WHERE id=(data->>'product_id')::integer;
    PERFORM public.emit_marketplace_change(owner,'reviews');
  ELSIF TG_TABLE_NAME='users' THEN
    publish:=EXISTS(SELECT 1 FROM public.products WHERE seller_id=(data->>'id')::integer AND status='approved' AND is_visible=true);
  END IF;
  IF publish THEN
    -- A public invalidation signal only; never stream private product rows.
    PERFORM realtime.send(jsonb_build_object('scope','catalog'),'catalog:changed','marketplace:catalog',false);
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Catalog realtime delivery failed: %',SQLSTATE;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_catalog_change() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS marketplace_catalog_products ON public.products;
CREATE TRIGGER marketplace_catalog_products AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_catalog_change();
DROP TRIGGER IF EXISTS marketplace_catalog_seller_status ON public.users;
CREATE TRIGGER marketplace_catalog_seller_status AFTER UPDATE OF status ON public.users
  FOR EACH ROW WHEN(OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION public.marketplace_catalog_change();
DROP TRIGGER IF EXISTS marketplace_catalog_reviews ON public.product_reviews;
CREATE TRIGGER marketplace_catalog_reviews AFTER INSERT OR UPDATE OR DELETE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_catalog_change();
COMMIT;
