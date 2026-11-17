import { db } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { isActiveSellerAccount } from "@/lib/seller-access";
import { readPagination,pageHeaders } from "@/lib/pagination";
export async function GET(req) {
 try {
  const session=await getServerSession(authOptions);if(!session)return Response.json({error:"Unauthorized"},{status:401});
  if(!(await isActiveSellerAccount(session.user.id)))return Response.json({error:"An active seller account is required."},{status:403});
  const page=readPagination(req),id=session.user.id;
  const [counts]=await db.query("SELECT COUNT(*)::integer AS total FROM product_reviews pr JOIN products p ON p.id=pr.product_id WHERE p.seller_id=$1",[id]);
  const total=Number(counts[0].total);let rows=[];
  if(page.offset<total)[rows]=await db.query(`SELECT pr.id,pr.rating,pr.comment,pr.created_at,p.name AS product_name,u.name AS user_name,variation.variant
    FROM product_reviews pr JOIN products p ON p.id=pr.product_id JOIN users u ON u.id=pr.user_id
    LEFT JOIN LATERAL(SELECT oi.variant FROM order_items oi JOIN orders o ON o.id=oi.order_id
      WHERE oi.product_id=pr.product_id AND o.user_id=pr.user_id ORDER BY o.id DESC,oi.id DESC LIMIT 1)variation ON true
    WHERE p.seller_id=$1 ORDER BY pr.created_at DESC,pr.id DESC LIMIT $2 OFFSET $3`,[id,page.pageSize,page.offset]);
  return Response.json(rows,{headers:pageHeaders(page,total)});
 }catch(error){console.error("Seller reviews failed:",error);return Response.json({error:error.status?error.message:"Unable to load reviews."},{status:error.status||503});}
}
