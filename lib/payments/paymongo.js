import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export function paymentError(message, status=400) { return Object.assign(new Error(message),{status}); }
export function testKey() {
  const key=process.env.PAYMONGO_SECRET_KEY;
  if (!key?.startsWith("sk_test_")) throw paymentError("PayMongo test payments are not configured. Ask the administrator to add a test secret key.",503);
  return key;
}
export function paymentMethods() {
  const methods=(process.env.PAYMONGO_PAYMENT_METHODS||"card,gcash,paymaya,qrph").split(",").map(value=>value.trim());
  if (!methods.length||methods.some(value=>!["card","gcash","paymaya","qrph"].includes(value))) throw paymentError("Invalid payment method configuration.",503);
  return [...new Set(methods)];
}
export function applicationUrl() {
  const url=new URL(process.env.APP_URL||process.env.NEXTAUTH_URL||"http://localhost:3000");
  if (url.protocol!=="https:"&&!(["localhost","127.0.0.1"].includes(url.hostname)&&url.protocol==="http:")) throw paymentError("Configure an HTTPS APP_URL.",503);
  return url.origin;
}
export async function paymongo(path,{method="GET",attributes}={}) {
  if (!/^\/v[12]\/[a-z_]+(?:\/[A-Za-z0-9_-]+)*$/.test(path)) throw new Error("Invalid PayMongo API path.");
  let response;
  try {
    response=await fetch(`https://api.paymongo.com${path}`,{
      method, headers:{Authorization:`Basic ${Buffer.from(`${testKey()}:`).toString("base64")}`,"Content-Type":"application/json",Accept:"application/json"},
      ...(attributes?{body:JSON.stringify({data:{attributes}})}:{}),signal:AbortSignal.timeout(15000),cache:"no-store",
    });
  } catch(error) {
    if (error.status) throw error;
    throw paymentError("The payment provider could not be reached. The payment requires reconciliation before another attempt.",502);
  }
  const body=await response.json();
  if (!response.ok) {
    const code=body.errors?.[0]?.code||"provider_error";
    throw Object.assign(paymentError(`PayMongo rejected the request (${code}).`,response.status>=500?502:422),{providerCode:code});
  }
  if (body.data?.attributes?.livemode===true) throw paymentError("Live financial transactions are disabled.",503);
  return body.data;
}
export function verifySignature(raw,signature,now=Date.now()) {
  const secret=process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!secret) throw paymentError("Payment webhook is not configured.",503);
  const parts=Object.fromEntries(String(signature||"").split(",").map(part=>part.trim().split("=")));
  if (!/^\d+$/.test(parts.t||"")||!/^[a-f0-9]{64}$/i.test(parts.te||"")||Math.abs(now/1000-Number(parts.t))>300) throw paymentError("Invalid webhook signature.",400);
  const expected=createHmac("sha256",secret).update(`${parts.t}.${raw}`).digest();
  const supplied=Buffer.from(parts.te,"hex");
  if (supplied.length!==expected.length||!timingSafeEqual(supplied,expected)) throw paymentError("Invalid webhook signature.",400);
}
