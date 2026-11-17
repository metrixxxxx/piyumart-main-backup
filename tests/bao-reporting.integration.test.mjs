// Explicit opt-in: all writes use an isolated schema and synthetic users.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import dotenv from "dotenv";
import { loadFinanceModule } from "./helpers/load-finance-module.mjs";

test("BAO reports combine cash and verified online transactions", {
  skip: process.env.PIYUMART_FINANCE_DB_TEST !== "1",
}, async (t) => {
  dotenv.config({ path: ".env.local", quiet: true });
  const schema = `piyumart_bao_reports_test_${randomUUID().replaceAll("-", "")}`;
  assert.match(schema, /^piyumart_bao_reports_test_[a-f0-9]{32}$/);
  const config = { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000, query_timeout: 15000 };
  const control = new pg.Pool(config);
  let pool, created = false;
  try {
    await control.query(`CREATE SCHEMA ${schema}`); created = true;
    pool = new pg.Pool({ ...config, max: 4, options: `-c search_path=${schema},public` });
    await pool.query(await readFile("tests/fixtures/finance-base.sql", "utf8"));
    const migration = (await readFile("migrations/add_marketplace_payments.sql", "utf8"))
      .replaceAll("public.", `${schema}.`).replaceAll("search_path=public", `search_path=${schema}`);
    await pool.query(migration);
    const db = {
      query: async (sql, values) => [(await pool.query(sql, values)).rows],
      transaction: async (callback) => {
        const client = await pool.connect();
        try { await client.query("BEGIN"); const result = await callback(client); await client.query("COMMIT"); return result; }
        catch (error) { await client.query("ROLLBACK"); throw error; }
        finally { client.release(); }
      },
    };
    const query = async (sql, values) => (await pool.query(sql, values)).rows;
    const sessions = new Map(); let eventNumber = 0;
    const env = { PAYMONGO_SECRET_KEY: "sk_test_fixture_only", APP_URL: "http://localhost:3000" };
    const provider = async (url, options = {}) => {
      const path = new URL(url).pathname;
      if (path === "/v2/checkout_sessions" && options.method === "POST") {
        const attributes = JSON.parse(options.body).data.attributes, id = `cs_report${sessions.size + 1}`;
        const session = { id, attributes: { ...attributes, livemode: false, status: "active",
          checkout_url: `https://checkout.paymongo.com/${id}`, payments: [] } };
        sessions.set(id, session); return Response.json({ data: session });
      }
      const session = sessions.get(path.split("/")[3]);
      if (!session) throw new Error("Unexpected fixture provider request");
      if (path.endsWith("/expire")) session.attributes.status = "expired";
      return Response.json({ data: session });
    };
    const options = { db, env, fetch: provider, staff: { id: 3, role: "bao", status: "active" } };
    const checkout = await loadFinanceModule("lib/payments/checkout.js", options);
    const lifecycle = await loadFinanceModule("lib/payments/events.js", options);
    const commission = await loadFinanceModule("lib/bao-commission.js", options);
    const service = await loadFinanceModule("lib/bao-commission-report.js", options);
    const api = await loadFinanceModule("app/api/bao/commissions/route.js", options);
    const dashboard = await loadFinanceModule("app/api/bao/dashboard/route.js", options);
    const range = { from: "2000-01-01", to: "2100-12-31", requestedPage: 1, pageSize: 50 };
    const report = (overrides = {}) => service.readCommissionReport({ ...range, ...overrides });
    const input = { name: "Synthetic buyer", address: "Library", payment_method: "paymongo",
      items: [{ product_id: 1, quantity: 1 }] };
    const makeOnline = async (items = input.items) => {
      const order = await checkout.createMarketplaceOrders(1, { ...input, items }, randomUUID());
      return { ...order, payment: await checkout.startCheckout(order.paymentId, 1) };
    };
    const event = (type, resource) => ({ id: `evt_report${++eventNumber}`, attributes: { livemode: false, type, data: resource } });
    const pay = async (order) => {
      const session = sessions.get(order.payment.checkout_session_id);
      session.attributes.payments = [{ id: `pay_report${sessions.size}`, attributes: {
        status: "paid", currency: "PHP", amount: Math.round(Number(order.payment.amount) * 100), livemode: false,
      } }];
      const payload = event("checkout_session.payment.paid", session);
      await lifecycle.processPaymentEvent(payload, JSON.stringify(payload)); return payload;
    };
    const complete = async (order) => {
      for (const id of order.orderIds) {
        const [row] = await query("SELECT seller_id FROM orders WHERE id=$1", [id]);
        for (const status of ["confirmed", "processing", "shipped"]) await lifecycle.transitionOnlineOrder(row.seller_id, id, { status });
        await lifecycle.transitionOnlineOrder(1, id, { action: "confirm_delivery" });
      }
    };
    const refund = async (order, amount) => {
      const [payment] = await query("SELECT provider_payment_id FROM payments WHERE id=$1", [order.paymentId]);
      const payload = event("payment.refund.updated", { id: `ref_report${eventNumber + 1}`, attributes: {
        payment_id: payment.provider_payment_id, amount, currency: "PHP", livemode: false, status: "succeeded",
      } });
      await lifecycle.processPaymentEvent(payload, JSON.stringify(payload));
    };
    let cash, online, delivery;

    await t.test("a paid online order appears immediately alongside the original cash snapshot", async () => {
      await query("INSERT INTO bao_commission_rates(percentage,effective_at,changed_by,notes) VALUES(7,'2000-01-01',3,'Synthetic cash rate')");
      cash = await checkout.createMarketplaceOrders(1, { ...input, payment_method: "cod" }, randomUUID());
      await db.transaction(async (client) => {
        await client.query("UPDATE orders SET status='completed',completed_at=now() WHERE id=$1", [cash.orderIds[0]]);
        await commission.recordOrderCommission(client, cash.orderIds[0]);
      });
      online = await makeOnline();
      assert.equal((await report()).history.totalRows, 1, "unpaid checkout must not be a financial transaction");
      delivery = await pay(online);
      const data = await report();
      assert.equal(data.history.totalRows, 2);
      assert.equal(Number(data.totals.allTime.commission_amount), 70);
      assert.equal(Number(data.totals.allTime.pending_commission_amount), 30);
      const row = data.history.records.find((row) => row.order_id === online.orderIds[0]);
      assert.equal(row.payment_method, "paymongo"); assert.equal(row.payment_status, "paid");
      assert.equal(row.is_earned, false); assert.equal(Number(row.commission_rate), 3);
      assert.equal(row.payment_reference, online.payment.reference);
    });

    await t.test("repeated webhooks and report reads never duplicate transactions or credit wallets", async () => {
      const snapshot = async () => (await query("SELECT md5(COALESCE(jsonb_agg(t ORDER BY id)::text,'[]')) AS hash FROM wallet_transactions t"))[0].hash;
      const before = await snapshot();
      await lifecycle.processPaymentEvent(delivery, JSON.stringify(delivery));
      await lifecycle.processPaymentEvent({ ...delivery, id: "evt_report_redelivery" }, "same payment redelivered");
      for (let i = 0; i < 3; i++) assert.equal((await report()).history.totalRows, 2);
      assert.equal(await snapshot(), before);
      assert.equal((await query("SELECT COUNT(*)::int AS n FROM order_commissions"))[0].n, 1);
    });

    await t.test("buyer completion includes online commission in earned totals and the BAO dashboard", async () => {
      await complete(online);
      const data = await report();
      assert.equal(Number(data.totals.allTime.commission_amount), 100);
      assert.equal(Number(data.totals.allTime.pending_commission_amount), 0);
      const response = await dashboard.GET(); assert.equal(response.status, 200);
      const stats = await response.json(); assert.equal(Number(stats.totalBaoCommission), 100);
      assert.equal(Number(stats.totalMarketplaceSales), 2000);
    });

    await t.test("later cash rate changes do not recalculate online or cash history", async () => {
      await query("INSERT INTO bao_commission_rates(percentage,effective_at,changed_by,notes) VALUES(9,'2001-01-01',3,'Changed synthetic rate')");
      const data = await report(); assert.equal(Number(data.currentRate.percentage), 9);
      assert.equal(Number(data.history.records.find((r) => r.order_id === cash.orderIds[0]).commission_rate), 7);
      assert.equal(Number(data.history.records.find((r) => r.order_id === online.orderIds[0]).commission_amount), 30);
    });

    await t.test("partial refunds reduce commission, seller totals and dashboard sales exactly", async () => {
      await refund(online, 20000);
      const data = await report(), row = data.history.records.find((r) => r.order_id === online.orderIds[0]);
      assert.equal(Number(row.order_amount), 800); assert.equal(Number(row.refunded_amount), 200);
      assert.equal(Number(row.commission_amount), 24); assert.equal(Number(row.seller_earnings), 776);
      assert.equal(Number(data.totals.allTime.commission_amount), 94);
      const stats = await (await dashboard.GET()).json();
      assert.equal(Number(stats.totalBaoCommission), 94); assert.equal(Number(stats.totalMarketplaceSales), 1800);
    });

    await t.test("full refunds retain the transaction while removing its earnings", async () => {
      await refund(online, 80000);
      const data = await report(), row = data.history.records.find((r) => r.order_id === online.orderIds[0]);
      assert.equal(data.history.totalRows, 2); assert.equal(Number(row.commission_amount), 0);
      assert.equal(row.payment_status, "refunded"); assert.equal(Number(data.totals.allTime.commission_amount), 70);
      const stats = await (await dashboard.GET()).json();
      assert.equal(Number(stats.totalBaoCommission), 70); assert.equal(Number(stats.totalMarketplaceSales), 1000);
    });

    await t.test("refunding before fulfillment adjusts pending commission and preserves the cancelled record", async () => {
      const order = await makeOnline(); await pay(order); await refund(order, 10000);
      assert.equal(Number((await report()).totals.allTime.pending_commission_amount), 27);
      await refund(order, 90000);
      const data = await report(), row = data.history.records.find((r) => r.order_id === order.orderIds[0]);
      assert.equal(row.order_status, "cancelled"); assert.equal(Number(row.commission_amount), 0);
      assert.equal(Number(data.totals.allTime.pending_commission_amount), 0);
    });

    await t.test("unpaid and cancelled checkouts never appear as commission transactions", async () => {
      const before = (await report()).history.totalRows, order = await makeOnline();
      assert.equal((await report()).history.totalRows, before);
      await lifecycle.reconcilePayment(order.paymentId, { cancel: true });
      assert.equal((await report()).history.totalRows, before);
    });

    await t.test("multiple seller allocations produce one row each under a shared payment reference", async () => {
      await query("INSERT INTO users VALUES(6,'Second seller','','second@example.invalid','seller','active')");
      await query("INSERT INTO products(seller_id,name,price,stock,status,is_visible) VALUES(6,'Second textbook',1000,100,'approved',true)");
      const order = await makeOnline([{ product_id: 1, quantity: 1 }, { product_id: 2, quantity: 1 }]);
      await pay(order);
      const rows = (await report()).history.records.filter((r) => r.payment_reference === order.payment.reference);
      assert.equal(rows.length, 2); assert.equal(new Set(rows.map((r) => r.seller_id)).size, 2);
      assert.equal(rows.reduce((sum, r) => sum + Number(r.commission_amount), 0), 60);
    });

    await t.test("pagination is stable, filters cover both sources, and legacy seller attribution survives", async () => {
      await query("UPDATE orders SET seller_id=NULL WHERE id=$1", [cash.orderIds[0]]);
      const first = await report({ pageSize: 2 }), second = await report({ pageSize: 2, requestedPage: 2 });
      assert.equal(first.history.totalRows, 5); assert.equal(first.history.records.length, 2);
      assert.equal(second.history.records.length, 2);
      assert.ok(!first.history.records.some((r) => second.history.records.some((other) => other.order_id === r.order_id)));
      const all = await report(); assert.equal(all.history.records.find((r) => r.order_id === cash.orderIds[0]).seller_name, "Demo seller");
      const last = await report({ pageSize: 2, requestedPage: 100 }); assert.equal(last.history.page, 3);
      const empty = await report({ from: "2000-02-01", to: "2000-02-02" });
      assert.equal(empty.history.totalRows, 0); assert.equal(Number(empty.totals.selectedRange.commission_amount), 0);
    });

    await t.test("BAO and admin APIs return private reports and reject invalid filters", async () => {
      for (const role of ["bao", "admin"]) {
        const route = role === "bao" ? api : await loadFinanceModule("app/api/bao/commissions/route.js", { ...options, staff: { id: 4, role } });
        const response = await route.GET(new Request("http://localhost/api/bao/commissions?from=2000-01-01&to=2100-12-31"));
        assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "private, no-store");
        assert.equal((await response.json()).history.totalRows, 5);
      }
      for (const search of ["from=2026-02-30", "page=-1", "page=1.5", "from=2030-01-01&to=2000-01-01"]) {
        assert.equal((await api.GET(new Request(`http://localhost/api/bao/commissions?${search}`))).status, 400);
      }
    });
  } finally {
    if (pool) await pool.end();
    if (created) await control.query(`DROP SCHEMA ${schema} CASCADE`);
    await control.end();
  }
});
