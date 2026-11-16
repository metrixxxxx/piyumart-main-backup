// Run with the local dev server running: node tests/seller-verification-smoke.mjs
import assert from "node:assert/strict";

const base = "http://localhost:3000";
for (const [path, method, expected] of [
  ["/login", "GET", 200],
  ["/sell", "GET", 307],
  ["/api/sell", "GET", 401],
  ["/api/sell", "POST", 401],
  ["/api/sell", "PUT", 401],
  ["/api/sell", "DELETE", 401],
  ["/api/my-listings/1", "PATCH", 401],
  ["/api/my-listings/1", "DELETE", 401],
  ["/api/seller-applications", "GET", 401],
  ["/api/seller-applications", "POST", 401],
  ["/api/bao/seller-applications", "GET", 401],
  ["/api/bao/seller-applications/1", "PATCH", 401],
  ["/api/bao/seller-applications/1/proof", "GET", 401],
]) {
  const response = await fetch(`${base}${path}`, { method, redirect: "manual" });
  if (path === "/sell" && response.status === 200) {
    // Next.js may have started streaming the layout before the page redirects.
    assert.match(await response.text(), /<meta[^>]*http-equiv="refresh"[^>]*content="[^"]*url=\/login"/i);
  } else {
    assert.equal(response.status, expected, `${method} ${path}`);
    if (path === "/sell") assert.equal(new URL(response.headers.get("location"), base).pathname, "/login");
  }
  console.log(`PASS ${method} ${path}: ${response.status}`);
}
