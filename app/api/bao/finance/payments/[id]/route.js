import { requireFinance,uuid,financeResponse } from "@/lib/payments/security";
import { reconcilePayment } from "@/lib/payments/events";
import { paymentError } from "@/lib/payments/paymongo";
import { db } from "@/lib/db";
import { financeLock,currentActor,auditFinance } from "@/lib/payments/ledger";
export async function POST(req,{params}) {
  try {
    const actor=await requireFinance(),{id}=await params;uuid(id);
    const body=await req.json();if(body.action!=="reconcile") throw paymentError("Invalid reconciliation action.");
    const payment=await reconcilePayment(id,{sessionId:body.checkout_session_id||null});
    await db.transaction(async client=>{await financeLock(client);await currentActor(client,actor.id,["bao","admin"]);await auditFinance(client,actor.id,"payment_reconciled","payment",id);});
    return Response.json({success:true,status:payment.status});
  } catch(error) { return financeResponse(error); }
}
