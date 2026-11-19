// All database writes use a temporary schema. Photo Storage and payments are mocked.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import dotenv from "dotenv";
import { loadFinanceModule } from "./helpers/load-finance-module.mjs";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO1kAAAAASUVORK5CYII=", "base64");
const photo = () => new File([png], "pickup.png", { type: "image/png" });

test("cash and online order completion require private photo proof", {
  skip: process.env.PIYUMART_FINANCE_DB_TEST !== "1",
}, async t => {
  dotenv.config({ path: ".env.local", quiet: true });
  const schema = `piyumart_pickup_test_${randomUUID().replaceAll("-", "")}`;
  assert.match(schema, /^piyumart_pickup_test_[a-f0-9]{32}$/);
  const config = { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000, query_timeout: 15000 };
  const control = new pg.Pool(config);
  let pool, created = false;
  try {
    await control.query(`CREATE SCHEMA ${schema}`); created = true;
    pool = new pg.Pool({ ...config, max: 4, options: `-c search_path=${schema},public` });
    const query = async (sql, values) => (await pool.query(sql, values)).rows;
    const migrate = async file => pool.query((await readFile(file, "utf8")).replaceAll("public.", `${schema}.`).replaceAll("search_path=public", `search_path=${schema}`));
    await migrate("tests/fixtures/finance-base.sql");
    await migrate("migrations/add_marketplace_payments.sql");
    await migrate("migrations/add_bao_item_price_tiers.sql");
    const [legacy] = await query("INSERT INTO orders(user_id,seller_id,total,status,payment_method,completed_at) VALUES(1,2,100,'completed','cod',now()) RETURNING *");
    const [legacyOnline] = await query("INSERT INTO orders(user_id,seller_id,total,status,payment_method,completed_at) VALUES(1,2,100,'completed','paymongo',now()) RETURNING *");
    await migrate("migrations/add_cash_pickup_proof.sql");
    await migrate("migrations/add_online_order_photo_proof.sql");
    await query("ALTER TABLE products ADD COLUMN department text, ADD COLUMN meetup_point text, ADD COLUMN seller_name text; CREATE TABLE product_images(product_id integer,image_url text,sort_order integer)");
    const db = { query: async (sql, values) => [await query(sql, values)], transaction: async callback => {
      const client = await pool.connect();
      try { await client.query("BEGIN"); const result = await callback(client); await client.query("COMMIT"); return result; }
      catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    } };
    const objects = new Map(), uploads = [], removed = [], signed = [], sessions = new Map();
    let failUpload = false, failNotice = false;
    const storage = { from: bucket => {
      assert.equal(bucket, "pickup-proofs");
      return {
        upload: async (key, bytes, options) => {
          uploads.push(key); assert.equal(options.upsert, false); assert.equal(options.cacheControl, "0");
          if (failUpload) return { error: new Error("Fixture upload failure") };
          objects.set(key, bytes); return {};
        },
        remove: async keys => { for (const key of keys) { removed.push(key); objects.delete(key); } return {}; },
        createSignedUrl: async (key, expires) => { signed.push({ key, expires }); return { data: { signedUrl: "https://storage.example/signed" } }; },
      };
    } };
    const env = { NEXT_PUBLIC_SUPABASE_URL: "https://storage.example", SUPABASE_SERVICE_ROLE_KEY: "fixture",
      PAYMONGO_SECRET_KEY: "sk_test_fixture", APP_URL: "http://localhost:3000" };
    const provider = async (_url, options) => {
      const id = `cs_pickup${sessions.size + 1}`;
      const session = { id, attributes: { ...JSON.parse(options.body).data.attributes, livemode: false,
        status: "active", checkout_url: `https://checkout.paymongo.com/${id}`, payments: [] } };
      sessions.set(id, session); return Response.json({ data: session });
    };
    const options = { db, env, fetch: provider, notificationFailure: () => failNotice,
      moduleMocks: { "@supabase/supabase-js": { createClient: () => ({ storage }) } } };
    const buyer = { id: 1, role: "user", status: "active" };
    const checkout = await loadFinanceModule("lib/payments/checkout.js", options);
    const completion = await loadFinanceModule("app/api/orders/[id]/route.js", { ...options, account: buyer });
    const input = { name: "Synthetic buyer", address: "Library", payment_method: "cod", items: [{ product_id: 1, quantity: 1 }] };
    const makeCash = async (overrides = {}) => {
      const order = await checkout.createMarketplaceOrders(1, { ...input, ...overrides }, randomUUID());
      const id = order.orderIds[0]; await query("UPDATE orders SET status='shipped' WHERE id=$1", [id]); return id;
    };
    const params = id => ({ params: Promise.resolve({ id: String(id) }) });
    const request = (id, file = photo()) => {
      const form = new FormData(); form.set("action", "confirm_delivery"); if (file !== null) form.set("pickup_proof", file);
      return new Request(`http://localhost/api/orders/${id}`, { method: "PATCH", body: form });
    };
    const snapshot = async id => query(`SELECT o.status,o.completed_at,o.pickup_proof_path,o.pickup_proof_uploaded_at,
      (SELECT count(*)::int FROM order_commissions WHERE order_id=o.id) AS commissions,
      (SELECT count(*)::int FROM notifications) AS notifications,p.stock,p.sold_count
      FROM orders o JOIN order_items oi ON oi.order_id=o.id JOIN products p ON p.id=oi.product_id WHERE o.id=$1`, [id]);
    let completedId;

    await t.test("migration preserves old completed orders and can be replayed", async () => {
      await migrate("migrations/add_online_order_photo_proof.sql");
      assert.deepEqual((await query("SELECT * FROM orders WHERE id=$1", [legacy.id]))[0], legacy);
      assert.deepEqual((await query("SELECT * FROM orders WHERE id=$1", [legacyOnline.id]))[0], legacyOnline);
      await query("UPDATE orders SET name='Legacy fixture' WHERE id=$1", [legacy.id]);
    });
    await t.test("missing photos, forged client paths, and invalid files cannot complete or charge an order", async () => {
      const id = await makeCash(), before = await snapshot(id), uploadCount = uploads.length;
      for (const body of [{ action: "confirm_delivery" }, { status: "completed", pickup_proof_path: "forged.png", has_pickup_proof: true }]) {
        const response = await completion.PATCH(new Request(`http://localhost/api/orders/${id}`, { method: "PATCH", body: JSON.stringify(body) }), params(id));
        assert.equal(response.status, 400); assert.match((await response.json()).error, /photo/i);
      }
      for (const file of [null, "https://example.com/photo.jpg", new File(["fake"], "fake.png", { type: "image/png" })]) {
        assert.equal((await completion.PATCH(request(id, file), params(id))).status, 400);
      }
      assert.equal(uploads.length, uploadCount); assert.deepEqual(await snapshot(id), before);
      await assert.rejects(query("UPDATE orders SET status='completed',completed_at=now() WHERE id=$1", [id]), error => error.code === "23514");
      await assert.rejects(query("INSERT INTO orders(user_id,seller_id,total,status,payment_method) VALUES(1,2,100,'completed','cod')"), error => error.code === "23514");
    });
    await t.test("sellers, other buyers, and premature confirmations cannot upload a completion photo", async () => {
      const id = await makeCash(), before = uploads.length;
      for (const account of [{ id: 2, role: "seller", status: "active" }, { id: 5, role: "user", status: "active" }]) {
        const api = await loadFinanceModule("app/api/orders/[id]/route.js", { ...options, account });
        assert.equal((await api.PATCH(request(id), params(id))).status, 403);
      }
      await query("UPDATE orders SET status='confirmed' WHERE id=$1", [id]);
      assert.equal((await completion.PATCH(request(id), params(id))).status, 403);
      assert.equal(uploads.length, before);
    });
    await t.test("upload and database failures leave the order open and clean up the photo", async () => {
      const id = await makeCash(), before = await snapshot(id), initialObjects = objects.size;
      failUpload = true;
      try { assert.equal((await completion.PATCH(request(id), params(id))).status, 503); }
      finally { failUpload = false; }
      assert.deepEqual(await snapshot(id), before); assert.equal(objects.size, initialObjects);
      failNotice = true;
      try { assert.equal((await completion.PATCH(request(id), params(id))).status, 500); }
      finally { failNotice = false; }
      assert.deepEqual(await snapshot(id), before); assert.equal(objects.size, initialObjects);
      assert.ok(removed.length >= 2);
    });
    await t.test("concurrent completions save one private photo, one commission, and one stock/sold update", async () => {
      const id = await makeCash(), [before] = await snapshot(id), uploadCount = uploads.length;
      const responses = await Promise.all([completion.PATCH(request(id), params(id)), completion.PATCH(request(id), params(id))]);
      assert.equal(responses.filter(response => response.status === 200).length, 1);
      assert.equal(responses.filter(response => response.status >= 400).length, 1);
      const data = await responses.find(response => response.status === 200).json();
      assert.equal(data.order.has_pickup_proof, true); assert.equal(data.order.pickup_proof_path, undefined);
      const [after] = await snapshot(id);
      assert.equal(after.status, "completed"); assert.ok(after.completed_at); assert.ok(after.pickup_proof_uploaded_at);
      assert.match(after.pickup_proof_path, new RegExp(`^${id}/[a-f0-9-]{36}\\.png$`));
      assert.equal(after.commissions, 1); assert.equal(after.sold_count, before.sold_count + 1); assert.equal(after.stock, before.stock);
      assert.equal(after.notifications, before.notifications + 1); assert.equal(uploads.length, uploadCount + 1);
      assert.ok(objects.has(after.pickup_proof_path));
      await assert.rejects(query("UPDATE orders SET pickup_proof_path=NULL WHERE id=$1", [id]), error => error.code === "23514");
      completedId = id;
    });
    await t.test("buyer, seller, and BAO can view the saved photo; unrelated users cannot", async () => {
      for (const account of [buyer, { id: 2, role: "seller", status: "active" }]) {
        const api = await loadFinanceModule("app/api/orders/[id]/pickup-proof/route.js", { ...options, account });
        const response = await api.GET(null, params(completedId));
        assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "private, no-store");
      }
      const other = await loadFinanceModule("app/api/orders/[id]/pickup-proof/route.js", { ...options, account: { id: 5, role: "user", status: "active" } });
      const signedCount = signed.length;
      assert.equal((await other.GET(null, params(completedId))).status, 404); assert.equal(signed.length, signedCount);
      const staff = await loadFinanceModule("app/api/bao/orders/[id]/pickup-proof/route.js", { ...options, staff: { id: 3, role: "bao", status: "active" } });
      assert.equal((await staff.GET(null, params(completedId))).status, 200);
      assert.ok(signed.every(item => item.expires === 60));
      const orders = await loadFinanceModule("app/api/orders/route.js", { ...options, account: buyer });
      const row = (await (await orders.GET(new Request("http://localhost/api/orders"))).json()).find(order => order.id === completedId);
      assert.equal(row.has_pickup_proof, true); assert.equal(row.pickup_proof_path, undefined);
      const seller = await loadFinanceModule("app/api/seller/orders/route.js", { ...options, account: { id: 2, role: "seller", status: "active" } });
      assert.ok((await (await seller.GET(new Request("http://localhost/api/seller/orders"))).json()).some(order => order.id === completedId && order.has_pickup_proof));
    });
    await t.test("zero-commission cash orders still require pickup photos", async () => {
      await query("UPDATE products SET price=400 WHERE id=1");
      const id = await makeCash();
      assert.equal((await completion.PATCH(request(id, null), params(id))).status, 400);
      assert.equal((await completion.PATCH(request(id), params(id))).status, 200);
      assert.equal(Number((await query("SELECT commission_amount FROM order_commissions WHERE order_id=$1", [id]))[0].commission_amount), 0);
      await query("UPDATE products SET price=1000 WHERE id=1");
    });
    await t.test("online orders require photo proof before completion or buyer-confirmation fund release", async () => {
      const order = await checkout.createMarketplaceOrders(1, { ...input, payment_method: "paymongo" }, randomUUID());
      const payment = await checkout.startCheckout(order.paymentId, 1), session = sessions.get(payment.checkout_session_id);
      const initialUploads = uploads.length;
      assert.equal((await completion.PATCH(request(order.orderIds[0]), params(order.orderIds[0]))).status, 409);
      assert.equal(uploads.length, initialUploads, "A photo cannot confirm an unpaid online order");
      session.attributes.payments = [{ id: "pay_pickupfixture", attributes: { status: "paid", currency: "PHP", amount: 100000, livemode: false } }];
      const lifecycle = await loadFinanceModule("lib/payments/events.js", options);
      const event = { id: "evt_pickuponline", attributes: { type: "checkout_session.payment.paid", livemode: false, data: session } };
      await lifecycle.processPaymentEvent(event, JSON.stringify(event));
      const id = order.orderIds[0];
      for (const status of ["confirmed", "processing", "shipped"]) await lifecycle.transitionOnlineOrder(2, id, { status });
      const before = await snapshot(id), initialObjects = objects.size;
      const ledger = () => query("SELECT * FROM wallet_transactions ORDER BY id");
      const pendingLedger = await ledger();
      for (const body of [{ action: "confirm_delivery" }, { status: "completed", pickup_proof_path: "forged.png", has_pickup_proof: true }]) {
        const response = await completion.PATCH(new Request(`http://localhost/api/orders/${id}`, { method: "PATCH", body: JSON.stringify(body) }), params(id));
        assert.equal(response.status, 400); assert.match((await response.json()).error, /photo/i);
      }
      await assert.rejects(lifecycle.transitionOnlineOrder(1, id, { action: "confirm_delivery", pickup_proof_path: "forged.png" }), error => error.status === 400);
      await assert.rejects(query("UPDATE orders SET status='completed',completed_at=now() WHERE id=$1", [id]), error => error.code === "23514");
      await assert.rejects(query("INSERT INTO orders(user_id,total,status,payment_method) VALUES(1,100,'completed','paymongo')"), error => error.code === "23514");
      for (const file of [null, "https://example.com/photo.png", new File(["fake"], "fake.png", { type: "image/png" })]) {
        assert.equal((await completion.PATCH(request(id, file), params(id))).status, 400);
      }
      for (const actor of [2, 5]) await assert.rejects(lifecycle.transitionOnlineOrder(actor, id, { status: "completed" }, photo()), error => error.status === 403);
      assert.equal(uploads.length, initialUploads);
      failUpload = true;
      try { assert.equal((await completion.PATCH(request(id), params(id))).status, 503); }
      finally { failUpload = false; }
      failNotice = true;
      try { assert.equal((await completion.PATCH(request(id), params(id))).status, 500); }
      finally { failNotice = false; }
      assert.deepEqual(await snapshot(id), before); assert.deepEqual(await ledger(), pendingLedger);
      assert.equal(objects.size, initialObjects);
      assert.equal((await query("SELECT released FROM payment_allocations WHERE order_id=$1", [id]))[0].released, false);

      const uploadCount = uploads.length;
      const responses = await Promise.all([completion.PATCH(request(id), params(id)), completion.PATCH(request(id), params(id))]);
      assert.equal(responses.filter(response => response.status === 200).length, 1);
      assert.equal(responses.filter(response => response.status === 409).length, 1);
      assert.equal((await responses.find(response => response.status === 200).json()).has_pickup_proof, true);
      const [row] = await snapshot(id);
      assert.equal(row.status, "completed"); assert.ok(row.pickup_proof_path); assert.ok(row.pickup_proof_uploaded_at);
      assert.equal(row.sold_count, before[0].sold_count + 1); assert.equal(row.stock, before[0].stock);
      assert.equal(uploads.length, uploadCount + 1); assert.ok(objects.has(row.pickup_proof_path));
      assert.equal((await query("SELECT released FROM payment_allocations WHERE order_id=$1", [id]))[0].released, true);
      const balances = await query(`SELECT w.kind, SUM(t.amount) AS available FROM wallets w
        JOIN wallet_transactions t ON t.wallet_id=w.id AND t.bucket='available' GROUP BY w.kind ORDER BY w.kind`);
      assert.deepEqual(balances, [{ kind: "bao", available: "30.00" }, { kind: "seller", available: "970.00" }]);
      const releasedLedger = await ledger();
      assert.equal((await completion.PATCH(request(id), params(id))).status, 409);
      assert.deepEqual(await ledger(), releasedLedger); assert.equal(uploads.length, uploadCount + 1);
      await assert.rejects(query("UPDATE orders SET pickup_proof_path=NULL WHERE id=$1", [id]), error => error.code === "23514");
      for (const account of [buyer, { id: 2, role: "seller", status: "active" }]) {
        const api = await loadFinanceModule("app/api/orders/[id]/pickup-proof/route.js", { ...options, account });
        assert.equal((await api.GET(null, params(id))).status, 200);
      }
      const staff = await loadFinanceModule("app/api/bao/orders/[id]/pickup-proof/route.js", { ...options, staff: { id: 3, role: "bao", status: "active" } });
      assert.equal((await staff.GET(null, params(id))).status, 200);
    });
  } finally {
    if (pool) await pool.end();
    if (created) await control.query(`DROP SCHEMA ${schema} CASCADE`);
    await control.end();
  }
});
