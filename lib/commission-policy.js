// Thresholds use integer centavos and apply to each item's unit price.
export const BAO_COMMISSION_TIERS = [
  { upTo: 50000, percentage: 0, label: "Up to ₱500" },
  { upTo: 500000, percentage: 3, label: "Above ₱500 through ₱5,000" },
  { upTo: null, percentage: 5, label: "Above ₱5,000" },
];

export const BAO_COMMISSION_DESCRIPTION =
  "BAO commission per item: 0% through ₱500, 3% above ₱500 through ₱5,000, and 5% above ₱5,000.";

export function baoCommissionRate(unitPrice) {
  if (!Number.isSafeInteger(unitPrice) || unitPrice < 0) {
    throw new Error("Invalid item price in centavos.");
  }
  return BAO_COMMISSION_TIERS.find(tier => tier.upTo === null || unitPrice <= tier.upTo).percentage;
}
