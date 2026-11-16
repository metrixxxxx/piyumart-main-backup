import "server-only";
import { randomBytes,createCipheriv,createDecipheriv,createHash } from "node:crypto";
import { getMarketplaceAccount } from "@/lib/seller-access";
import { getBaoAccess } from "@/lib/bao-access";
import { paymentError } from "@/lib/payments/paymongo";

export async function requireBuyer() {
  const user=await getMarketplaceAccount();
  if (!user) throw paymentError("Please sign in.",401);
  if (!["user","seller"].includes(user.role)||user.status!=="active") throw paymentError("Forbidden.",403);
  return user;
}
export async function requireSeller() {
  const user=await requireBuyer();
  if(user.role!=="seller") throw paymentError("A seller account is required.",403);
  return user;
}
export async function requireFinance(adminOnly=false) {
  const access=await getBaoAccess();
  if(!access.session) throw paymentError("Staff access is required.",access.status);
  if(adminOnly&&access.session.user.role!=="admin") throw paymentError("Admin access is required.",403);
  return access.session.user;
}
function encryptionKey() {
  if(!/^[a-f0-9]{64}$/i.test(process.env.WALLET_ENCRYPTION_KEY||"")) throw paymentError("Payout destination encryption is not configured.",503);
  return Buffer.from(process.env.WALLET_ENCRYPTION_KEY,"hex");
}
export function encryptAccount(value) {
  const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",encryptionKey(),iv);
  return [iv,cipher.update(value,"utf8"),cipher.final(),cipher.getAuthTag()].map(part=>part.toString("base64url")).join(".");
}
export function decryptAccount(value) {
  const [iv,body,tail,tag]=value.split(".").map(part=>Buffer.from(part,"base64url"));
  const cipher=createDecipheriv("aes-256-gcm",encryptionKey(),iv);cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(body),cipher.update(tail),cipher.final()]).toString("utf8");
}
export function fingerprint(value) { return createHash("sha256").update(value).digest("hex"); }
export function uuid(value) { if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value||"")) throw paymentError("A valid request ID is required."); return value; }
export function financeResponse(error) {
  console.error("Financial request failed:",error);
  const status=error.status||(error instanceof SyntaxError?400:500);
  return Response.json({error:status===500?"Unable to process the financial request.":error.message},{status});
}
