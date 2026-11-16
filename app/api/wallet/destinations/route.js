import { requireSeller,financeResponse } from "@/lib/payments/security";
import { addDestination } from "@/lib/payments/wallet";
export async function POST(req){try{const user=await requireSeller();return Response.json(await addDestination(user.id,await req.json()),{status:201});}catch(error){return financeResponse(error);}}
