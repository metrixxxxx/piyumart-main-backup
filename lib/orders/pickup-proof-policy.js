export const PICKUP_PROOF_MAX_BYTES = 5 * 1024 * 1024;
export const PICKUP_PROOF_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validatePickupProofFile(file) {
  if (!file || typeof file.arrayBuffer !== "function" || !file.size) {
    return "Upload a photo of the received items before completing this order.";
  }
  if (!PICKUP_PROOF_TYPES.includes(file.type)) return "Choose a JPG, PNG, or WebP photo.";
  if (file.size > PICKUP_PROOF_MAX_BYTES) return "Proof photos must be 5 MB or smaller.";
  return "";
}
