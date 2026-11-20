import "server-only";
import { db } from "@/lib/db";
import { readPagination,pageHeaders,positiveFilter,paginationError } from "@/lib/pagination";

export async function publicProducts(req,viewerId) {
  const paging=readPagination(req,{defaultSize:20}),search=new URL(req.url).searchParams;
  const category=positiveFilter(search.get("category"),"category"),seller=positiveFilter(search.get("seller_id"),"seller"),q=(search.get("q")||"").trim();
  if(q.length>100)throw paginationError("Search must be at most 100 characters.");
  const sorts={newest:"p.id DESC",best_rated:"p.average_rating DESC NULLS LAST,p.id DESC",most_sold:"COALESCE(p.sold_count,0) DESC,p.id DESC",price_low:"p.price ASC,p.id DESC",price_high:"p.price DESC,p.id DESC"};
  const sort=sorts[search.get("sortBy")||"newest"];
  if(!sort)throw paginationError("Invalid sort order.");
  const values=[],where=["p.is_visible=true","p.status='approved'","EXISTS (SELECT 1 FROM users seller WHERE seller.id=p.seller_id AND seller.status='active')"];
  const add=(sql,value)=>{values.push(value);where.push(sql.replace("?",`$${values.length}`));};
  if(!seller&&viewerId)add("p.seller_id<>?",viewerId);
  if(seller)add("p.seller_id=?",seller);
  if(category)add("p.category_id=?",category);
  if(q){values.push(`%${q.replace(/[\\%_]/g,"\\$&")}%`);where.push(`(p.name ILIKE $${values.length} OR p.description ILIKE $${values.length})`);}
  const filter=where.join(" AND ");
  const [counts]=await db.query(`SELECT COUNT(*)::integer AS total FROM products p WHERE ${filter}`,values);
  const total=Number(counts[0].total);
  let rows=[];
  if(paging.offset<total){
    [rows]=await db.query(`SELECT p.id,p.name,LEFT(p.description,500) AS description,p.price,p.stock,p.image_url,
      p.seller_id,p.seller_name,p.category_id,p.department,p.meetup_point,p.is_visible,p.status,p.created_at,
      COALESCE(p.average_rating,0) AS average_rating,COALESCE(p.total_ratings,0) AS total_ratings,COALESCE(p.sold_count,0) AS sold_count
      FROM products p WHERE ${filter} ORDER BY ${sort} LIMIT $${values.length+1} OFFSET $${values.length+2}`,[...values,paging.pageSize,paging.offset]);
  }
  return {rows,headers:pageHeaders(paging,total)};
}

export async function sellerProducts(req,sellerId) {
  const paging=readPagination(req),visibility=new URL(req?.url||"http://localhost").searchParams.get("visibility")||"all";
  if(!["all","visible","hidden","suspended"].includes(visibility))throw paginationError("Invalid visibility filter.");
  const visible=visibility==="all"?null:visibility==="visible";
  const suspendedOnly=visibility==="suspended";
  const [counts]=await db.query(`SELECT COUNT(*)::integer AS total,
    COUNT(*) FILTER(WHERE is_visible=true AND status<>'suspended')::integer AS active,
    COUNT(*) FILTER(WHERE ($2::boolean IS NULL OR is_visible=$2) AND (NOT $3 OR status='suspended'))::integer AS filtered
    FROM products WHERE seller_id=$1`,[sellerId,visible,suspendedOnly]);
  const total=Number(counts[0].filtered),headers=pageHeaders(paging,total,{"X-Total-Listings":String(counts[0].total),"X-Active-Listings":String(counts[0].active)});
  if(paging.offset>=total)return {rows:[],headers};
  const [rows]=await db.query(`SELECT p.*,c.name AS category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id
    WHERE p.seller_id=$1 AND ($2::boolean IS NULL OR p.is_visible=$2) AND (NOT $3 OR p.status='suspended')
    ORDER BY p.id DESC LIMIT $4 OFFSET $5`,[sellerId,visible,suspendedOnly,paging.pageSize,paging.offset]);
  const ids=rows.map(row=>row.id);
  if(!ids.length)return {rows:[],headers};
  const results=await Promise.all([
    db.query(`SELECT pa.product_id,pa.value,ad.name,ad.label,ad.type FROM product_attributes pa JOIN attribute_definitions ad ON ad.id=pa.attribute_definition_id WHERE pa.product_id=ANY($1::integer[])`,[ids]),
    db.query("SELECT product_id,image_url FROM product_images WHERE product_id=ANY($1::integer[]) ORDER BY sort_order ASC,id ASC",[ids]),
    db.query("SELECT product_id,id,name,label,image_url,price_override,stock,value FROM product_variants WHERE product_id=ANY($1::integer[]) ORDER BY id ASC",[ids]),
  ]);
  const group=rows=>{const map=new Map();for(const {product_id,...row} of rows){const key=String(product_id);if(!map.has(key))map.set(key,[]);map.get(key).push(row);}return map;};
  const attrs=group(results[0][0]),images=group(results[1][0]),variants=group(results[2][0]);
  return {rows:rows.map(row=>({...row,attributes:attrs.get(String(row.id))||[],images:(images.get(String(row.id))||[]).map(image=>image.image_url),variants:variants.get(String(row.id))||[]})),headers};
}
