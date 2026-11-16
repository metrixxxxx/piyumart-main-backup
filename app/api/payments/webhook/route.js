import { verifySignature } from "@/lib/payments/paymongo";
import { financeResponse } from "@/lib/payments/security";
import { processPaymentEvent } from "@/lib/payments/events";
export async function POST(req) {
  try {
    const raw=await req.text();
    if(Buffer.byteLength(raw)>1024*1024) return Response.json({error:"Payload too large."},{status:413});
    verifySignature(raw,req.headers.get("paymongo-signature"));
    return Response.json(await processPaymentEvent(JSON.parse(raw).data,raw));
  } catch(error) { return financeResponse(error); }
}
