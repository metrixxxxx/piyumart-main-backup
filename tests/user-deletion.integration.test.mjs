// Explicit opt-in. All mutations use a unique synthetic schema, never public.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import dotenv from "dotenv";
import { loadFinanceModule } from "./helpers/load-finance-module.mjs";

test("user deletion works through direct SQL and the admin API", { skip: process.env.PIYUMART_FINANCE_DB_TEST !== "1" }, async t => {
  dotenv.config({ path: ".env.local", quiet: true });
  const schema = `piyumart_user_delete_test_${randomUUID().replaceAll("-", "")}`;
  assert.match(schema, /^piyumart_user_delete_test_[a-f0-9]{32}$/);
  const config = { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000, query_timeout: 20000 };
  const control = new pg.Pool(config);
  let pool, created = false;
  try {
    await control.query(`CREATE SCHEMA ${schema}`); created = true;
    pool = new pg.Pool({ ...config, max: 2, options: `-c search_path=${schema},public` });
    const sql = async (text, values) => (await pool.query(text, values)).rows;
    const install = async filename => {
      const source = (await readFile(filename, "utf8")).replaceAll("public.", `${schema}.`).replaceAll("search_path=public", `search_path=${schema}`);
      await pool.query(source);
    };
    await install("tests/fixtures/finance-base.sql");
    await install("migrations/add_marketplace_payments.sql");
    await install("migrations/add_bao_item_price_tiers.sql");
    await install("migrations/add_bao_commission_cashouts.sql");
    await install("migrations/add_reviews_and_sold_count.sql");
    await install("migrations/add_marketplace_realtime.sql");
    await install("tests/fixtures/user-deletion.sql");
    await install("migrations/add_user_deletion_cleanup.sql");
    const db = {
      query: async (text, values) => [await sql(text, values)],
      transaction: async callback => {
        const client = await pool.connect();
        try { await client.query("BEGIN"); const result = await callback(client); await client.query("COMMIT"); return result; }
        catch (error) { await client.query("ROLLBACK"); throw error; }
        finally { client.release(); }
      },
    };
    const api = await loadFinanceModule("app/api/admin/users/[id]/route.js", {
      db, moduleMocks: { "@/lib/admin-session": { getAdminAccess: async () => ({ admin: { id: 4 }, status: 200 }) } },
    });
    const deletion = id => api.DELETE(new Request(`http://localhost/api/admin/users/${id}`, { method: "DELETE" }), { params: Promise.resolve({ id: String(id) }) });
    const count = async (table, condition = "true") => (await sql(`SELECT COUNT(*)::int AS n FROM ${table} WHERE ${condition}`))[0].n;
    const paymentId = randomUUID();

    await t.test("direct DELETE removes paid allocations, legacy orders and dependencies while preserving other accounts", async () => {
      await sql("INSERT INTO users VALUES(6,'Disposable seller','','delete@example.invalid','seller','active')");
      await sql("INSERT INTO products(id,seller_id,name,price,stock,sold_count) VALUES(99,6,'Disposable listing',100,5,2)");
      await sql("INSERT INTO orders(id,user_id,seller_id,total,status,payment_method,payment_status,stock_reserved) VALUES(100,1,6,100,'completed','paymongo','paid',true),(101,1,NULL,100,'completed','cod','unpaid',false)");
      await sql("INSERT INTO order_items(order_id,product_id,quantity,price) VALUES(100,99,1,100),(101,99,1,100)");
      await sql("INSERT INTO payments(id,user_id,reference,idempotency_key,request_hash,amount,status) VALUES($1,1,$2,$3,'fixture',100,'paid')", [paymentId, `PM-${paymentId}`, randomUUID()]);
      await sql("INSERT INTO payment_allocations(payment_id,order_id,seller_id,gross_amount,commission_amount,seller_amount,released) VALUES($1,100,6,100,3,97,true)", [paymentId]);
      const [sellerWallet] = await sql("INSERT INTO wallets(owner_id,kind) VALUES(6,'seller') RETURNING id");
      const [baoWallet] = await sql("SELECT id FROM wallets WHERE kind='bao'");
      await sql("INSERT INTO wallet_transactions(wallet_id,bucket,amount,kind,payment_id,order_id,idempotency_key) VALUES($1,'available',97,'sale',$3,100,'seller-sale'),($2,'available',3,'sale',$3,100,'bao-sale'),($2,'available',5,'fixture',NULL,NULL,'other-sale')", [sellerWallet.id, baoWallet.id, paymentId]);
      await sql("INSERT INTO wallet_destinations(seller_id,wallet_id,submitted_by,institution,account_name,account_number_encrypted,account_last_four,fingerprint) VALUES(6,$1,6,'TEST','Fixture','cipher','1234','fixture')", [sellerWallet.id]);
      const [rate] = await sql("INSERT INTO bao_commission_rates(percentage,effective_at,changed_by) VALUES(3,now(),3) RETURNING id");
      await sql("INSERT INTO order_commissions(order_id,commission_rate_id,commission_rate,order_amount,commission_amount,seller_earnings) VALUES(101,$1,3,100,3,97)", [rate.id]);
      const [report] = await sql("INSERT INTO marketplace_reports(reporter_id,related_product_id,related_order_id) VALUES(6,99,100) RETURNING id");
      await sql("INSERT INTO marketplace_report_updates(report_id,updated_by) VALUES($1,3)", [report.id]);
      await sql("INSERT INTO bao_audit_logs(actor_id,action,entity_type,entity_id) VALUES(3,'fixture','product','99'),(3,'keep','product','1')");
      await sql("INSERT INTO product_reviews(product_id,user_id,rating) VALUES(1,6,5),(1,1,3)");
      await sql("UPDATE products SET average_rating=4,total_ratings=2 WHERE id=1");
      const [conversation] = await sql("INSERT INTO conversations(buyer_id,seller_id,product_id) VALUES(1,6,99) RETURNING id");
      await sql("INSERT INTO messages(conversation_id,sender_id,content) VALUES($1,6,'test'),($1,1,'reply')", [conversation.id]);
      await sql("INSERT INTO seller_applications(user_id,reviewed_by) VALUES(6,4)");
      await sql("INSERT INTO notifications(user_id,type,message) VALUES(6,'test','remove'),(1,'payment','Order #100 paid'),(1,'payment','Order #1000 paid')");
      await sql("DELETE FROM users WHERE id=6");
      for (const [table, where] of [["users", "id=6"], ["products", "id=99"], ["orders", "id IN(100,101)"], ["order_items", "order_id IN(100,101)"], ["payments", "true"], ["payment_allocations", "true"], ["wallets", "owner_id=6"], ["wallet_destinations", "seller_id=6"], ["order_commissions", "true"], ["marketplace_reports", "true"], ["marketplace_report_updates", "true"], ["messages", "true"], ["conversations", "true"], ["seller_applications", "true"]]) {
        assert.equal(await count(table, where), 0, table);
      }
      assert.equal(await count("users"), 5);
      assert.equal(await count("bao_commission_rates"), 1);
      assert.equal(await count("bao_audit_logs", "action='keep'"), 1);
      assert.equal(await count("notifications", "message='Order #1000 paid'"), 1);
      assert.deepEqual((await sql("SELECT average_rating,total_ratings FROM products WHERE id=1"))[0], { average_rating: "3.00", total_ratings: 1 });
      assert.equal((await sql("SELECT SUM(amount) AS balance FROM wallet_transactions WHERE wallet_id=$1", [baoWallet.id]))[0].balance, "5.00");
      await assert.rejects(sql("DELETE FROM wallet_transactions"), /immutable/);
      await assert.rejects(sql("DELETE FROM bao_audit_logs"), /cannot be modified/);
    });

    await t.test("dashboard deletion restores other sellers' reserved stock and sale counters", async () => {
      await sql("INSERT INTO users VALUES(7,'Disposable buyer','','buyer-delete@example.invalid','user','active')");
      await sql("UPDATE products SET stock=90,sold_count=3 WHERE id=1");
      await sql("INSERT INTO orders(id,user_id,seller_id,total,status,payment_method,stock_reserved) VALUES(200,7,2,2000,'pending','cod',true),(201,7,2,1000,'completed','cod',true)");
      await sql("INSERT INTO order_items(order_id,product_id,quantity,price) VALUES(200,1,2,1000),(201,1,1,1000)");
      assert.equal((await deletion(7)).status, 200);
      assert.deepEqual((await sql("SELECT stock,sold_count FROM products WHERE id=1"))[0], { stock: 92, sold_count: 2 });
      assert.equal(await count("users", "id=2"), 1);
      assert.equal(await count("orders", "user_id=7"), 0);
    });

    await t.test("an account with no orders deletes without touching unrelated hashtag notifications", async () => {
      await sql("INSERT INTO users VALUES(8,'Empty user','','empty@example.invalid','user','active')");
      await sql("INSERT INTO notifications(user_id,type,message) VALUES(1,'order','# keep this message')");
      assert.equal((await deletion(8)).status, 200);
      assert.equal(await count("notifications", "message='# keep this message'"), 1);
    });

    await t.test("shared payments and pending checkouts report conflicts and roll back every deletion", async () => {
      await sql("INSERT INTO users VALUES(9,'Shared seller','','shared@example.invalid','seller','active')");
      await sql("INSERT INTO products(id,seller_id,name,price,stock) VALUES(98,9,'Shared listing',100,5)");
      await sql("INSERT INTO orders(id,user_id,seller_id,total,status,payment_method) VALUES(300,1,9,100,'completed','paymongo'),(301,1,2,100,'completed','paymongo')");
      const shared = randomUUID();
      await sql("INSERT INTO payments(id,user_id,reference,idempotency_key,request_hash,amount,status) VALUES($1,1,$2,$3,'fixture',200,'paid')", [shared, `PM-${shared}`, randomUUID()]);
      await sql("INSERT INTO payment_allocations(payment_id,order_id,seller_id,gross_amount,commission_amount,seller_amount) VALUES($1,300,9,100,3,97),($1,301,2,100,3,97)", [shared]);
      const conflict = await deletion(9);
      assert.equal(conflict.status, 409); assert.match((await conflict.json()).error, /shared/);
      assert.equal(await count("users", "id=9"), 1); assert.equal(await count("payment_allocations"), 2);
      await sql("UPDATE payments SET status='pending' WHERE id=$1", [shared]);
      const pending = await deletion(9);
      assert.equal(pending.status, 409); assert.match((await pending.json()).error, /pending online/);
      assert.equal(await count("products", "id=98"), 1);
    });

    await t.test("protected users, malformed IDs and missing users keep their existing boundaries", async () => {
      assert.equal((await deletion(4)).status, 404);
      assert.equal((await deletion("1 OR 1=1")).status, 400);
      assert.equal((await deletion(99999)).status, 404);
      await assert.rejects(sql("DELETE FROM users WHERE id=3"), /protected/);
      const guards = await sql("SELECT tgname,tgenabled FROM pg_trigger WHERE tgrelid IN(SELECT oid FROM pg_class WHERE relnamespace=$1::regnamespace) AND NOT tgisinternal", [schema]);
      assert.ok(guards.every(row => row.tgenabled === "O"));
    });

    await t.test("a failed deletion restores children and protections even after cleanup started", async () => {
      await sql("INSERT INTO users VALUES(10,'Blocked user','','blocked@example.invalid','user','active')");
      await sql("INSERT INTO notifications(user_id,type,message) VALUES(10,'test','must survive rollback')");
      await sql("CREATE TABLE future_dependency(user_id integer REFERENCES users(id))");
      await sql("INSERT INTO future_dependency VALUES(10)");
      assert.equal((await deletion(10)).status, 409);
      assert.equal(await count("users", "id=10"), 1);
      assert.equal(await count("notifications", "user_id=10"), 1);
      await assert.rejects(sql("DELETE FROM wallet_transactions"), /immutable/);
      await sql("DROP TABLE future_dependency");
      assert.equal((await deletion(10)).status, 200);
    });

    await t.test("bulk Table Editor deletion supports multiple ordinary users in one statement", async () => {
      await sql("INSERT INTO users VALUES(11,'Bulk one','','bulk1@example.invalid','user','active'),(12,'Bulk two','','bulk2@example.invalid','seller','active')");
      await sql("INSERT INTO wallets(owner_id,kind) VALUES(12,'seller')");
      const deleted = await sql("DELETE FROM users WHERE id IN(11,12) RETURNING id");
      assert.equal(deleted.length, 2);
      assert.equal(await count("wallets", "owner_id=12"), 0);
    });

    await t.test("deletion cannot remove test credits already consumed by another withdrawal", async () => {
      await sql("INSERT INTO users VALUES(13,'Funded seller','','funded@example.invalid','seller','active')");
      await sql("INSERT INTO orders(id,user_id,seller_id,total,status,payment_method) VALUES(400,1,13,100,'completed','paymongo')");
      const payment = randomUUID();
      await sql("INSERT INTO payments(id,user_id,reference,idempotency_key,request_hash,amount,status) VALUES($1,1,$2,$3,'fixture',100,'paid')", [payment, `PM-${payment}`, randomUUID()]);
      await sql("INSERT INTO payment_allocations(payment_id,order_id,seller_id,gross_amount,commission_amount,seller_amount,released) VALUES($1,400,13,100,3,97,true)", [payment]);
      const [wallet] = await sql("INSERT INTO wallets(owner_id,kind) VALUES(13,'seller') RETURNING id");
      const [bao] = await sql("SELECT id FROM wallets WHERE kind='bao'");
      await sql("INSERT INTO wallet_transactions(wallet_id,bucket,amount,kind,order_id,idempotency_key) VALUES($1,'available',97,'sale',400,'funded-seller'),($2,'available',3,'sale',400,'funded-bao'),($2,'available',-7,'fixture',NULL,'spent-bao')", [wallet.id, bao.id]);
      const response = await deletion(13);
      assert.equal(response.status, 409); assert.match((await response.json()).error, /another withdrawal/);
      assert.equal(await count("users", "id=13"), 1);
      assert.equal(await count("payment_allocations", "order_id=400"), 1);
      await assert.rejects(sql("DELETE FROM wallet_transactions"), /immutable/);
    });

    await t.test("a buyer's multi-seller test checkout deletes without deleting the sellers or their wallets", async () => {
      await sql("INSERT INTO users VALUES(14,'Multi buyer','','multi-delete@example.invalid','user','active')");
      await sql("INSERT INTO orders(id,user_id,seller_id,total,status,payment_method) VALUES(500,14,2,100,'completed','paymongo'),(501,14,9,100,'completed','paymongo')");
      await sql("INSERT INTO order_items(order_id,product_id,quantity,price) VALUES(500,1,1,100),(501,98,1,100)");
      await sql("UPDATE products SET sold_count=sold_count+1 WHERE id IN(1,98)");
      const payment = randomUUID();
      await sql("INSERT INTO payments(id,user_id,reference,idempotency_key,request_hash,amount,status) VALUES($1,14,$2,$3,'fixture',200,'paid')", [payment, `PM-${payment}`, randomUUID()]);
      await sql("INSERT INTO payment_allocations(payment_id,order_id,seller_id,gross_amount,commission_amount,seller_amount,released) VALUES($1,500,2,100,3,97,true),($1,501,9,100,3,97,true)", [payment]);
      const [first] = await sql("SELECT id FROM wallets WHERE owner_id=2");
      const [second] = await sql("INSERT INTO wallets(owner_id,kind) VALUES(9,'seller') RETURNING id");
      const [bao] = await sql("SELECT id FROM wallets WHERE kind='bao'");
      await sql("INSERT INTO wallet_transactions(wallet_id,bucket,amount,kind,order_id,payment_id,idempotency_key) VALUES($1,'available',97,'sale',500,$4,'multi-first'),($2,'available',97,'sale',501,$4,'multi-second'),($3,'available',3,'sale',500,$4,'multi-bao-first'),($3,'available',3,'sale',501,$4,'multi-bao-second')", [first.id, second.id, bao.id, payment]);
      assert.equal((await deletion(14)).status, 200);
      assert.equal(await count("users", "id IN(2,9)"), 2);
      assert.equal(await count("wallets", "owner_id IN(2,9)"), 2);
      assert.equal(await count("orders", "id IN(500,501)"), 0);
      assert.equal(await count("wallet_transactions", "order_id IN(500,501)"), 0);
    });

    await t.test("checkout racing with deletion cannot leave a deleted buyer's orders or reserved stock", async () => {
      await sql("INSERT INTO users VALUES(16,'Racing buyer','','race-delete@example.invalid','user','active')");
      const [before] = await sql("SELECT stock FROM products WHERE id=1");
      const checkout = await loadFinanceModule("lib/payments/checkout.js", { db });
      const [removed, purchased] = await Promise.allSettled([
        sql("DELETE FROM users WHERE id=16"),
        checkout.createMarketplaceOrders(16, { name: "Fixture", address: "Library", payment_method: "cod", items: [{ product_id: 1, quantity: 1 }] }, randomUUID()),
      ]);
      assert.equal(removed.status, "fulfilled");
      if (purchased.status === "rejected") assert.match(purchased.reason.message, /Forbidden/);
      assert.equal(await count("orders", "user_id=16"), 0);
      assert.equal((await sql("SELECT stock FROM products WHERE id=1"))[0].stock, before.stock);
    });
  } finally {
    if (pool) await pool.end();
    if (created) await control.query(`DROP SCHEMA ${schema} CASCADE`);
    await control.end();
  }
});
