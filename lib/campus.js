// Edit these lists when departments or campus meetup locations change.
// College names: https://lspu.edu.ph/academic_colleges
export const LSPU_DEPARTMENTS = [
  "CONAH",
  "CA",
  "COF",
  "CFND",
  "COL",
];

export const MEETUP_POINTS = ["Main Gate", "Library", "Canteen", "Admin Building"];
export const MAX_PROOF_SIZE = 5 * 1024 * 1024;
export const PROOF_TYPES = ["image/jpeg", "image/png", "application/pdf"];
export const SELLER_DOCUMENTS = [
  { field: "id_proof", label: "Student ID" },
  { field: "cor_proof", label: "Certificate of Registration (COR)" },
];

export function validateProofFile(file, label = "Document") {
  if (!file || typeof file.arrayBuffer !== "function" || file.size === 0) {
    return `${label} is required.`;
  }
  if (file.size > MAX_PROOF_SIZE) return `${label} must be 5 MB or smaller.`;
  if (!PROOF_TYPES.includes(file.type) || !/\.(jpe?g|png|pdf)$/i.test(file.name || "")) {
    return `Upload ${label} as a JPG, PNG, or PDF file.`;
  }
  return null;
}

export function normalizeMeetupPoint(value) {
  if (typeof value !== "string") return null;
  const point = value.trim();
  return point && point !== "Other" && point.length <= 200 ? point : null;
}
