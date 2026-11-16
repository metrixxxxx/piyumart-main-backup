import { requireFinance,financeResponse } from "@/lib/payments/security";
import { reviewDestination } from "@/lib/payments/wallet";
export async function PATCH(req,{params}) {
  try { const actor=await requireFinance(),{id}=await params,body=await req.json();return Response.json(await reviewDestination(actor.id,id,body.action,String(body.reason||"").slice(0,1000))); }
  catch(error) { return financeResponse(error); }
}
