import test from "node:test";
import assert from "node:assert/strict";
import { loadFinanceModule } from "./helpers/load-finance-module.mjs";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO1kAAAAASUVORK5CYII=", "base64");
const photo = () => new File([png], "pickup.png", { type: "image/png" });
const params = { params: Promise.resolve({ id: "12" }) };
const noDb = { query() { throw new Error("Unexpected database access"); } };

test("pickup proof requires a nonempty photo with a supported type, size, and content", async () => {
  const proof = await loadFinanceModule("lib/pickup-proof.js");
  assert.equal((await proof.readPickupProof(photo())).extension, "png");
  for (const file of [null, "https://example.com/proof.png", new File([], "empty.png", { type: "image/png" }),
    new File([png], "document.pdf", { type: "application/pdf" }),
    new File(["not an image"], "fake.jpg", { type: "image/jpeg" }),
    new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", { type: "image/png" })]) {
    await assert.rejects(proof.readPickupProof(file), error => error.status === 400);
  }
});

test("anonymous and inactive users cannot read pickup photos or submit completion", async () => {
  for (const account of [null, { id: 1, role: "user", status: "suspended" }]) {
    const route = await loadFinanceModule("app/api/orders/[id]/pickup-proof/route.js", { db: noDb, account });
    assert.equal((await route.GET(null, params)).status, account ? 403 : 401);
  }
  const completion = await loadFinanceModule("app/api/orders/[id]/route.js", { db: noDb });
  assert.equal((await completion.PATCH(null, params)).status, 401);
  const staff = await loadFinanceModule("app/api/bao/orders/[id]/pickup-proof/route.js", { db: noDb, account: { id: 1 } });
  assert.equal((await staff.GET(null, params)).status, 401);
});

test("completion rejects oversized and malformed requests before database or Storage access", async () => {
  const route = await loadFinanceModule("app/api/orders/[id]/route.js", { db: noDb, account: { id: 1 } });
  assert.equal((await route.PATCH(new Request("http://localhost/api/orders/12", {
    method: "PATCH", body: "{}", headers: { "Content-Length": String(7 * 1024 * 1024) },
  }), params)).status, 413);
  assert.equal((await route.PATCH(new Request("http://localhost/api/orders/12", { method: "PATCH", body: "not json" }), params)).status, 400);
});

test("pickup photo links use the authorized order's private key and expire after 60 seconds", async () => {
  let signed;
  const path = "12/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.png";
  const proof = await loadFinanceModule("lib/pickup-proof.js", {
    env: { NEXT_PUBLIC_SUPABASE_URL: "https://storage.example", SUPABASE_SERVICE_ROLE_KEY: "fixture" },
    moduleMocks: { "@supabase/supabase-js": { createClient: () => ({ storage: { from: bucket => ({
      createSignedUrl: async (key, expires) => { signed = { bucket, key, expires }; return { data: { signedUrl: "https://storage.example/signed" } }; },
    }) } }) } },
  });
  const response = await proof.pickupProofResponse({ id: 12, pickup_proof_path: path });
  assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.deepEqual(signed, { bucket: "pickup-proofs", key: path, expires: 60 });
  signed = null;
  for (const key of ["13/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.png", "12/../private.png", "https://example.com/proof.png"]) {
    assert.equal((await proof.pickupProofResponse({ id: 12, pickup_proof_path: key })).status, 409);
  }
  assert.equal(signed, null);
  assert.equal((await proof.pickupProofResponse({ id: 12 })).status, 404);
});
