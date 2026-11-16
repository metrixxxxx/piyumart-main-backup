import "server-only";

import { createClient } from "@supabase/supabase-js";
import { validateProofFile } from "@/lib/campus";

export const SELLER_PROOF_BUCKET = "seller-proofs";

export function getProofStorage() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("Seller verification storage is not configured.");
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  ).storage;
}

export async function readProof(file) {
  const error = validateProofFile(file);
  if (error) throw Object.assign(new Error(error), { status: 400 });
  const bytes = Buffer.from(await file.arrayBuffer());
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const pdf = bytes.subarray(0, 5).toString() === "%PDF-";
  const valid = (file.type === "image/jpeg" && jpeg && /\.jpe?g$/i.test(file.name)) ||
    (file.type === "image/png" && png && /\.png$/i.test(file.name)) ||
    (file.type === "application/pdf" && pdf && /\.pdf$/i.test(file.name));
  if (!valid) throw Object.assign(new Error("The file content does not match its JPG, PNG, or PDF type."), { status: 400 });
  return { bytes, extension: jpeg ? "jpg" : png ? "png" : "pdf" };
}
