import { db } from "@/lib/db";
import { reconcilePayment } from "@/lib/payments/events";
export async function GET(req) {
  if(!process.env.CRON_SECRET||req.headers.get("authorization")!==`Bearer ${process.env.CRON_SECRET}`) return Response.json({error:"Unauthorized"},{status:401});
  const [payments]=await db.query("SELECT id,created_at FROM payments WHERE status='pending' AND checkout_session_id IS NOT NULL ORDER BY created_at LIMIT 30");
  let reconciled=0,failed=0;
  for(const payment of payments) {
    try {await reconcilePayment(payment.id,{expire:Date.now()-new Date(payment.created_at).valueOf()>30*60*1000});reconciled++;}
    catch {failed++;}
  }
  return Response.json({reconciled,failed});
}
