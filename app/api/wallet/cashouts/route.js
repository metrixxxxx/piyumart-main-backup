import { requireSeller,financeResponse } from "@/lib/payments/security";
import { requestCashout } from "@/lib/payments/wallet";
export async function POST(req){try{const user=await requireSeller();return Response.json(await requestCashout(user.id,await req.json(),req.headers.get("Idempotency-Key")),{status:201});}catch(error){return financeResponse(error);}}
