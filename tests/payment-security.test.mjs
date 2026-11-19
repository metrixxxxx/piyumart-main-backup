import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { loadFinanceModule } from "./helpers/load-finance-module.mjs";

test("PHP arithmetic preserves centavos with item price commission tiers",async()=>{
  const m=await loadFinanceModule("lib/payments/money.js");
  assert.equal(m.cents("1000.00"),100000);assert.equal(m.splitAmount(100000).seller,97000);assert.equal(m.splitAmount(100000).commission,3000);
  for(let value=1;value<1200000;value+=137){const split=m.splitAmount(value);assert.equal(split.seller+split.commission,value);}
  for(const invalid of ["-1","NaN","1e3","1.001","Infinity"])assert.throws(()=>m.cents(invalid));
  assert.equal(m.proportional(7,[1,2,3]).reduce((sum,value)=>sum+value,0),7);
});

test("BAO tier boundaries use unit prices before quantity, including above PHP 10,000",async()=>{
  const m=await loadFinanceModule("lib/payments/money.js");
  for(const [price,commission] of [[0,0],[49999,0],[50000,0],[50001,1500],
    [500000,15000],[500001,25000],[1000000,50000],[1000001,50000],[2000000,100000]]) {
    const split=m.splitAmount(price);assert.equal(split.commission,commission,`price ${price}`);
    assert.equal(split.seller,price-commission);
  }
  assert.equal(m.splitAmount(40000,300).commission,0);
  assert.equal(m.splitAmount(100000,10).commission,30000);
  assert.equal(m.splitAmount(50050,3).commission,4505,"round each line once to the nearest centavo");
  const mixed=m.splitOrderItems([{price:40000,quantity:4},{price:100000,quantity:2},{price:600000,quantity:1}]);
  assert.equal(mixed.gross,960000);assert.equal(mixed.commission,36000);assert.equal(mixed.seller,924000);
  for(const invalid of [-1,1.5,NaN,Infinity])assert.throws(()=>m.splitAmount(invalid));
  for(const invalid of [0,-1,1.5,NaN])assert.throws(()=>m.splitAmount(100000,invalid));
});
test("webhooks require the raw body, test signature, matching HMAC and a recent timestamp",async()=>{
  const secret="fixture-webhook-secret",now=Date.now(),timestamp=String(Math.floor(now/1000)),raw=JSON.stringify({data:{id:"evt_fixture",attributes:{livemode:false}}});
  const api=await loadFinanceModule("lib/payments/paymongo.js",{env:{PAYMONGO_WEBHOOK_SECRET:secret}});
  const signature=createHmac("sha256",secret).update(`${timestamp}.${raw}`).digest("hex");
  api.verifySignature(raw,`t=${timestamp},te=${signature},li=`,now);
  for(const header of [null,`t=${timestamp},li=${signature}`,`t=${timestamp},te=${"0".repeat(64)}`,`t=1,te=${signature}`])assert.throws(()=>api.verifySignature(raw,header,now));
  assert.throws(()=>api.verifySignature(`${raw} `,`t=${timestamp},te=${signature}`,now));
});
test("a live secret key is rejected before a provider request",async()=>{
  let calls=0;const api=await loadFinanceModule("lib/payments/paymongo.js",{env:{PAYMONGO_SECRET_KEY:"sk_live_fixture"},fetch:async()=>{calls++;}});
  await assert.rejects(api.paymongo("/v2/checkout_sessions",{method:"POST"}),error=>error.status===503);assert.equal(calls,0);
});
test("payout details are encrypted and authenticated",async()=>{
  const api=await loadFinanceModule("lib/payments/security.js",{env:{WALLET_ENCRYPTION_KEY:"ab".repeat(32)}});
  const encrypted=api.encryptAccount("09171234567");assert.ok(!encrypted.includes("09171234567"));assert.equal(api.decryptAccount(encrypted),"09171234567");
  const parts=encrypted.split(".");parts[1]=Buffer.from("tampered").toString("base64url");assert.throws(()=>api.decryptAccount(parts.join(".")));
});
for(const role of [null,"user","bao","admin"]){test(`${role||"anonymous"} cannot access a seller wallet`,async()=>{
  const api=await loadFinanceModule("app/api/wallet/route.js",{account:role?{id:1,role,status:"active"}:null});
  assert.equal((await api.GET()).status,role?403:401);
});}
test("buyer and seller marketplace sessions do not authorize BAO finances",async()=>{
  for(const role of ["user","seller"]){const api=await loadFinanceModule("app/api/bao/finance/route.js",{account:{id:1,role,status:"active"}});assert.equal((await api.GET()).status,401);}
});

test("commission and dashboard reports require a staff session before reading financial data",async()=>{
  let queries=0;
  for(const account of [null,{id:1,role:"user",status:"active"},{id:2,role:"seller",status:"active"}]){
    for(const file of ["app/api/bao/commissions/route.js","app/api/bao/dashboard/route.js"]){
      const api=await loadFinanceModule(file,{account,db:{query:async()=>{queries++;return [[]];}}});
      const response=await api.GET(new Request("http://localhost/api/bao/commissions"));
      assert.equal(response.status,401);
    }
  }
  assert.equal(queries,0);
});
test("BAO cannot change admin financial settings",async()=>{
  const api=await loadFinanceModule("app/api/bao/finance/route.js",{staff:{id:3,role:"bao"}});
  assert.equal((await api.PATCH(new Request("http://localhost/api/bao/finance",{method:"PATCH",body:"{}"}))).status,403);
});
test("a frontend return URL cannot confirm a payment without authenticated provider lookup",async()=>{
  const calls=[];
  const api=await loadFinanceModule("app/api/payments/[id]/route.js",{account:{id:1,role:"user",status:"active"},db:{query:async(sql)=>{calls.push(sql);return [[]];}}});
  const response=await api.GET(new Request("http://localhost/api/payments/11111111-1111-4111-8111-111111111111?result=success"),{params:Promise.resolve({id:"11111111-1111-4111-8111-111111111111"})});
  assert.equal(response.status,404);assert.ok(calls.every(sql=>sql.startsWith("SELECT")));
});

test("anonymous and inactive accounts cannot obtain realtime topics",async()=>{
  let queries=0;
  for(const account of [null,{id:1,role:"user",status:"pending"}]){
    const api=await loadFinanceModule("app/api/realtime/channel/route.js",{account,db:{query:async()=>{queries++;return [[]];}}});
    const response=await api.GET(new Request("http://localhost/api/realtime/channel"));
    assert.equal(response.status,account?403:401);
  }
  assert.equal(queries,0);
});

test("realtime topic identity comes from the session, ignoring client-sent user IDs",async()=>{
  const topic="11111111-1111-4111-8111-111111111111",calls=[];
  const api=await loadFinanceModule("app/api/realtime/channel/route.js",{account:{id:1,role:"user",status:"active"},db:{query:async(sql,values)=>{calls.push(values);return [[{topic}]];}}});
  const response=await api.GET(new Request("http://localhost/api/realtime/channel?user_id=99&topic=other-user"));
  assert.equal(response.status,200);assert.deepEqual(Array.from(calls[0]),[1]);
  assert.equal((await response.json()).topic,`marketplace:${topic}`);assert.equal(response.headers.get("cache-control"),"private, no-store");
});

test("staff realtime checks the staff cookie and fresh database role independently of marketplace login",async()=>{
  const topic="11111111-1111-4111-8111-111111111111",calls=[];
  const api=await loadFinanceModule("app/api/realtime/channel/route.js",{account:{id:1,role:"user",status:"active"},staff:{id:3,role:"bao"},db:{query:async(sql,values)=>{calls.push(values);return sql.startsWith("SELECT")?[[{id:3,role:"bao",status:"active"}]]:[[{topic}]];}}});
  assert.equal((await api.GET(new Request("http://localhost/api/realtime/channel?audience=staff"))).status,200);
  assert.equal(calls.length,2);assert.ok(calls.every(values=>values[0]===3));
});

test("demoted staff and marketplace sessions alone cannot obtain staff realtime access",async()=>{
  for(const staff of [null,{id:3,role:"bao"}]){
    const api=await loadFinanceModule("app/api/realtime/channel/route.js",{account:{id:1,role:"user",status:"active"},staff,db:{query:async()=>[[{id:3,role:"user",status:"active"}]]}});
    assert.equal((await api.GET(new Request("http://localhost/api/realtime/channel?audience=staff"))).status,staff?403:401);
  }
});

for(const role of [null,"user","seller"]){test(`${role||"anonymous"} cannot submit BAO commission destinations or withdrawals`,async()=>{
  for(const path of ["destinations","cashouts"]){
    let queries=0;
    const api=await loadFinanceModule(`app/api/bao/finance/wallet/${path}/route.js`,{account:role?{id:1,role,status:"active"}:null,db:{query:async()=>{queries++;return [[]];}}});
    assert.equal((await api.POST(new Request(`http://localhost/api/bao/finance/wallet/${path}`,{method:"POST",body:"{}"}))).status,401);assert.equal(queries,0);
  }
});}
