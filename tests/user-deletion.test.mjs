import test from "node:test";
import assert from "node:assert/strict";
import { loadFinanceModule } from "./helpers/load-finance-module.mjs";

test("only the admin session can initiate dashboard user deletion", async () => {
  for (const status of [401, 403]) {
    let queries = 0;
    const api = await loadFinanceModule("app/api/admin/users/[id]/route.js", {
      db: { query: async () => { queries++; return [[]]; } },
      moduleMocks: { "@/lib/admin-session": { getAdminAccess: async () => ({ admin: null, status }) } },
    });
    const response = await api.DELETE(new Request("http://localhost/api/admin/users/7", { method: "DELETE" }), { params: Promise.resolve({ id: "7" }) });
    assert.equal(response.status, status); assert.equal(queries, 0);
  }
});

test("deleted accounts cannot retain access through an old marketplace JWT", async () => {
  const auth = await loadFinanceModule("lib/authOptions.js", {
    db: { query: async () => [[]] },
    moduleMocks: {
      "next-auth/providers/credentials": { default: value => value },
      "next-auth/providers/google": { default: value => value },
      bcryptjs: { default: {} },
    },
  });
  assert.equal(await auth.authOptions.callbacks.session({ session: { user: {} }, token: { id: 7, role: "seller" } }), null);
});

test("existing accounts retain their session fields and current database permissions", async () => {
  const auth = await loadFinanceModule("lib/authOptions.js", {
    db: { query: async () => [[{ role: "seller", department: "CAS" }]] },
    moduleMocks: {
      "next-auth/providers/credentials": { default: value => value },
      "next-auth/providers/google": { default: value => value },
      bcryptjs: { default: {} },
    },
  });
  const session = await auth.authOptions.callbacks.session({ session: { user: {} }, token: { id: 7, role: "user", email: "fixture@example.invalid", name: "Fixture" } });
  assert.equal(session.user.id, 7); assert.equal(session.user.role, "seller");
  assert.equal(session.user.department, "CAS"); assert.equal(session.user.email, "fixture@example.invalid");
});
