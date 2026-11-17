"use client";
let categories, expires = 0, pending;
export function getCategories() {
  if (categories && Date.now() < expires) return Promise.resolve(categories);
  if (pending) return pending;
  pending = fetch("/api/categories").then(async response => {
    if (!response.ok) throw new Error("Unable to load categories.");
    const data = await response.json();
    categories = Array.isArray(data) ? data : []; expires = Date.now() + 60000;
    return categories;
  }).finally(() => { pending = null; });
  return pending;
}
