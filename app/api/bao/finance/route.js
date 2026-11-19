import { db } from "@/lib/db";
import { requireFinance,financeResponse } from "@/lib/payments/security";
import { financeDashboard } from "@/lib/payments/wallet";
import { cents,pesos } from "@/lib/payments/money";
import { paymentError } from "@/lib/payments/paymongo";
import { financeLock,currentActor,auditFinance } from "@/lib/payments/ledger";
export async function GET() {
  try { const actor=await requireFinance();return Response.json({...await financeDashboard(),actorId:actor.id,canEditSettings:true},{headers:{"Cache-Control":"private, no-store"}}); }
  catch(error) { return financeResponse(error); }
}
export async function PATCH(req) {
  try {
    const actor=await requireFinance(),body=await req.json();
    let minimum;try{minimum=cents(body.minimum_cashout);}catch(error){throw paymentError(error.message);}
    if(minimum<1||!["buyer_confirmation","payment_confirmed"].includes(body.release_policy)) throw paymentError("Invalid minimum cashout or release policy.");
    await db.transaction(async client=>{
      await financeLock(client);await currentActor(client,actor.id,["bao"]);
      await client.query("UPDATE finance_settings SET minimum_cashout=$1,release_policy=$2,updated_by=$3,updated_at=now() WHERE id=true",[pesos(minimum),body.release_policy,actor.id]);
      await auditFinance(client,actor.id,"finance_settings_updated","finance_settings","default",`Minimum cashout PHP ${pesos(minimum)}; release policy ${body.release_policy}`);
    });return Response.json({success:true});
  } catch(error) { return financeResponse(error); }
}
