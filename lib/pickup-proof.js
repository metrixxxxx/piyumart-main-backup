import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { validatePickupProofFile } from "@/lib/orders/pickup-proof-policy";

export const PICKUP_PROOF_BUCKET = "pickup-proofs";

export function getPickupProofStorage() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw Object.assign(new Error("Proof photo storage is unavailable. Please try again later."), { status: 503 });
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }).storage;
}

export async function readPickupProof(file) {
  const error = validatePickupProofFile(file);
  if (error) throw Object.assign(new Error(error), { status: 400 });
  const bytes = Buffer.from(await file.arrayBuffer());
  const jpeg = bytes.length > 12 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.length > 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp = bytes.length > 16 && bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
  const extension = file.type === "image/jpeg" && jpeg ? "jpg"
    : file.type === "image/png" && png ? "png" : file.type === "image/webp" && webp ? "webp" : null;
  if (!extension) throw Object.assign(new Error("The file content does not match a JPG, PNG, or WebP photo."), { status: 400 });
  return { bytes, extension };
}

export async function removePickupProof(upload) {
  if (!upload) return;
  try {
    const { error } = await upload.bucket.remove([upload.path]);
    if (error) console.error("Proof photo cleanup failed:", error);
  } catch (error) { console.error("Proof photo cleanup failed:", error); }
}

export async function uploadPickupProof(orderId, file) {
  const { bytes, extension } = await readPickupProof(file);
  const upload = { bucket: getPickupProofStorage().from(PICKUP_PROOF_BUCKET), path: `${orderId}/${randomUUID()}.${extension}` };
  try {
    const { error } = await upload.bucket.upload(upload.path, bytes, { contentType: file.type, upsert: false, cacheControl: "0" });
    if (error) throw Object.assign(new Error("Unable to upload the proof photo. Please try again."), { status: 503 });
    return upload;
  } catch (error) {
    await removePickupProof(upload);
    throw error;
  }
}

export async function pickupProofResponse(order) {
  if (!order?.pickup_proof_path) return Response.json({ error: "No proof photo is saved for this order." }, { status: 404 });
  const path = order.pickup_proof_path;
  if (!new RegExp(`^${order.id}/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\\.(jpg|png|webp)$`, "i").test(path)) {
    return Response.json({ error: "Invalid proof photo reference." }, { status: 409 });
  }
  const { data, error } = await getPickupProofStorage().from(PICKUP_PROOF_BUCKET).createSignedUrl(path, 60);
  if (error || !data?.signedUrl) throw new Error("Unable to open the proof photo.");
  return Response.json({ url: data.signedUrl, expiresIn: 60 }, {
    headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
  });
}
