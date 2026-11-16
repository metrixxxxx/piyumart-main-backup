import { requireSeller,financeResponse } from "@/lib/payments/security";
import { sellerWallet } from "@/lib/payments/wallet";
export async function GET() {
  try { const user=await requireSeller();return Response.json(await sellerWallet(user.id),{headers:{"Cache-Control":"private, no-store"}}); }
  catch(error) { return financeResponse(error); }
}
