import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/lib/db";

// Cache Components is not enabled in this app. Scope its compatible Data Cache
// API to public data without changing dynamic session and authentication routes.
const TAG = "piyumart-public-catalog";
const namespace=process.env.NEXT_PUBLIC_SUPABASE_URL||"piyumart";
export const cachedCategories = unstable_cache(async () => {
  const [rows] = await db.query("SELECT id::text, name FROM categories ORDER BY name ASC");
  return rows;
}, [namespace,"piyumart-categories-v1"], { revalidate: 300, tags: [TAG] });
export const cachedFeatured = unstable_cache(async () => {
  const [rows] = await db.query(`SELECT p.id,p.name,p.description,p.price,p.image_url,p.seller_id,p.stock,p.department,p.meetup_point
    FROM products p WHERE p.is_featured=true AND p.status='approved' AND p.is_visible=true
    AND EXISTS (SELECT 1 FROM users seller WHERE seller.id=p.seller_id AND seller.status='active')
    ORDER BY p.id DESC LIMIT 5`);
  return rows;
}, [namespace,"piyumart-featured-v1"], { revalidate: 15, tags: [TAG] });
export function invalidateCatalog() {
  try { revalidateTag(TAG, { expire: 0 }); }
  catch (error) { console.error("Catalog cache invalidation failed:", error.message); }
}
export function withCatalogInvalidation(handler) {
  return async (...args) => {
    const response=await handler(...args);
    if(response.ok)invalidateCatalog();
    return response;
  };
}
