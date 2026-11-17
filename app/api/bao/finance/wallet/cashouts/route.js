import { requireFinance,financeResponse } from "@/lib/payments/security";
import { requestCommissionCashout } from "@/lib/payments/wallet";

export async function POST(req) {
  try {
    const actor=await requireFinance();
    return Response.json(await requestCommissionCashout(actor.id,await req.json(),req.headers.get("Idempotency-Key")),{status:201});
  } catch(error) { return financeResponse(error); }
}
