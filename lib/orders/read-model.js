import "server-only";
import { db } from "@/lib/db";
import { readPagination,pageHeaders,orderStatus } from "@/lib/pagination";

export const sellerOwnership = "o.id IN (SELECT id FROM orders WHERE seller_id=$1 UNION SELECT owned.order_id FROM order_items owned JOIN products product ON product.id=owned.product_id JOIN orders legacy ON legacy.id=owned.order_id WHERE product.seller_id=$1 AND legacy.seller_id IS NULL)";
export async function orderPage(req,userId,seller=false) {
  const paging=readPagination(req),status=orderStatus(new URL(req?.url||"http://localhost").searchParams.get("status"));
  const ownership=seller?sellerOwnership:"o.user_id=$1";
  const [counts]=await db.query(`SELECT o.status,COUNT(*)::integer AS count FROM orders o WHERE ${ownership} GROUP BY o.status`,[userId]);
  const statusCounts=Object.fromEntries(counts.map(row=>[row.status,Number(row.count)]));
  const total=status?statusCounts[status]||0:Object.values(statusCounts).reduce((sum,value)=>sum+value,0);
  return {paging,status,total,statusCounts,ownership,headers:pageHeaders(paging,total,{"X-Status-Counts":JSON.stringify(statusCounts)})};
}
export async function buyerOrders(req,userId) {
  const page=await orderPage(req,userId);
  if(page.paging.offset>=page.total)return {rows:[],headers:page.headers};
  const [orders]=await db.query(`SELECT o.*,a.payment_id FROM orders o LEFT JOIN payment_allocations a ON a.order_id=o.id
    WHERE o.user_id=$1 AND ($2::text IS NULL OR o.status=$2::text) ORDER BY o.id DESC LIMIT $3 OFFSET $4`,[userId,page.status,page.paging.pageSize,page.paging.offset]);
  if(!orders.length)return {rows:[],headers:page.headers};
  const [items]=await db.query(`SELECT oi.order_id,oi.product_id,oi.quantity,oi.price,oi.variant,p.department,p.meetup_point,
    COALESCE(p.seller_id,o.seller_id) AS seller_id,COALESCE(oi.name,p.name) AS name,COALESCE(oi.seller_name,p.seller_name) AS seller_name,
    COALESCE(oi.image_url,(SELECT pv.image_url FROM product_variants pv WHERE pv.product_id=p.id AND pv.label=oi.variant LIMIT 1),
      (SELECT pi.image_url FROM product_images pi WHERE pi.product_id=p.id ORDER BY pi.sort_order ASC LIMIT 1),p.image_url) AS image_url
    FROM order_items oi JOIN orders o ON o.id=oi.order_id LEFT JOIN products p ON p.id=oi.product_id
    WHERE oi.order_id=ANY($1::integer[]) ORDER BY oi.id ASC`,[orders.map(order=>order.id)]);
  const grouped=new Map();for(const {order_id,...item} of items){const key=String(order_id);if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(item);}
  return {rows:orders.map(({pickup_proof_path,...order})=>({...order,has_pickup_proof:Boolean(pickup_proof_path),items:grouped.get(String(order.id))||[]})),headers:page.headers};
}
