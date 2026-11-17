import test from "node:test";
import assert from "node:assert/strict";
import { buildCleanupPlan, serializeBackup } from "../scripts/purge-test-user.mjs";

test("backup is valid JSON and preserves raw Postgres precision and timestamps", () => {
  const raw = { users: ['{"id":21,"name":"Test \\"user\\""}'], payments: ['{"amount":9007199254740993.01,"created_at":"2026-11-17T14:36:15.123456+08:00"}'] };
  const payload = serializeBackup(raw, "[]", 21);
  const parsed = JSON.parse(payload);
  assert.equal(parsed.userId, 21);
  assert.equal(parsed.tables.users[0].name, 'Test "user"');
  assert.equal(parsed.tables.payments[0].created_at, "2026-11-17T14:36:15.123456+08:00");
  assert.ok(payload.includes("9007199254740993.01"));
  assert.throws(() => serializeBackup({ users: ['{"broken":'] }, "[]", 21), SyntaxError);
});

function fixture() {
  return {
    users: [{ id: 21, role: "seller" }, { id: 40, role: "user" }],
    products: [{ id: 7, seller_id: 21 }, { id: 8, seller_id: 22 }],
    orders: [{ id: 125, user_id: 40, seller_id: 21 }, { id: 112, user_id: 40, seller_id: null }],
    order_items: [{ id: 1, order_id: 125, product_id: 7 }, { id: 2, order_id: 112, product_id: 7 }],
    payments: [{ id: "test-payment", user_id: 40, livemode: false, status: "paid", reference: "PM-test-payment" }],
    payment_allocations: [{ payment_id: "test-payment", order_id: 125, seller_id: 21 }],
    wallets: [{ id: "seller-wallet", owner_id: 21, kind: "seller" }, { id: "bao-wallet", kind: "bao" }],
    wallet_transactions: [
      { id: "seller-credit", wallet_id: "seller-wallet", order_id: 125, payment_id: "test-payment", bucket: "available", amount: "97.00" },
      { id: "bao-credit", wallet_id: "bao-wallet", order_id: 125, payment_id: "test-payment", bucket: "available", amount: "3.00" },
      { id: "other-credit", wallet_id: "bao-wallet", order_id: 200, bucket: "available", amount: "2.00" },
    ],
    notifications: [{ id: 1, user_id: 40, type: "payment", message: "Order #125 paid" },
      { id: 2, user_id: 40, type: "payment", message: "Order #1250 paid" }],
  };
}

test("selects legacy product orders and their test commission without removing other users or credits", () => {
  const plan = buildCleanupPlan(fixture(), 21);
  assert.deepEqual([...plan.get("orders")], ["125", "112"]);
  assert.deepEqual([...plan.get("wallet_transactions")], ["seller-credit", "bao-credit"]);
  assert.deepEqual([...plan.get("users")], ["21"]);
  assert.deepEqual([...plan.get("notifications")], ["1"]);
});

test("refuses a shared payment with another seller's order", () => {
  const data = fixture();
  data.payment_allocations.push({ payment_id: "test-payment", order_id: 999, seller_id: 22 });
  assert.throws(() => buildCleanupPlan(data, 21), /shared with unrelated orders/);
});

test("refuses a mixed legacy order belonging to another buyer", () => {
  const data = fixture();
  data.order_items.push({ id: 3, order_id: 112, product_id: 8 });
  assert.throws(() => buildCleanupPlan(data, 21), /unrelated products/);
});

test("refuses cleanup if test commissions have already funded other withdrawals", () => {
  const data = fixture();
  data.wallet_transactions.push({ id: "withdrawal", wallet_id: "bao-wallet", bucket: "available", amount: "-4.00" });
  assert.throws(() => buildCleanupPlan(data, 21), /negative wallet balance/);
});

test("protects live payments, unresolved checkouts, and staff accounts", () => {
  const live = fixture(); live.payments[0].livemode = true;
  assert.throws(() => buildCleanupPlan(live, 21), /payment mode/);
  const pending = fixture(); pending.payments[0].status = "pending";
  assert.throws(() => buildCleanupPlan(pending, 21), /pending provider checkouts/);
  const staff = fixture(); staff.users[0].role = "admin";
  assert.throws(() => buildCleanupPlan(staff, 21), /Staff accounts/);
});
