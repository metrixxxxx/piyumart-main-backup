export const ORDER_STEPS = ["pending", "preparing", "ready_for_pickup", "completed"];

export const ORDER_STATUS_LABELS = {
  pending: "Pending",
  preparing: "Preparing your order",
  ready_for_pickup: "Ready for pickup",
  completed: "Completed",
  cancelled: "Cancelled",
};

const previousStatuses = {
  confirmed: "preparing",
  processing: "preparing",
  shipped: "ready_for_pickup",
};

export function normalizeOrderStatus(status) {
  return Object.hasOwn(previousStatuses, status) ? previousStatuses[status] : status;
}

export function orderStatusLabel(status) {
  return ORDER_STATUS_LABELS[normalizeOrderStatus(status)] || status || "Unknown";
}

export function storedOrderStatuses(status) {
  if (!status) return null;
  return [status, ...Object.keys(previousStatuses).filter(key => previousStatuses[key] === status)];
}
