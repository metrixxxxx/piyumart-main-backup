import { db } from "@/lib/db";
import { requireBuyer,uuid,financeResponse } from "@/lib/payments/security";
import { paymentError } from "@/lib/payments/paymongo";
import { reconcilePayment } from "@/lib/payments/events";

export async function GET(req,{params}) {
  try {
    const user=await requireBuyer(),{id}=await params;uuid(id);
    const [rows]=await db.query("SELECT * FROM payments WHERE id=$1 AND user_id=$2",[id,user.id]);
    if(!rows[0]) throw paymentError("Payment not found.",404);
    let payment=rows[0],refreshError=null;
    if(new URL(req.url).searchParams.get("refresh")==="1"&&payment.checkout_session_id&&!["refunded","expired","cancelled","failed"].includes(payment.status)) {
      try { payment=await reconcilePayment(id); } catch(error) { refreshError=error.status?error.message:"Unable to refresh the provider status."; }
    }
    const [orders]=await db.query("SELECT a.order_id,a.gross_amount,a.seller_amount,a.commission_amount,o.status FROM payment_allocations a JOIN orders o ON o.id=a.order_id WHERE a.payment_id=$1 ORDER BY a.order_id",[id]);
    return Response.json({payment:{id:payment.id,reference:payment.reference,amount:payment.amount,status:payment.status,refunded_amount:payment.refunded_amount,checkout_url:["pending","initializing"].includes(payment.status)?payment.checkout_url:null,created_at:payment.created_at,paid_at:payment.paid_at,error_code:payment.error_code},orders,refreshError,mode:"test"},{headers:{"Cache-Control":"private, no-store"}});
  } catch(error) { return financeResponse(error); }
}
export async function POST(req,{params}) {
  try {
    const user=await requireBuyer(),{id}=await params;uuid(id);
    const [rows]=await db.query("SELECT id,checkout_session_id FROM payments WHERE id=$1 AND user_id=$2",[id,user.id]);
    if(!rows[0]) throw paymentError("Payment not found.",404);
    const body=await req.json();if(body.action!=="cancel") throw paymentError("Invalid payment action.");
    if(!rows[0].checkout_session_id) throw paymentError("This checkout requires staff reconciliation before it can be cancelled safely.",409);
    const payment=await reconcilePayment(id,{cancel:true});
    return Response.json({success:true,status:payment.status});
  } catch(error) { return financeResponse(error); }
}
