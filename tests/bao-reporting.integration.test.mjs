// Explicit opt-in: all writes use an isolated schema and synthetic users.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import dotenv from "dotenv";
import { loadFinanceModule } from "./helpers/load-finance-module.mjs";
import { proofPhoto, withProofStorage } from "./helpers/proof-photo.mjs";

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
    const tierMigration = (await readFile("migrations/add_bao_item_price_tiers.sql", "utf8"))
      .replaceAll("public.", `${schema}.`).replaceAll("search_path=public", `search_path=${schema}`);
    await pool.query(tierMigration);
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
    const options = withProofStorage({ db, env, fetch: provider, staff: { id: 3, role: "bao", status: "active" } });
    const checkout = await loadFinanceModule("lib/payments/checkout.js", options);
    const lifecycle = await loadFinanceModule("lib/payments/events.js", options);
    const { transitionOrder } = await loadFinanceModule("lib/orders/fulfillment.js", options);
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
        for (const status of ["preparing", "ready_for_pickup"]) await transitionOrder(row.seller_id, id, { status });
        await transitionOrder(1, id, { action: "confirm_receipt" }, proofPhoto());
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
        await client.query("UPDATE orders SET status='completed',completed_at=now(),bao_commission_amount=NULL WHERE id=$1", [cash.orderIds[0]]);
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

    await t.test("tier migration replays without altering historical allocations or commissions", async () => {
      const snapshot = async () => query(`SELECT
        (SELECT jsonb_agg(a ORDER BY order_id) FROM payment_allocations a) AS allocations,
        (SELECT jsonb_agg(c ORDER BY order_id) FROM order_commissions c) AS commissions,
        (SELECT jsonb_agg(w ORDER BY id) FROM wallet_transactions w) AS ledger`);
      const before = await snapshot();
      await pool.query(tierMigration);
      assert.deepEqual(await snapshot(), before);
    });

    await t.test("new cash and online orders snapshot each price tier independently of quantity", async () => {
      const cases = [["499.99", 3, "0.00"], ["500.00", 3, "0.00"],
        ["500.01", 1, "15.00"], ["5000.00", 1, "150.00"],
        ["5000.01", 1, "250.00"], ["10000.00", 1, "500.00"],
        ["10000.01", 1, "500.00"]];
      for (const [price, quantity, expected] of cases) {
        const [product] = await query("INSERT INTO products(seller_id,name,price,stock,status,is_visible) VALUES(2,'Tier fixture',$1,100,'approved',true) RETURNING id", [price]);
        const items = [{ product_id: product.id, quantity }];
        for (const payment_method of ["cod", "paymongo"]) {
          const key = randomUUID();
          const order = await checkout.createMarketplaceOrders(1, { ...input, payment_method, items }, key);
          const retry = await checkout.createMarketplaceOrders(1, { ...input, payment_method, items }, key);
          assert.deepEqual([...retry.orderIds], [...order.orderIds]);
          const [quote] = await query("SELECT bao_commission_amount,total FROM orders WHERE id=$1", [order.orderIds[0]]);
          assert.equal(quote.bao_commission_amount, expected, `${payment_method}: ${price} x ${quantity}`);
          if (payment_method === "cod") {
            await db.transaction(async client => {
              await client.query("UPDATE orders SET status='completed',completed_at=now() WHERE id=$1", [order.orderIds[0]]);
              const record = await commission.recordOrderCommission(client, order.orderIds[0]);
              assert.equal(record.commission_amount, expected);
              assert.equal(record.commission_rate_id, null);
              assert.equal(await commission.recordOrderCommission(client, order.orderIds[0]), null);
            });
          } else {
            const [allocation] = await query("SELECT * FROM payment_allocations WHERE order_id=$1", [order.orderIds[0]]);
            assert.equal(allocation.commission_amount, expected);
            assert.equal(Number(allocation.seller_amount) + Number(expected), Number(quote.total));
          }
        }
      }
    });

    await t.test("mixed items and variant prices flow through seller reports and refunded online earnings", async () => {
      const ids = [];
      for (const price of [400, 1000, 6000]) {
        const [product] = await query("INSERT INTO products(seller_id,name,price,stock,status,is_visible) VALUES(2,'Mixed tier fixture',$1,100,'approved',true) RETURNING id", [price]);
        ids.push(product.id);
      }
      await query("INSERT INTO product_variants(product_id,label,price_override) VALUES($1,'Premium',6000)", [ids[0]]);
      const items = [{ product_id: ids[0], quantity: 4 }, { product_id: ids[1], quantity: 2 }, { product_id: ids[2], quantity: 1 }];
      const cashOrder = await checkout.createMarketplaceOrders(1, { ...input, payment_method: "cod", items }, randomUUID());
      const sellerOptions = { ...options, account: { id: 2, role: "seller", status: "active" } };
      const sellerApi = await loadFinanceModule("app/api/seller/orders/route.js", sellerOptions);
      const sellerRows = await (await sellerApi.GET(new Request("http://localhost/api/seller/orders?pageSize=48"))).json();
      const estimate = sellerRows.find(row => row.id === cashOrder.orderIds[0]);
      assert.equal(Number(estimate.commission_amount), 360); assert.equal(Number(estimate.commission_rate), 3.75);
      assert.equal(Number(estimate.seller_earnings), 9240);
      await query("UPDATE products SET price=100 WHERE id=ANY($1::integer[])", [ids]);
      await db.transaction(async client => {
        await client.query("UPDATE orders SET status='completed',completed_at=now() WHERE id=$1", [cashOrder.orderIds[0]]);
        assert.equal(Number((await commission.recordOrderCommission(client, cashOrder.orderIds[0])).commission_amount), 360);
      });
      const statsApi = await loadFinanceModule("app/api/my-listings/stats/route.js", sellerOptions);
      const stats = await (await statsApi.GET()).json();
      assert.ok(Number(stats.commission) >= 360); assert.equal(stats.unrecordedCompletedOrders, 0);

      const order = await makeOnline([{ product_id: ids[0], quantity: 1, variant: "Premium" }]);
      await assert.rejects(query("UPDATE payment_allocations SET commission_amount=180,seller_amount=5820 WHERE order_id=$1", [order.orderIds[0]]), error => error.code === "23514");
      await pay(order); await complete(order);
      let row = (await report()).history.records.find(r => r.order_id === order.orderIds[0]);
      assert.equal(Number(row.commission_amount), 300); assert.equal(Number(row.commission_rate), 5);
      await refund(order, 200000);
      row = (await report()).history.records.find(r => r.order_id === order.orderIds[0]);
      assert.equal(Number(row.order_amount), 4000); assert.equal(Number(row.commission_amount), 200);
      assert.equal(Number(row.commission_rate), 5); assert.equal(Number(row.seller_earnings), 3800);
    });

    await t.test("flat-rate updates cannot override the item tiers", async () => {
      const before = await query("SELECT count(*)::int AS n FROM bao_commission_rates");
      assert.equal((await api.POST(new Request("http://localhost/api/bao/commissions", {
        method: "POST", body: JSON.stringify({ percentage: 20, reason: "Fixture" }),
      }))).status, 409);
      assert.deepEqual(await query("SELECT count(*)::int AS n FROM bao_commission_rates"), before);
      const unauthorized = await loadFinanceModule("app/api/bao/commissions/route.js", { db });
      assert.equal((await unauthorized.POST()).status, 401);
    });
  } finally {
    if (pool) await pool.end();
    if (created) await control.query(`DROP SCHEMA ${schema} CASCADE`);
    await control.end();
  }
});
