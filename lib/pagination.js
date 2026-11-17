export function paginationError(message) { return Object.assign(new Error(message), { status: 400 }); }
export function readPagination(req, { defaultSize = 20, maxSize = 48 } = {}) {
  const params = new URL(req?.url || "http://localhost").searchParams;
  function positive(name, fallback) {
    const raw = params.get(name);
    if (raw === null) return fallback;
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) < 1) throw paginationError(`Invalid ${name}.`);
    return Number(raw);
  }
  const page = positive("page", 1), pageSize = Math.min(positive("pageSize", defaultSize), maxSize);
  if (page > 100000) throw paginationError("Page is too large.");
  return { page, pageSize, offset: (page - 1) * pageSize };
}
export function pageHeaders(paging, total, extra = {}) {
  return { "Cache-Control": "private, no-store", "X-Page": String(paging.page), "X-Page-Size": String(paging.pageSize),
    "X-Total-Count": String(total), "X-Total-Pages": String(Math.max(1, Math.ceil(total / paging.pageSize))), ...extra };
}
export function readPageHeaders(response) {
  const number = (name, fallback) => Number(response.headers.get(name)) || fallback;
  return { page: number("x-page", 1), pageSize: number("x-page-size", 20), total: number("x-total-count", 0), totalPages: number("x-total-pages", 1) };
}
export function positiveFilter(value, name) {
  if (value === null || value === undefined || value === "") return null;
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value)>2147483647) throw paginationError(`Invalid ${name}.`);
  return Number(value);
}
export function orderStatus(value) {
  if (!value || value === "all") return null;
  if (!["pending", "confirmed", "processing", "shipped", "completed", "cancelled"].includes(value)) throw paginationError("Invalid order status.");
  return value;
}
