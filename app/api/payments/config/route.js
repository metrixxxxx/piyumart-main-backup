import { paymentMethods } from "@/lib/payments/paymongo";
export async function GET() {
  try { return Response.json({mode:"test",enabled:process.env.PAYMONGO_SECRET_KEY?.startsWith("sk_test_")===true,methods:paymentMethods()}); }
  catch { return Response.json({mode:"test",enabled:false,methods:[]}); }
}
