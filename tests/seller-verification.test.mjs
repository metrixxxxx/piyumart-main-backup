// Run: node --experimental-vm-modules --test tests/seller-verification.test.mjs
// Isolated boundary tests: no live credentials, database, or Storage writes.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SourceTextModule, SyntheticModule, createContext } from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
async function load(file, overrides = {}) {
  const context = createContext({ Buffer, Response, Request, FormData, File, URL, process: { env: {} }, console: { error() {} } });
  const cache = new Map();
  const mocks = {
    "server-only": {},
    "next/cache": { unstable_cache: fn => fn, revalidateTag() {} },
    "next-auth": { getServerSession: async () => ({ user: { id: "7", role: "seller" } }) },
    "next-auth/next": { getServerSession: async () => ({ user: { id: "7", role: "seller" } }) },
    "@/lib/authOptions": { authOptions: {} },
    "@/app/api/auth/[...nextauth]/route": { authOptions: {} },
    "next/server": { NextResponse: Response },
    "@/lib/savefile": { saveFile: async () => { throw new Error("Unexpected public upload"); } },
    ...overrides,
  };
  async function moduleFor(specifier, parent = root) {
    const isMock = Object.hasOwn(mocks, specifier);
    const key = isMock ? specifier : specifier.startsWith("@/") ? path.join(root, specifier.slice(2)) : specifier.startsWith(".") ? path.resolve(parent, specifier) : specifier;
    const resolved = isMock || key.startsWith("node:") ? key : path.extname(key) ? key : `${key}.js`;
    if (cache.has(resolved)) return cache.get(resolved);
    if (isMock || resolved.startsWith("node:")) {
      const exports = isMock ? mocks[specifier] : await import(resolved);
      const mod = new SyntheticModule(Object.keys(exports), function () { for (const [name, value] of Object.entries(exports)) this.setExport(name, value); }, { context });
      cache.set(resolved, mod);
      return mod;
    }
    const mod = new SourceTextModule(await readFile(resolved, "utf8"), { context, identifier: resolved });
    cache.set(resolved, mod);
    await mod.link((child) => moduleFor(child, path.dirname(resolved)));
    return mod;
  }
  const mod = await moduleFor(path.join(root, file));
  await mod.evaluate();
  return mod.namespace;
}

const noBody = { formData() { throw new Error("Must deny before reading the body"); }, json() { throw new Error("Must deny before reading the body"); } };
for (const role of ["user", "bao", "admin"]) {
  test(`${role} cannot bypass seller APIs with a seller role in their token`, async () => {
    const calls = [];
    const db = { query: async (sql) => { calls.push(sql); return [[{ role, status: "active" }]]; } };
    const sell = await load("app/api/sell/route.js", { "@/lib/db": { db } });
    for (const method of ["GET", "POST", "PUT", "DELETE"]) assert.equal((await sell[method](noBody)).status, 403);
    const listings = await load("app/api/my-listings/[id]/route.js", { "@/lib/db": { db } });
    for (const method of ["PATCH", "DELETE"]) assert.equal((await listings[method](noBody, { params: Promise.resolve({ id: "1" }) })).status, 403);
    assert.ok(calls.every((sql) => sql.startsWith("SELECT role, status FROM users")));
  });
}

test("a suspended seller cannot publish", async () => {
  const api = await load("app/api/sell/route.js", { "@/lib/db": { db: { query: async () => [[{ role: "seller", status: "suspended" }]] } } });
  assert.equal((await api.POST(noBody)).status, 403);
});

test("listing validation rejects empty meetup points; server copies the seller's department", async () => {
  let inserted;
  const db = { query: async (sql, values) => {
    if (sql.startsWith("SELECT role")) return [[{ role: "seller", status: "active" }]];
    if (sql.startsWith("SELECT name")) return [[{ name: "Seller", department: "CCS" }]];
    if (sql.includes("INSERT INTO products")) { inserted = values; return [[{ id: "99" }]]; }
    throw new Error(`Unexpected query ${sql}`);
  } };
  const api = await load("app/api/sell/route.js", { "@/lib/db": { db } });
  for (const point of ["", "  ", "Other", "a".repeat(201)]) {
    const form = new FormData(); form.set("meetup_point", point);
    assert.equal((await api.POST({ formData: async () => form })).status, 400);
    assert.equal((await api.PUT({ formData: async () => form })).status, 400);
  }
  const form = new FormData();
  for (const [key, value] of Object.entries({ name: "Notebook", price: "50", stock: "2", meetup_point: " Library ", department: "Forged", seller_id: "999" })) form.set(key, value);
  assert.equal((await api.POST({ formData: async () => form })).status, 200);
  assert.equal(inserted[4], "7");
  assert.equal(inserted[11], "CCS");
  assert.equal(inserted[12], "Library");
});

test("proof files validate size, extension, MIME type, and signature", async () => {
  const proof = await load("lib/seller-proof.js", { "@supabase/supabase-js": { createClient() {} } });
  const valid = new File([Buffer.from([137,80,78,71,13,10,26,10])], "id.png", { type: "image/png" });
  assert.equal((await proof.readProof(valid)).extension, "png");
  for (const file of [null, new File([], "empty.png", { type: "image/png" }), new File(["<html>"], "fake.png", { type: "image/png" }), new File(["text"], "id.exe", { type: "application/pdf" }), new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", { type: "image/png" })]) {
    await assert.rejects(proof.readProof(file), (error) => error.status === 400);
  }
});

for (const denied of [401, 403]) {
  test(`review and proof endpoints deny ${denied} before database/storage access`, async () => {
    const overrides = {
      "@/lib/bao-access": { getBaoAccess: async () => ({ session: null, status: denied }) },
      "@/lib/db": { db: { query() { throw new Error("Unexpected database access"); } } },
      "@/lib/seller-proof": { getProofStorage() { throw new Error("Unexpected Storage access"); }, SELLER_PROOF_BUCKET: "seller-proofs" },
      "@/lib/seller-applications": { reviewSellerApplication() { throw new Error("Unexpected review"); } },
    };
    for (const [file, method] of [["app/api/bao/seller-applications/route.js", "GET"], ["app/api/bao/seller-applications/[id]/route.js", "PATCH"], ["app/api/bao/seller-applications/[id]/proof/route.js", "GET"]]) {
      const api = await load(file, overrides);
      assert.equal((await api[method](noBody, { params: Promise.resolve({ id: "1" }) })).status, denied);
    }
  });
}

test("proof links use the stored key, expire in 60 seconds, and are not cached", async () => {
  let signed;
  const api = await load("app/api/bao/seller-applications/[id]/proof/route.js", {
    "@/lib/bao-access": { getBaoAccess: async () => ({ session: { user: { id: "1", role: "bao" } } }) },
    "@/lib/db": { db: { query: async () => [[{ user_id: "7", id_proof_url: "7/random.png" }]] } },
    "@/lib/seller-proof": { SELLER_PROOF_BUCKET: "seller-proofs", getProofStorage: () => ({ from: (bucket) => ({ createSignedUrl: async (key, expiry) => { signed = { bucket, key, expiry }; return { data: { signedUrl: "https://storage.example/signed" } }; } }) }) },
  });
  const response = await api.GET(noBody, { params: Promise.resolve({ id: "82bfb230-0597-4bf5-9ead-ae37e562b34f" }) });
  assert.equal(response.status, 200);
  assert.deepEqual(signed, { bucket: "seller-proofs", key: "7/random.png", expiry: 60 });
  assert.match(response.headers.get("Cache-Control"), /no-store/);
});

test("the buyer's application status query is scoped to the session and omits private proof keys", async () => {
  const api = await load("app/api/seller-applications/route.js", {
    "@/lib/seller-access": { getMarketplaceAccount: async () => ({ id: "7", role: "user", status: "active" }) },
    "@/lib/db": { db: { query: async (sql, values) => { assert.deepEqual([...values], ["7"]); assert.ok(!sql.includes("id_proof_url")); return [[{ id: "4", status: "pending" }]]; } } },
    "@/lib/seller-applications": { applicationError() {} },
    "@/lib/seller-proof": { getProofStorage() {}, readProof() {}, SELLER_PROOF_BUCKET: "seller-proofs" },
  });
  const response = await api.GET();
  assert.equal(response.status, 200);
  assert.ok(!JSON.stringify(await response.json()).includes("id_proof_url"));
});

test("the review route rejects a blank rejection reason before running a transaction", async () => {
  const api = await load("app/api/bao/seller-applications/[id]/route.js", {
    "@/lib/bao-access": { getBaoAccess: async () => ({ session: { user: { id: "1", role: "bao" } } }) },
    "@/lib/seller-applications": { reviewSellerApplication() { throw new Error("Unexpected review"); } },
  });
  const response = await api.PATCH({ json: async () => ({ action: "reject", reason: " " }) }, { params: Promise.resolve({ id: "4" }) });
  assert.equal(response.status, 400);
});

test("concurrent submissions allow one pending application and one private upload", async () => {
  const applications = [];
  const uploads = [];
  let serial = Promise.resolve();
  const db = { transaction: (callback) => {
    const next = serial.then(() => callback({ query: async (sql, values) => {
      if (sql.startsWith("SELECT role")) return { rows: [{ role: "user", status: "active" }] };
      if (sql.startsWith("SELECT id")) return { rows: [...applications] };
      if (sql.includes("INSERT INTO seller_applications")) { const row = { id: "4", status: "pending", department: values[1] }; applications.push(row); return { rows: [row] }; }
      throw new Error("Unexpected query");
    } }));
    serial = next.catch(() => {});
    return next;
  } };
  const campus = await load("lib/campus.js");
  const api = await load("app/api/seller-applications/route.js", {
    "@/lib/db": { db },
    "@/lib/seller-access": { getMarketplaceAccount: async () => ({ id: "7", role: "user", status: "active" }) },
    "@/lib/seller-applications": { applicationError: (message, status) => Object.assign(new Error(message), { status }) },
    "@/lib/seller-proof": { SELLER_PROOF_BUCKET: "seller-proofs", readProof: async () => ({ bytes: Buffer.from("proof"), extension: "png" }), getProofStorage: () => ({ from: () => ({ upload: async (key) => { uploads.push(key); return {}; } }) }) },
  });
  const req = () => { const form = new FormData(); form.set("department", campus.LSPU_DEPARTMENTS[0]); form.set("note", "Optional note"); form.set("id_proof", new File(["proof"], "id.png", { type: "image/png" })); return { formData: async () => form }; };
  const responses = await Promise.all([api.POST(req()), api.POST(req())]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
  assert.equal(uploads.length, 1);
  assert.match(uploads[0], /^7\/.+\.png$/);
  assert.equal(applications.length, 1);
});

function reviewHarness({ failAt, actorRole = "bao", status = "pending" } = {}) {
  let state = { role: "user", department: null, status, notifications: [], audits: [] };
  let before;
  let released = false;
  const sqlLog = [];
  const broadcasts = [];
  const client = { release() { released = true; }, query: async (sql, values) => {
    sqlLog.push(sql);
    if (sql === "BEGIN") before = structuredClone(state);
    if (sql === "ROLLBACK") state = before;
    if (failAt && sql.includes(failAt)) throw new Error("Injected failure");
    if (sql.includes("FOR SHARE")) return { rows: [{ role: actorRole, status: "active" }] };
    if (sql.includes("FROM seller_applications")) return { rows: [{ user_id: "7", department: "CCS", status: state.status }] };
    if (sql.includes("FROM users")) return { rows: [{ role: state.role, status: "active" }] };
    if (sql.includes("UPDATE seller_applications")) state.status = values[0];
    if (sql.includes("UPDATE users")) { state.role = "seller"; state.department = values[0]; }
    if (sql.includes("INSERT INTO notifications")) { const row = { id: "1", user_id: values[0], message: values[2] }; state.notifications.push(row); return { rows: [row] }; }
    if (sql.includes("INSERT INTO bao_audit_logs")) state.audits.push(values);
    return { rows: [] };
  } };
  return { overrides: {
    pg: { default: { Pool: class { on() {} connect() { return client; } }, types: { setTypeParser() {} } } },
    "@/lib/supabase": { supabaseAdmin: { channel: () => ({ send: async (payload) => { assert.ok(sqlLog.includes("COMMIT")); broadcasts.push(payload); } }) } },
  }, state: () => state, sqlLog, broadcasts, released: () => released };
}

for (const actorRole of ["bao", "admin"]) {
  test(`${actorRole} approval commits application, role, department, notification, and audit together`, async () => {
    const harness = reviewHarness({ actorRole });
    const service = await load("lib/seller-applications.js", harness.overrides);
    assert.equal((await service.reviewSellerApplication({ id: "4", actorId: "1", action: "approve" })).status, "approved");
    assert.equal(harness.state().role, "seller");
    assert.equal(harness.state().department, "CCS");
    assert.equal(harness.state().notifications.length, 1);
    assert.equal(harness.state().audits.length, 1);
    assert.equal(harness.broadcasts.length, 1);
    assert.ok(harness.sqlLog.includes("COMMIT"));
    assert.ok(harness.released());
  });
}

for (const failAt of ["INSERT INTO notifications", "INSERT INTO bao_audit_logs"]) {
  test(`${failAt} failure rolls back the approval and role change`, async () => {
    const harness = reviewHarness({ failAt });
    const service = await load("lib/seller-applications.js", harness.overrides);
    await assert.rejects(service.reviewSellerApplication({ id: "4", actorId: "1", action: "approve" }));
    assert.deepEqual(harness.state(), { role: "user", department: null, status: "pending", notifications: [], audits: [] });
    assert.ok(harness.sqlLog.includes("ROLLBACK"));
    assert.ok(!harness.sqlLog.includes("COMMIT"));
    assert.equal(harness.broadcasts.length, 0);
    assert.ok(harness.released());
  });
}

test("rejection requires remarks, retains buyer role, and records a notification and audit", async () => {
  const harness = reviewHarness();
  const service = await load("lib/seller-applications.js", harness.overrides);
  await assert.rejects(service.reviewSellerApplication({ id: "4", actorId: "1", action: "reject", reason: " " }), (err) => err.status === 400);
  await service.reviewSellerApplication({ id: "4", actorId: "1", action: "reject", reason: "Unclear ID" });
  assert.equal(harness.state().role, "user");
  assert.equal(harness.state().status, "rejected");
  assert.match(harness.state().notifications[0].message, /Unclear ID/);
  assert.equal(harness.state().audits[0][3], "Unclear ID");
});

test("already reviewed applications and a reviewer whose role changed are denied", async () => {
  for (const options of [{ status: "approved" }, { actorRole: "user" }]) {
    const harness = reviewHarness(options);
    const service = await load("lib/seller-applications.js", harness.overrides);
    await assert.rejects(service.reviewSellerApplication({ id: "4", actorId: "1", action: "approve" }), (err) => err.status === (options.actorRole ? 403 : 409));
    assert.equal(harness.state().audits.length, 0);
    assert.equal(harness.state().notifications.length, 0);
  }
});
