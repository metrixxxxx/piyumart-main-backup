import { requireFinance,financeResponse } from "@/lib/payments/security";
import { addCommissionDestination } from "@/lib/payments/wallet";

export async function POST(req) {
  try {
    const actor=await requireFinance();
    return Response.json(await addCommissionDestination(actor.id,await req.json()),{status:201});
  } catch(error) { return financeResponse(error); }
}
