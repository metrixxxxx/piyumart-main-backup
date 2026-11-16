import { requireFinance,financeResponse } from "@/lib/payments/security";
import { reviewCashout,verifyPayout } from "@/lib/payments/wallet";
export async function PATCH(req,{params}) {
  try {
    const actor=await requireFinance(),{id}=await params,body=await req.json();
    return Response.json(body.action==="verify_payout"?await verifyPayout(actor.id,id,body.transfer_id):await reviewCashout(actor.id,id,body.action,String(body.reason||"").slice(0,1000)));
  } catch(error) { return financeResponse(error); }
}
