// Explicit opt-in. Creates and drops a uniquely named test schema, never public data.
// PayMongo is replaced with documented test fixtures; no gateway request is made.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import dotenv from "dotenv";
import { loadFinanceModule } from "./helpers/load-finance-module.mjs";
import { proofPhoto, withProofStorage } from "./helpers/proof-photo.mjs";

test("Postgres marketplace payment lifecycle",{skip:process.env.PIYUMART_FINANCE_DB_TEST!=="1"},async t=>{
  dotenv.config({path:".env.local",quiet:true});
  const schema=`piyumart_finance_test_${randomUUID().replaceAll("-","")}`;
  assert.match(schema,/^piyumart_finance_test_[a-f0-9]{32}$/);
  const config={connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000,query_timeout:15000};
  const control=new pg.Pool(config);let pool,created=false;
  try{
    await control.query(`CREATE SCHEMA ${schema}`);created=true;
    pool=new pg.Pool({...config,options:`-c search_path=${schema},public`,max:6});
    await pool.query(await readFile("tests/fixtures/finance-base.sql","utf8"));
    let migration=await readFile("migrations/add_marketplace_payments.sql","utf8");
    migration=migration.replaceAll("public.",`${schema}.`).replaceAll("search_path=public",`search_path=${schema}`);
    await pool.query(migration);
    const tierMigration=(await readFile("migrations/add_bao_item_price_tiers.sql","utf8")).replaceAll("public.",`${schema}.`).replaceAll("search_path=public",`search_path=${schema}`);
    await pool.query(tierMigration);
    const commissionMigration=(await readFile("migrations/add_bao_commission_cashouts.sql","utf8")).replaceAll("public.",`${schema}.`).replaceAll("search_path=public",`search_path=${schema}`);
    await pool.query(commissionMigration);
    const baoPolicy=(await readFile("migrations/auto_approve_bao_cashouts.sql","utf8")).replaceAll("public.",`${schema}.`).replaceAll("search_path=public",`search_path=${schema}`);
    await pool.query(baoPolicy);
    const realtimeMigration=(await readFile("migrations/add_marketplace_realtime.sql","utf8")).replaceAll("public.",`${schema}.`).replaceAll("search_path=public",`search_path=${schema}`);
    await pool.query(realtimeMigration);
    for (const filename of ["migrations/add_reviews_and_sold_count.sql", "tests/fixtures/user-deletion.sql", "migrations/add_user_deletion_cleanup.sql"]) {
      const source = (await readFile(filename, "utf8")).replaceAll("public.", `${schema}.`).replaceAll("search_path=public", `search_path=${schema}`);
      await pool.query(source);
    }
    const db={query:async(sql,values)=>[(await pool.query(sql,values)).rows],transaction:async callback=>{const client=await pool.connect();try{await client.query("BEGIN");const result=await callback(client);await client.query("COMMIT");return result;}catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}}};
    const env={PAYMONGO_SECRET_KEY:"sk_test_fixture_only",PAYMONGO_WEBHOOK_SECRET:"fixture-secret",WALLET_ENCRYPTION_KEY:"ab".repeat(32),PAYMONGO_PAYOUTS_ENABLED:"true",APP_URL:"http://localhost:3000"};
    const sessions=new Map(),transfers=new Map();let providerCalls=0,notificationFailure=false,events=0;
    const provider=async(url,options={})=>{
      providerCalls++;const path=new URL(url).pathname;
      if(path==="/v2/checkout_sessions"&&options.method==="POST"){
        const input=JSON.parse(options.body).data.attributes,id=`cs_fixture${sessions.size+1}`;
        const resource={id,type:"checkout_session",attributes:{...input,livemode:false,status:"active",checkout_url:`https://checkout.paymongo.com/${id}`,payment_intent:{id:`pi_fixture${sessions.size+1}`},payments:[]}};sessions.set(id,resource);return Response.json({data:resource});
      }
      if(path.startsWith("/v1/checkout_sessions/")){
        const id=path.split("/")[3],resource=sessions.get(id);if(!resource)throw new Error("Unknown fixture session");
        if(path.endsWith("/expire")){
          if(resource.attributes.payments.some(item=>item.attributes.status==="paid"))return Response.json({errors:[{code:"already_paid"}]},{status:400});
          resource.attributes.status="expired";
        }return Response.json({data:resource});
      }
      if(path.startsWith("/v2/transfers/")){const value=transfers.get(path.split("/").at(-1));if(!value)throw new Error("Unknown transfer fixture");return Response.json({data:value});}
      throw new Error(`Undocumented or unexpected provider path: ${path}`);
    };
    const options=withProofStorage({db,env,fetch:provider,notificationFailure:()=>notificationFailure});
    const checkout=await loadFinanceModule("lib/payments/checkout.js",options),wallet=await loadFinanceModule("lib/payments/wallet.js",options),lifecycle=await loadFinanceModule("lib/payments/events.js",options);
    const { transitionOrder } = await loadFinanceModule("lib/orders/fulfillment.js", options);
    const input={name:"Fixture buyer",address:"Library",payment_method:"paymongo",items:[{product_id:1,quantity:1,price:0.01}],total:0.01};
    const query=async(sql,values)=>(await pool.query(sql,values)).rows;
    const makeCheckout=async()=>{const result=await checkout.createMarketplaceOrders(1,input,randomUUID());const payment=await checkout.startCheckout(result.paymentId,1);return {...result,payment};};
    const event=(type,resource)=>({id:`evt_fixture${++events}`,attributes:{type,livemode:false,data:resource}});
    async function pay(order){const session=sessions.get(order.payment.checkout_session_id);session.attributes.payments=[{id:`pay_${session.id.slice(3)}`,attributes:{status:"paid",currency:"PHP",amount:100000,fee:100,livemode:false}}];const payload=event("checkout_session.payment.paid",session);await lifecycle.processPaymentEvent(payload,JSON.stringify(payload));return payload;}
    async function complete(order){for(const status of ["preparing","ready_for_pickup"])await transitionOrder(2,order.orderIds[0],{status});await transitionOrder(1,order.orderIds[0],{action:"confirm_receipt"},proofPhoto());}
    let first,destination,cashout;
    await t.test("client amounts are ignored; concurrent checkout creation and provider starts are idempotent",async()=>{
      const key=randomUUID(),results=await Promise.all([checkout.createMarketplaceOrders(1,input,key),checkout.createMarketplaceOrders(1,input,key)]);
      assert.equal(results[0].paymentId,results[1].paymentId);assert.equal((await query("SELECT count(*)::int AS count FROM orders"))[0].count,1);
      assert.equal((await query("SELECT total FROM orders"))[0].total,"1000.00");assert.equal((await query("SELECT stock FROM products WHERE id=1"))[0].stock,99);
      const before=providerCalls,prepared=await Promise.all([checkout.startCheckout(results[0].paymentId,1),checkout.startCheckout(results[0].paymentId,1)]);
      assert.equal(providerCalls-before,1);first={...results[0],payment:prepared.find(item=>item.checkout_session_id)};
      assert.equal((await query("SELECT count(*)::int AS count FROM wallet_transactions"))[0].count,0);
    });
    await t.test("notification failure rolls back payment state, credits, and webhook claim",async()=>{
      notificationFailure=true;await assert.rejects(pay(first));notificationFailure=false;
      assert.equal((await query("SELECT status FROM payments WHERE id=$1",[first.paymentId]))[0].status,"pending");assert.equal((await query("SELECT count(*)::int AS count FROM wallet_transactions"))[0].count,0);
    });
    await t.test("payment confirms only once, records 970/30 pending, and preserves fulfillment status",async()=>{
      const payload=await pay(first),before=(await query("SELECT count(*)::int AS count FROM wallet_transactions"))[0].count;
      await lifecycle.processPaymentEvent(payload,JSON.stringify(payload));await lifecycle.processPaymentEvent({...payload,id:"evt_otherdelivery"},"different delivery");
      assert.equal((await query("SELECT count(*)::int AS count FROM wallet_transactions"))[0].count,before);
      assert.equal((await query("SELECT status FROM orders WHERE id=$1",[first.orderIds[0]]))[0].status,"pending");
      const balances=await wallet.sellerWallet(2);assert.equal(balances.balances.pending,"970.00");assert.equal(balances.balances.available,"0.00");
      assert.equal((await wallet.financeDashboard()).balances.pending,"30.00");
    });
    await t.test("seller and unrelated buyer cannot confirm receipt; buyer confirmation releases balances once",async()=>{
      await assert.rejects(transitionOrder(2,first.orderIds[0],{status:"completed"}));await assert.rejects(transitionOrder(5,first.orderIds[0],{status:"preparing"}));
      await complete(first);await assert.rejects(transitionOrder(1,first.orderIds[0],{status:"completed"}));
      const balance=await wallet.sellerWallet(2);assert.equal(balance.balances.available,"970.00");assert.equal(balance.balances.pending,"0.00");assert.equal((await query("SELECT stock FROM products WHERE id=1"))[0].stock,99);
    });
    await t.test("destinations require BAO approval and private account numbers are never returned",async()=>{
      destination=await wallet.addDestination(2,{institution:"TESTPHMM",account_name:"Fixture Seller",account_number:"09171234567"});
      await assert.rejects(wallet.requestCashout(2,{amount:"100.00",destination_id:destination.id},randomUUID()));
      await wallet.reviewDestination(3,destination.id,"approve");assert.ok(!JSON.stringify(await wallet.sellerWallet(2)).includes("09171234567"));
    });
    await t.test("overspending and concurrent reservations cannot make available balance negative",async()=>{
      await assert.rejects(wallet.requestCashout(2,{amount:"971.00",destination_id:destination.id},randomUUID()),err=>err.status===409);
      const results=await Promise.allSettled([wallet.requestCashout(2,{amount:"700.00",destination_id:destination.id},randomUUID()),wallet.requestCashout(2,{amount:"700.00",destination_id:destination.id},randomUUID())]);
      assert.equal(results.filter(result=>result.status==="fulfilled").length,1);cashout=results.find(result=>result.status==="fulfilled").value;
      assert.equal((await wallet.sellerWallet(2)).balances.available,"270.00");
      await wallet.reviewCashout(3,cashout.id,"reject","Fixture rejection");assert.equal((await wallet.sellerWallet(2)).balances.available,"970.00");
    });
    await t.test("duplicate cashout requests and approvals do not duplicate reservations",async()=>{
      const key=randomUUID();const a=await wallet.requestCashout(2,{amount:"200.00",destination_id:destination.id},key),b=await wallet.requestCashout(2,{amount:"200.00",destination_id:destination.id},key);assert.equal(a.id,b.id);cashout=a;
      await wallet.reviewCashout(3,cashout.id,"approve");await assert.rejects(wallet.reviewCashout(3,cashout.id,"approve"),err=>err.status===409);
      assert.equal((await wallet.sellerWallet(2)).balances.reserved,"200.00");
    });
    const transfer=(id,status)=>({id,type:"transfer",attributes:{livemode:false,status,currency:"PHP",amount:20000,reference_number:`fixture-${id}`,destination_account:{number:"09171234567",name:"Fixture Seller",bic:"TESTPHMM"}}});
    await t.test("a pending payout cannot complete cashout; confirmed payout deducts reserved funds exactly once",async()=>{
      transfers.set("tr_fixture1",transfer("tr_fixture1","pending"));await wallet.verifyPayout(3,cashout.id,"tr_fixture1");assert.equal((await query("SELECT status FROM cashout_requests WHERE id=$1",[cashout.id]))[0].status,"processing");
      transfers.set("tr_fixture1",transfer("tr_fixture1","succeeded"));await wallet.verifyPayout(3,cashout.id,"tr_fixture1");await wallet.verifyPayout(3,cashout.id,"tr_fixture1");
      const balance=await wallet.sellerWallet(2);assert.equal(balance.balances.reserved,"0.00");assert.equal(balance.totals.withdrawals,"200.00");assert.equal(balance.balances.available,"770.00");
    });
    await t.test("full refund reverses both allocations and records recovery without a negative balance",async()=>{
      const payment=(await query("SELECT * FROM payments WHERE id=$1",[first.paymentId]))[0],refund={id:"ref_fixture1",attributes:{payment_id:payment.provider_payment_id,livemode:false,currency:"PHP",amount:100000,status:"succeeded"}},payload=event("payment.refund.updated",refund);
      await lifecycle.processPaymentEvent(payload,JSON.stringify(payload));await lifecycle.processPaymentEvent({...payload,id:"evt_refundredelivery"},"retry");
      const balance=await wallet.sellerWallet(2);assert.equal(balance.balances.available,"0.00");assert.equal(balance.balances.debt,"200.00");assert.equal(balance.totals.earnings,"0.00");assert.equal((await wallet.financeDashboard()).balances.available,"0.00");
    });
    await t.test("new earnings recover refund debt before becoming withdrawable",async()=>{
      const order=await makeCheckout();await pay(order);await complete(order);const balance=await wallet.sellerWallet(2);assert.equal(balance.balances.debt,"0.00");assert.equal(balance.balances.available,"770.00");
    });
    await t.test("failed payout returns reserved funds once",async()=>{
      const request=await wallet.requestCashout(2,{amount:"200.00",destination_id:destination.id},randomUUID());await wallet.reviewCashout(3,request.id,"approve");transfers.set("tr_fixturefailed",transfer("tr_fixturefailed","failed"));await wallet.verifyPayout(3,request.id,"tr_fixturefailed");await wallet.verifyPayout(3,request.id,"tr_fixturefailed");
      assert.equal((await wallet.sellerWallet(2)).balances.available,"770.00");assert.equal((await wallet.sellerWallet(2)).balances.reserved,"0.00");
    });
    await t.test("cancelled and expired provider sessions restore inventory only once",async()=>{
      for(const cancel of [true,false]){const order=await makeCheckout(),stock=(await query("SELECT stock FROM products WHERE id=1"))[0].stock;await lifecycle.reconcilePayment(order.paymentId,cancel?{cancel:true}:{expire:true});await lifecycle.reconcilePayment(order.paymentId,cancel?{cancel:true}:{expire:true});assert.equal((await query("SELECT stock FROM products WHERE id=1"))[0].stock,stock+1);assert.equal((await query("SELECT status FROM payments WHERE id=$1",[order.paymentId]))[0].status,cancel?"cancelled":"expired");}
    });
    await t.test("failed payment attempt stays retryable and does not create wallet credits",async()=>{
      const order=await makeCheckout(),before=(await query("SELECT count(*)::int AS count FROM wallet_transactions"))[0].count;
      const payload=event("payment.failed",{id:"pay_failedfixture",attributes:{payment_intent_id:order.payment.payment_intent_id,status:"failed",livemode:false}});await lifecycle.processPaymentEvent(payload,JSON.stringify(payload));
      assert.equal((await query("SELECT error_code FROM payments WHERE id=$1",[order.paymentId]))[0].error_code,"payment_attempt_failed");assert.equal((await query("SELECT count(*)::int AS count FROM wallet_transactions"))[0].count,before);await lifecycle.reconcilePayment(order.paymentId,{cancel:true});
    });
    await t.test("ledger rejects direct negative balances and history edits",async()=>{
      const [{id}]=await query("SELECT id FROM wallets WHERE owner_id=2");await assert.rejects(pool.query("INSERT INTO wallet_transactions(wallet_id,bucket,amount,kind,idempotency_key) VALUES($1,'available',-999999,'fixture','negative-fixture')",[id]));await assert.rejects(pool.query("UPDATE wallet_transactions SET amount=1 WHERE wallet_id=$1",[id]));
    });
    await t.test("financial tables block Supabase anonymous access",async()=>{
      const client=await pool.connect();try{await client.query("BEGIN");await client.query("SET LOCAL ROLE anon");await assert.rejects(client.query(`SELECT * FROM ${schema}.wallet_transactions`));}finally{await client.query("ROLLBACK");client.release();}
    });
    await t.test("concurrent payment and cashout preserve all wallet buckets",async()=>{
      const order=await makeCheckout(),before=await wallet.sellerWallet(2);
      const [,request]=await Promise.all([pay(order),wallet.requestCashout(2,{amount:"100.00",destination_id:destination.id},randomUUID())]);
      const balance=await wallet.sellerWallet(2);
      assert.equal(Number(balance.balances.available),Number(before.balances.available)-100);assert.equal(balance.balances.pending,"970.00");assert.equal(balance.balances.reserved,"100.00");
      await wallet.reviewCashout(3,request.id,"reject","Concurrent test complete");await complete(order);
    });
    await t.test("partial refunds reverse exact centavos and a full remainder reverses the whole allocation",async()=>{
      const order=await makeCheckout();await pay(order);
      const [payment]=await query("SELECT * FROM payments WHERE id=$1",[order.paymentId]);
      for(const [index,amount]of [1,49,99950].entries()){
        const refund={id:`ref_partial${index}`,attributes:{payment_id:payment.provider_payment_id,livemode:false,currency:"PHP",amount,status:"succeeded"}},payload=event("payment.refund.updated",refund);await lifecycle.processPaymentEvent(payload,JSON.stringify(payload));
      }
      const [allocation]=await query("SELECT * FROM payment_allocations WHERE payment_id=$1",[order.paymentId]);assert.equal(allocation.refunded_amount,"1000.00");assert.equal(allocation.commission_refunded,"30.00");assert.equal(allocation.seller_refunded,"970.00");assert.equal((await wallet.sellerWallet(2)).balances.pending,"0.00");
    });
    await t.test("mismatched paid amount is rolled back and does not claim the webhook",async()=>{
      const order=await makeCheckout(),session=sessions.get(order.payment.checkout_session_id);
      session.attributes.payments=[{id:"pay_mismatchfixture",attributes:{status:"paid",amount:1,currency:"PHP",livemode:false}}];const payload=event("checkout_session.payment.paid",session);
      await assert.rejects(lifecycle.processPaymentEvent(payload,JSON.stringify(payload)),err=>err.status===409);assert.equal((await query("SELECT count(*)::int AS count FROM payment_webhook_events WHERE event_id=$1",[payload.id]))[0].count,0);
    });
    await t.test("unpaid fulfillment is denied and definite provider rejection releases stock",async()=>{
      const created=await checkout.createMarketplaceOrders(1,input,randomUUID()),stock=(await query("SELECT stock FROM products WHERE id=1"))[0].stock;
      await assert.rejects(transitionOrder(2,created.orderIds[0],{status:"preparing"}),err=>err.status===409);
      const rejecting=await loadFinanceModule("lib/payments/checkout.js",{...options,fetch:async()=>Response.json({errors:[{code:"payment_method_not_allowed"}]},{status:400})});
      assert.equal((await rejecting.startCheckout(created.paymentId,1)).status,"failed");assert.equal((await query("SELECT stock FROM products WHERE id=1"))[0].stock,stock+1);
    });
    await t.test("ambiguous provider timeout cannot cause a second checkout POST",async()=>{
      const created=await checkout.createMarketplaceOrders(1,input,randomUUID());let calls=0;
      const unavailable=await loadFinanceModule("lib/payments/checkout.js",{...options,fetch:async()=>{calls++;throw new TypeError("fixture timeout");}});
      await unavailable.startCheckout(created.paymentId,1);await unavailable.startCheckout(created.paymentId,1);assert.equal(calls,1);assert.equal((await query("SELECT status FROM payments WHERE id=$1",[created.paymentId]))[0].status,"pending");
    });
    await t.test("seller statistics use the online allocation snapshot after refunds",async()=>{
      const context={...options,account:{id:2,role:"seller",status:"active"}};
      const stats=await loadFinanceModule("app/api/my-listings/stats/route.js",context),orders=await loadFinanceModule("app/api/seller/orders/route.js",context);
      const response=await stats.GET();assert.equal(response.status,200);const result=await response.json();assert.equal(result.unrecordedCompletedOrders,0);
      const orderResponse=await orders.GET();assert.equal(orderResponse.status,200);const sellerOrders=await orderResponse.json();assert.ok(sellerOrders.some(order=>order.payment_method==="paymongo"&&Number(order.commission_rate)===3));
    });
    await t.test("multi-seller payment refunds reverse each seller and BAO without losing a centavo",async()=>{
      await pool.query("INSERT INTO users VALUES(6,'Second Seller','','second@example.invalid','seller','active')");await pool.query("INSERT INTO products(seller_id,name,price,stock,status,is_visible) VALUES(6,'Second product',700,20,'approved',true)");
      const created=await checkout.createMarketplaceOrders(1,{...input,items:[{product_id:1,quantity:1},{product_id:2,quantity:1}]},randomUUID()),payment=await checkout.startCheckout(created.paymentId,1),session=sessions.get(payment.checkout_session_id);
      session.attributes.payments=[{id:"pay_multisellerfixture",attributes:{status:"paid",currency:"PHP",amount:170000,fee:100,livemode:false}}];const payload=event("checkout_session.payment.paid",session);await lifecycle.processPaymentEvent(payload,JSON.stringify(payload));
      for(const [index,amount]of [10001,159999].entries()){const refund=event("payment.refund.updated",{id:`ref_multiseller${index}`,attributes:{payment_id:"pay_multisellerfixture",livemode:false,currency:"PHP",amount,status:"succeeded"}});await lifecycle.processPaymentEvent(refund,JSON.stringify(refund));}
      const allocations=await query("SELECT * FROM payment_allocations WHERE payment_id=$1",[created.paymentId]);assert.equal(allocations.length,2);for(const item of allocations){assert.equal(item.gross_amount,item.refunded_amount);assert.equal(item.seller_amount,item.seller_refunded);assert.equal(item.commission_amount,item.commission_refunded);}assert.equal((await wallet.sellerWallet(6)).balances.pending,"0.00");
    });
    await t.test("varchar order status supports fulfillment, notification rollback and buyer-only completion",async()=>{
      const [column]=await query("SELECT udt_name FROM information_schema.columns WHERE table_schema=$1 AND table_name='orders' AND column_name='status'",[schema]);
      assert.equal(column.udt_name,"varchar");
      const order=await makeCheckout();await pay(order);const id=order.orderIds[0];
      notificationFailure=true;
      try{await assert.rejects(transitionOrder(2,id,{status:"preparing"}),error=>error.message==="Injected notification failure");}finally{notificationFailure=false;}
      const [unchanged]=await query("SELECT status,confirmed_at FROM orders WHERE id=$1",[id]);
      assert.equal(unchanged.status,"pending");assert.equal(unchanged.confirmed_at,null);
      const before=(await query("SELECT count(*)::int AS count FROM wallet_transactions WHERE order_id=$1",[id]))[0].count;
      for(const status of ["preparing","ready_for_pickup"]){
        const result=await transitionOrder(2,id,{status});
        assert.equal(result.success,true);assert.equal(result.status,status);
        assert.equal((await query("SELECT status FROM orders WHERE id=$1",[id]))[0].status,status);
      }
      assert.equal((await query("SELECT count(*)::int AS count FROM wallet_transactions WHERE order_id=$1",[id]))[0].count,before);
      for(const actor of [2,5])await assert.rejects(transitionOrder(actor,id,{status:"completed"}),error=>error.status===403);
      const result=await transitionOrder(1,id,{action:"confirm_receipt"},proofPhoto());assert.equal(result.status,"completed");
      const [completed]=await query("SELECT status,confirmed_at,shipped_at,completed_at FROM orders WHERE id=$1",[id]);
      assert.equal(completed.status,"completed");assert.ok(completed.confirmed_at);assert.ok(completed.shipped_at);assert.ok(completed.completed_at);
      const after=(await query("SELECT count(*)::int AS count FROM wallet_transactions WHERE order_id=$1",[id]))[0].count;
      assert.ok(after>before);await assert.rejects(transitionOrder(1,id,{action:"confirm_receipt"}),error=>error.status===409);
      assert.equal((await query("SELECT count(*)::int AS count FROM wallet_transactions WHERE order_id=$1",[id]))[0].count,after);
    });
  }finally{
    if(pool)await pool.end();if(created)await control.query(`DROP SCHEMA ${schema} CASCADE`);await control.end();
  }
});
