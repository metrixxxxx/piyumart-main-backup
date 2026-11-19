// Synthetic records in an isolated schema; no real gateway payment or payout.
import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import pg from "pg";
import dotenv from "dotenv";
import {loadFinanceModule} from "./helpers/load-finance-module.mjs";
import {proofPhoto,withProofStorage} from "./helpers/proof-photo.mjs";

test("BAO commission withdrawal lifecycle",{skip:process.env.PIYUMART_FINANCE_DB_TEST!=="1"},async t=>{
  dotenv.config({path:".env.local",quiet:true});
  const schema=`piyumart_bao_test_${randomUUID().replaceAll("-","")}`;
  assert.match(schema,/^piyumart_bao_test_[a-f0-9]{32}$/);
  const config={connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000,query_timeout:15000};
  const control=new pg.Pool(config);let pool,created=false;
  try{
    await control.query(`CREATE SCHEMA ${schema}`);created=true;
    pool=new pg.Pool({...config,options:`-c search_path=${schema},public`});
    const query=async(sql,values)=>(await pool.query(sql,values)).rows;
    const migrate=async path=>pool.query((await readFile(path,"utf8")).replaceAll("public.",`${schema}.`).replaceAll("search_path=public",`search_path=${schema}`));
    await pool.query(await readFile("tests/fixtures/finance-base.sql","utf8"));await migrate("migrations/add_marketplace_payments.sql");
    await migrate("migrations/add_bao_item_price_tiers.sql");
    const legacyDestination=randomUUID(),legacyCashout=randomUUID();
    await query("INSERT INTO wallet_destinations(id,seller_id,institution,account_name,account_number_encrypted,account_last_four,fingerprint,status) VALUES($1,2,'TESTPHMM','Legacy fixture','original-ciphertext','4567','legacy-fixture','approved')",[legacyDestination]);
    await query("INSERT INTO cashout_requests(id,wallet_id,seller_id,destination_id,amount,idempotency_key,status) SELECT $1,id,2,$2,100,$3,'rejected' FROM wallets WHERE owner_id=2",[legacyCashout,legacyDestination,randomUUID()]);
    await migrate("migrations/add_bao_commission_cashouts.sql");
    await migrate("migrations/add_marketplace_realtime.sql");
    const legacyBaoDestination=randomUUID(),legacyBaoCashout=randomUUID();
    const [commissionWallet]=await query("SELECT id FROM wallets WHERE kind='bao'");
    await query("INSERT INTO wallet_destinations(id,seller_id,wallet_id,submitted_by,institution,account_name,account_number_encrypted,account_last_four,fingerprint) VALUES($1,NULL,$2,3,'TESTPHMM','Legacy BAO','preserved-bao-ciphertext','2222','legacy-bao')",[legacyBaoDestination,commissionWallet.id]);
    await query("INSERT INTO cashout_requests(id,wallet_id,seller_id,destination_id,amount,idempotency_key,requested_by) VALUES($1,$2,NULL,$3,100,$4,3)",[legacyBaoCashout,commissionWallet.id,legacyBaoDestination,randomUUID()]);
    await query("INSERT INTO wallet_transactions(wallet_id,bucket,amount,kind,idempotency_key,cashout_id) VALUES($1,'available',100,'fixture','legacy-bao-funding',NULL),($1,'available',-100,'cashout_reserved','legacy-bao-reserve-available',$2),($1,'reserved',100,'cashout_reserved','legacy-bao-reserve-reserved',$2)",[commissionWallet.id,legacyBaoCashout]);
    const ledgerBefore=await query("SELECT * FROM wallet_transactions ORDER BY id");
    await migrate("migrations/auto_approve_bao_cashouts.sql");
    let notificationFailure=false;
    const db={query:async(sql,values)=>[await query(sql,values)],transaction:async callback=>{const client=await pool.connect();try{await client.query("BEGIN");const result=await callback(client);await client.query("COMMIT");return result;}catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}}};
    const sessions=new Map(),transfers=new Map();let providerCalls=0,eventNumber=0;
    const provider=async(url,options={})=>{
      providerCalls++;const path=new URL(url).pathname;
      if(path==="/v2/checkout_sessions"&&options.method==="POST"){
        const attributes=JSON.parse(options.body).data.attributes,id=`cs_bao${sessions.size+1}`;
        const session={id,attributes:{...attributes,livemode:false,status:"active",checkout_url:`https://checkout.paymongo.com/${id}`,payment_intent:{id:`pi_bao${sessions.size+1}`},payments:[]}};sessions.set(id,session);return Response.json({data:session});
      }
      if(path.startsWith("/v2/transfers/"))return Response.json({data:transfers.get(path.split("/").at(-1))});
      throw new Error("Unexpected fixture provider request");
    };
    const env={WALLET_ENCRYPTION_KEY:"ab".repeat(32),PAYMONGO_SECRET_KEY:"sk_test_fixture",PAYMONGO_PAYOUTS_ENABLED:"true",APP_URL:"http://localhost:3000"};
    const options=withProofStorage({db,env,fetch:provider,notificationFailure:()=>notificationFailure});
    const wallet=await loadFinanceModule("lib/payments/wallet.js",options),checkout=await loadFinanceModule("lib/payments/checkout.js",options),lifecycle=await loadFinanceModule("lib/payments/events.js",options);
    const destinationInput={institution:"TESTPHMM",account_name:"Demo BAO",account_number:"09171234567"};
    const event=(type,resource)=>({id:`evt_bao${++eventNumber}`,attributes:{type,livemode:false,data:resource}});
    async function paidOrder(quantity){
      const order=await checkout.createMarketplaceOrders(1,{name:"Fixture buyer",address:"Library",payment_method:"paymongo",items:[{product_id:1,quantity}]},randomUUID());
      const payment=await checkout.startCheckout(order.paymentId,1),session=sessions.get(payment.checkout_session_id);
      session.attributes.payments=[{id:`pay_bao${sessions.size}`,attributes:{status:"paid",currency:"PHP",amount:100000*quantity,livemode:false}}];
      const payload=event("checkout_session.payment.paid",session);await lifecycle.processPaymentEvent(payload,JSON.stringify(payload));return {...order,session};
    }
    async function complete(order){for(const status of ["confirmed","processing","shipped"])await lifecycle.transitionOnlineOrder(2,order.orderIds[0],{status});await lifecycle.transitionOnlineOrder(1,order.orderIds[0],{action:"confirm_delivery"},proofPhoto());}
    const balance=async()=>(await wallet.financeDashboard()).balances;
    const transfer=(id,status,amount=10000)=>({id,attributes:{livemode:false,status,currency:"PHP",amount,destination_account:{bic:"TESTPHMM",name:"Demo BAO",number:"09171234567"}}});
    let destination,funded,request,key;
    await t.test("migration retains seller history and is safe to replay",async()=>{
      await migrate("migrations/add_bao_commission_cashouts.sql");
      const [auditsBefore]=await query("SELECT count(*)::int AS count FROM bao_audit_logs");
      await migrate("migrations/auto_approve_bao_cashouts.sql");
      const [record]=await query("SELECT d.wallet_id,d.submitted_by,d.account_number_encrypted,c.requested_by,w.owner_id FROM wallet_destinations d JOIN cashout_requests c ON c.destination_id=d.id JOIN wallets w ON w.id=d.wallet_id WHERE c.id=$1",[legacyCashout]);
      assert.equal(record.submitted_by,2);assert.equal(record.requested_by,2);assert.equal(record.owner_id,2);assert.equal(record.account_number_encrypted,"original-ciphertext");
      assert.deepEqual(await query("SELECT * FROM wallet_transactions ORDER BY id"),ledgerBefore);
      assert.equal((await query("SELECT count(*)::int AS count FROM bao_audit_logs"))[0].count,auditsBefore.count);
      const [legacy]=await query("SELECT d.status AS destination_status,d.account_number_encrypted,d.reviewed_by,c.status AS cashout_status,c.reviewed_by AS cashout_reviewer FROM wallet_destinations d JOIN cashout_requests c ON c.destination_id=d.id WHERE c.id=$1",[legacyBaoCashout]);
      assert.equal(legacy.destination_status,"approved");assert.equal(legacy.cashout_status,"approved");assert.equal(legacy.reviewed_by,null);assert.equal(legacy.cashout_reviewer,null);assert.equal(legacy.account_number_encrypted,"preserved-bao-ciphertext");
      assert.equal((await balance()).reserved,"100.00");
      await wallet.reviewCashout(3,legacyBaoCashout,"cancel");
      await query("INSERT INTO wallet_transactions(wallet_id,bucket,amount,kind,idempotency_key) VALUES($1,'available',-100,'fixture','remove-legacy-bao-funding')",[commissionWallet.id]);
      assert.equal((await balance()).available,"0.00");assert.equal((await balance()).reserved,"0.00");
    });
    await t.test("previous seller inserts still work after the migration",async()=>{
      const [old]=await query("INSERT INTO wallet_destinations(seller_id,institution,account_name,account_number_encrypted,account_last_four,fingerprint) VALUES(2,'TESTPHMM','Compatibility fixture','encrypted','1111','legacy-compat') RETURNING id,wallet_id,submitted_by,status");
      assert.equal(old.submitted_by,2);assert.ok(old.wallet_id);assert.equal(old.status,"pending");
      await assert.rejects(wallet.requestCashout(2,{amount:"100.00",destination_id:old.id},randomUUID()),error=>error.status===400);
      const [cashout]=await query("INSERT INTO cashout_requests(wallet_id,seller_id,destination_id,amount,idempotency_key,status) VALUES($1,2,$2,100,$3,'rejected') RETURNING requested_by",[old.wallet_id,old.id,randomUUID()]);assert.equal(cashout.requested_by,2);
    });
    await t.test("BAO destination comes from the staff session and encrypts the account",async()=>{
      const api=await loadFinanceModule("app/api/bao/finance/wallet/destinations/route.js",{...options,staff:{id:3,role:"bao"}});
      const response=await api.POST(new Request("http://localhost/api/bao/finance/wallet/destinations",{method:"POST",body:JSON.stringify({...destinationInput,seller_id:2,submitted_by:4})}));assert.equal(response.status,201);destination=await response.json();
      const [row]=await query("SELECT d.*,w.kind FROM wallet_destinations d JOIN wallets w ON w.id=d.wallet_id WHERE d.id=$1",[destination.id]);assert.equal(row.kind,"bao");assert.equal(row.seller_id,null);assert.equal(row.submitted_by,3);assert.ok(!row.account_number_encrypted.includes(destinationInput.account_number));
      await assert.rejects(wallet.addCommissionDestination(4,destinationInput),error=>error.status===409);
    });
    await t.test("BAO destinations are immediately ready without a review or a fictitious reviewer",async()=>{
      assert.equal(destination.status,"approved");
      for(const actor of [3,4])await assert.rejects(wallet.reviewDestination(actor,destination.id,"approve"),error=>error.status===409);
      const [row]=await query("SELECT reviewed_by,reviewed_at FROM wallet_destinations WHERE id=$1",[destination.id]);assert.equal(row.reviewed_by,null);assert.equal(row.reviewed_at,null);
      const [compat]=await query("INSERT INTO wallet_destinations(seller_id,wallet_id,submitted_by,institution,account_name,account_number_encrypted,account_last_four,fingerprint) VALUES(NULL,$1,3,'TESTPHMM','Default insert','encrypted','3333','bao-default-insert') RETURNING status",[commissionWallet.id]);assert.equal(compat.status,"approved");
    });
    await t.test("pending commission cannot be withdrawn; buyer receipt releases exactly 3%",async()=>{
      funded=await paidOrder(10);assert.equal((await balance()).pending,"300.00");assert.equal((await balance()).available,"0.00");
      await assert.rejects(wallet.requestCommissionCashout(3,{amount:"100.00",destination_id:destination.id},randomUUID()),error=>error.status===409);
      await complete(funded);assert.equal((await balance()).pending,"0.00");assert.equal((await balance()).available,"300.00");
      await assert.rejects(wallet.requestCommissionCashout(3,{amount:"99.00",destination_id:destination.id},randomUUID()),error=>error.status===400);
    });
    await t.test("seller and commission wallets cannot use each other's destinations",async()=>{
      await assert.rejects(wallet.requestCommissionCashout(3,{amount:"100.00",destination_id:legacyDestination},randomUUID()),error=>error.status===400);
      await assert.rejects(wallet.requestCashout(2,{amount:"100.00",destination_id:destination.id},randomUUID()),error=>error.status===400);
      const [seller]=await query("SELECT id FROM wallets WHERE owner_id=2");
      await assert.rejects(query("INSERT INTO cashout_requests(wallet_id,seller_id,destination_id,amount,idempotency_key,requested_by) VALUES($1,2,$2,100,$3,2)",[seller.id,destination.id,randomUUID()]),error=>error.code==="23503");
    });
    await t.test("concurrent commission requests cannot overspend; cancellation releases once",async()=>{
      const results=await Promise.allSettled([3,4].map(actor=>wallet.requestCommissionCashout(actor,{amount:"200.00",destination_id:destination.id},randomUUID())));
      assert.equal(results.filter(result=>result.status==="fulfilled").length,1);
      const item=results.find(result=>result.status==="fulfilled").value;assert.equal((await balance()).available,"100.00");assert.equal((await balance()).reserved,"200.00");
      assert.equal(item.status,"approved");await wallet.reviewCashout(4,item.id,"cancel");await assert.rejects(wallet.reviewCashout(4,item.id,"cancel"),error=>error.status===409);assert.equal((await balance()).available,"300.00");assert.equal((await balance()).reserved,"0.00");
      assert.equal((await query("SELECT status FROM cashout_requests WHERE id=$1",[item.id]))[0].status,"cancelled");
    });
    await t.test("cashout notification failure rolls back reservation and request",async()=>{
      notificationFailure=true;try{await assert.rejects(wallet.requestCommissionCashout(3,{amount:"100.00",destination_id:destination.id},randomUUID()),error=>error.message==="Injected notification failure");}finally{notificationFailure=false;}
      assert.equal((await balance()).available,"300.00");assert.equal((await balance()).reserved,"0.00");
    });
    await t.test("cashout identity and wallet ignore client fields and retries reserve only once",async()=>{
      key=randomUUID();const api=await loadFinanceModule("app/api/bao/finance/wallet/cashouts/route.js",{...options,staff:{id:3,role:"bao"}});
      const response=await api.POST(new Request("http://localhost/api/bao/finance/wallet/cashouts",{method:"POST",headers:{"Idempotency-Key":key},body:JSON.stringify({amount:"100.00",destination_id:destination.id,seller_id:2,requested_by:4,wallet_id:randomUUID()})}));assert.equal(response.status,201);request=await response.json();
      const again=await wallet.requestCommissionCashout(3,{amount:"100.00",destination_id:destination.id},key);assert.equal(again.id,request.id);
      await assert.rejects(wallet.requestCommissionCashout(4,{amount:"100.00",destination_id:destination.id},key),error=>error.status===409);
      const [row]=await query("SELECT c.requested_by,c.seller_id,w.kind FROM cashout_requests c JOIN wallets w ON w.id=c.wallet_id WHERE c.id=$1",[request.id]);assert.equal(row.requested_by,3);assert.equal(row.seller_id,null);assert.equal(row.kind,"bao");assert.equal((await balance()).available,"200.00");assert.equal((await balance()).reserved,"100.00");
    });
    await t.test("BAO withdrawals skip review and reserve funds without marking them paid",async()=>{
      assert.equal(request.status,"approved");for(const actor of [3,4])await assert.rejects(wallet.reviewCashout(actor,request.id,"approve"),error=>error.status===409);
      assert.equal((await query("SELECT status FROM cashout_requests WHERE id=$1",[request.id]))[0].status,"approved");assert.equal((await balance()).reserved,"100.00");
      const audit=await query("SELECT actor_id,action FROM bao_audit_logs WHERE entity_id=$1 ORDER BY id",[request.id]);assert.ok(audit.some(row=>row.actor_id===3&&row.action==="bao_cashout_requested"));assert.ok(!audit.some(row=>row.action==="bao_cashout_approved"));
      const [row]=await query("SELECT reviewed_by,reviewed_at FROM cashout_requests WHERE id=$1",[request.id]);assert.equal(row.reviewed_by,null);assert.equal(row.reviewed_at,null);
    });
    await t.test("disabled payout access and mismatched transfers cannot complete withdrawal",async()=>{
      const disabled=await loadFinanceModule("lib/payments/wallet.js",{...options,env:{...env,PAYMONGO_PAYOUTS_ENABLED:"false"}}),before=providerCalls;
      await assert.rejects(disabled.verifyPayout(4,request.id,"tr_baowrong"),error=>error.status===503);assert.equal(providerCalls,before);
      transfers.set("tr_baowrong",transfer("tr_baowrong","succeeded",9999));await assert.rejects(wallet.verifyPayout(4,request.id,"tr_baowrong"),error=>error.status===409);assert.equal((await balance()).reserved,"100.00");
    });
    await t.test("verified payout completes once and never deducts the seller wallet",async()=>{
      const sellerBefore=(await wallet.sellerWallet(2)).balances.available;
      transfers.set("tr_baopaid",transfer("tr_baopaid","pending"));await wallet.verifyPayout(4,request.id,"tr_baopaid");assert.equal((await balance()).reserved,"100.00");
      await assert.rejects(wallet.reviewCashout(3,request.id,"cancel"),error=>error.status===409);
      transfers.set("tr_baopaid",transfer("tr_baopaid","succeeded"));await wallet.verifyPayout(4,request.id,"tr_baopaid");await wallet.verifyPayout(4,request.id,"tr_baopaid");
      const dashboard=await wallet.financeDashboard();assert.equal(dashboard.balances.reserved,"0.00");assert.equal(dashboard.commissionWallet.withdrawals,"100.00");assert.equal(Number(dashboard.totals.withdrawals),0);assert.equal((await wallet.sellerWallet(2)).balances.available,sellerBefore);assert.ok(!JSON.stringify(dashboard).includes(destinationInput.account_number));
    });
    await t.test("failed commission payouts restore reserved funds once",async()=>{
      const failed=await wallet.requestCommissionCashout(4,{amount:"100.00",destination_id:destination.id},randomUUID());assert.equal(failed.status,"approved");
      transfers.set("tr_baofailed",transfer("tr_baofailed","failed"));await wallet.verifyPayout(3,failed.id,"tr_baofailed");await wallet.verifyPayout(3,failed.id,"tr_baofailed");assert.equal((await balance()).available,"200.00");assert.equal((await balance()).reserved,"0.00");
    });
    await t.test("refund recovery blocks commission withdrawals and future commission repays debt",async()=>{
      const refund=event("payment.refund.updated",{id:"ref_baofixture",attributes:{payment_id:funded.session.attributes.payments[0].id,livemode:false,currency:"PHP",amount:1000000,status:"succeeded"}});await lifecycle.processPaymentEvent(refund,JSON.stringify(refund));
      assert.equal((await balance()).available,"0.00");assert.equal((await balance()).debt,"100.00");await assert.rejects(wallet.requestCommissionCashout(3,{amount:"100.00",destination_id:destination.id},randomUUID()),error=>error.status===409);
      const future=await paidOrder(5);await complete(future);assert.equal((await balance()).debt,"0.00");assert.equal((await balance()).available,"50.00");
    });
    await t.test("demoted staff cannot request commission withdrawals",async()=>{
      await query("UPDATE users SET role='user' WHERE id=3");
      try{await assert.rejects(wallet.requestCommissionCashout(3,{amount:"100.00",destination_id:destination.id},randomUUID()),error=>error.status===403);}finally{await query("UPDATE users SET role='bao' WHERE id=3");}
    });
    await t.test("cancelling through the API settles refund recovery and a retry never reserves again",async()=>{
      const purchase=await paidOrder(5);await complete(purchase);
      const cancellationKey=randomUUID(),item=await wallet.requestCommissionCashout(3,{amount:"100.00",destination_id:destination.id},cancellationKey);
      const refund=event("payment.refund.updated",{id:"ref_baocancel",attributes:{payment_id:purchase.session.attributes.payments[0].id,livemode:false,currency:"PHP",amount:500000,status:"succeeded"}});await lifecycle.processPaymentEvent(refund,JSON.stringify(refund));
      assert.equal((await balance()).debt,"50.00");assert.equal((await balance()).reserved,"100.00");
      const api=await loadFinanceModule("app/api/bao/finance/cashouts/[id]/route.js",{...options,staff:{id:3,role:"bao"}});
      const response=await api.PATCH(new Request(`http://localhost/api/bao/finance/cashouts/${item.id}`,{method:"PATCH",body:JSON.stringify({action:"cancel"})}),{params:Promise.resolve({id:item.id})});
      assert.equal(response.status,200);assert.equal((await response.json()).status,"cancelled");
      assert.equal((await balance()).debt,"0.00");assert.equal((await balance()).reserved,"0.00");assert.equal((await balance()).available,"50.00");
      const again=await wallet.requestCommissionCashout(3,{amount:"100.00",destination_id:destination.id},cancellationKey);assert.equal(again.id,item.id);assert.equal(again.status,"cancelled");assert.equal((await balance()).available,"50.00");
      await assert.rejects(wallet.reviewCashout(3,legacyCashout,"cancel"),error=>error.status===400);
    });
  }finally{if(pool)await pool.end();if(created)await control.query(`DROP SCHEMA ${schema} CASCADE`);await control.end();}
});
