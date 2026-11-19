// Explicit opt-in: synthetic records in a temporary schema, real Supabase WebSockets.
import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {setTimeout as delay} from "node:timers/promises";
import pg from "pg";
import dotenv from "dotenv";
import {createClient} from "@supabase/supabase-js";
import {loadFinanceModule} from "./helpers/load-finance-module.mjs";
import {proofPhoto,withProofStorage} from "./helpers/proof-photo.mjs";

test("Supabase database-triggered marketplace realtime",{skip:process.env.PIYUMART_REALTIME_DB_TEST!=="1"},async t=>{
  dotenv.config({path:".env.local",quiet:true});
  const schema=`piyumart_realtime_test_${randomUUID().replaceAll("-","")}`;
  assert.match(schema,/^piyumart_realtime_test_[a-f0-9]{32}$/);
  const config={connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000,query_timeout:15000};
  const control=new pg.Pool(config);let pool,realtime,created=false;
  try{
    await control.query(`CREATE SCHEMA ${schema}`);created=true;
    pool=new pg.Pool({...config,options:`-c search_path=${schema},public`});
    await pool.query(await readFile("tests/fixtures/finance-base.sql","utf8"));
    for(const path of ["migrations/add_marketplace_payments.sql","migrations/add_bao_item_price_tiers.sql","migrations/add_bao_commission_cashouts.sql","migrations/auto_approve_bao_cashouts.sql","migrations/add_marketplace_realtime.sql"]){
      const sql=(await readFile(path,"utf8")).replaceAll("public.",`${schema}.`).replaceAll("search_path=public",`search_path=${schema}`);
      await pool.query(sql);
    }
    const query=async(sql,values)=>(await pool.query(sql,values)).rows;
    const db={query:async(sql,values)=>[await query(sql,values)],transaction:async callback=>{const client=await pool.connect();try{await client.query("BEGIN");const result=await callback(client);await client.query("COMMIT");return result;}catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}}};
    async function topicFor(id,role){
      const api=await loadFinanceModule("app/api/realtime/channel/route.js",{db,account:{id,role,status:"active"},staff:role==="bao"?{id,role}:null});
      const response=await api.GET(new Request(`http://localhost/api/realtime/channel${role==="bao"?"?audience=staff":""}`));
      assert.equal(response.status,200);return (await response.json()).topic;
    }
    const topics={buyer:await topicFor(1,"user"),seller:await topicFor(2,"seller"),staff:await topicFor(3,"bao"),other:await topicFor(5,"user")};
    const messages=[];
    realtime=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    await Promise.all(Object.entries(topics).map(([name,topic])=>new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error(`Realtime subscription timed out: ${name}`)),15000);
      realtime.channel(topic).on("broadcast",{event:"marketplace:changed"},({payload})=>messages.push({name,payload})).subscribe(status=>{
        if(status==="SUBSCRIBED"){clearTimeout(timeout);resolve();}
        else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"){clearTimeout(timeout);reject(new Error(`Realtime subscription failed: ${name} (${status})`));}
      });
    })));
    async function received(names,scope){
      const expires=Date.now()+10000;
      while(Date.now()<expires&&!names.every(name=>messages.some(message=>message.name===name&&message.payload.scope===scope)))await delay(25);
      assert.ok(names.every(name=>messages.some(message=>message.name===name&&message.payload.scope===scope)),`Missing ${scope} broadcast`);
      await delay(150);
      for(const message of messages){assert.deepEqual(Object.keys(message.payload).sort(),["id","scope"]);assert.match(message.payload.id,/^[a-f0-9-]{36}$/i);assert.notEqual(message.name,"other");}
    }
    let orderId;
    await t.test("committed orders reach buyer, seller and staff without broadcasting records",async()=>{
      const [order]=await query("INSERT INTO orders(user_id,seller_id,payment_method,total,status) VALUES(1,2,'cod',1000,'pending') RETURNING id");orderId=order.id;
      await received(["buyer","seller","staff"],"orders");
    });
    await t.test("rolled-back order changes emit nothing",async()=>{
      messages.length=0;const client=await pool.connect();
      try{await client.query("BEGIN");await client.query("UPDATE orders SET status='confirmed' WHERE id=$1",[orderId]);await client.query("ROLLBACK");}finally{client.release();}
      await delay(350);assert.equal(messages.length,0);assert.equal((await query("SELECT status FROM orders WHERE id=$1",[orderId]))[0].status,"pending");
    });
    await t.test("unchanged writes do not generate refresh loops",async()=>{
      messages.length=0;await query("UPDATE orders SET status=status WHERE id=$1",[orderId]);await delay(350);assert.equal(messages.length,0);
    });
    await t.test("payment changes reach the buyer and finance staff",async()=>{
      messages.length=0;await query("INSERT INTO payments(user_id,reference,idempotency_key,request_hash,amount) VALUES(1,$1,$2,'fixture',1000)",[`realtime-${randomUUID()}`,randomUUID()]);
      await received(["buyer","staff"],"payments");assert.ok(messages.every(message=>message.name!=="seller"));
    });
    await t.test("wallet credits reach the seller and finance staff",async()=>{
      messages.length=0;
      await query("INSERT INTO wallet_transactions(wallet_id,bucket,amount,kind,idempotency_key) SELECT id,'available',970,'fixture',$1 FROM wallets WHERE owner_id=2",[randomUUID()]);
      await received(["seller","staff"],"wallet");assert.ok(messages.every(message=>message.name!=="buyer"));
    });
    await t.test("destination approval and cashout review update the seller wallet automatically",async()=>{
      const wallet=await loadFinanceModule("lib/payments/wallet.js",{db,env:{WALLET_ENCRYPTION_KEY:"ab".repeat(32)}});
      messages.length=0;const destination=await wallet.addDestination(2,{institution:"TESTPHMM",account_name:"Fixture Seller",account_number:"09171234567"});
      await received(["seller","staff"],"wallet");messages.length=0;
      await wallet.reviewDestination(3,destination.id,"approve");await received(["seller","staff"],"wallet");messages.length=0;
      const cashout=await wallet.requestCashout(2,{amount:"100.00",destination_id:destination.id},randomUUID());await received(["seller","staff"],"wallet");messages.length=0;
      await wallet.reviewCashout(3,cashout.id,"reject","Fixture review");await received(["seller","staff"],"wallet");
      assert.equal((await wallet.sellerWallet(2)).balances.reserved,"0.00");
    });
    await t.test("anonymous database access cannot enumerate topics or call the sender",async()=>{
      for(const sql of [`SELECT * FROM ${schema}.marketplace_realtime_channels`,`SELECT ${schema}.emit_marketplace_change(1,'orders')`]){
        const client=await pool.connect();try{await client.query("BEGIN");await client.query("SET LOCAL ROLE anon");await assert.rejects(client.query(sql),error=>error.code==="42501");}finally{await client.query("ROLLBACK");client.release();}
      }
    });
    await t.test("settings changes refresh seller wallets and staff finance",async()=>{
      messages.length=0;await query("UPDATE finance_settings SET minimum_cashout=125 WHERE id=true");await received(["seller","staff"],"finance");assert.ok(messages.every(message=>message.name!=="buyer"));
    });
    await t.test("online seller and buyer API actions broadcast automatically after commit",async()=>{
      messages.length=0;await query("UPDATE orders SET payment_method='paymongo',payment_status='paid' WHERE id=$1",[orderId]);await received(["buyer","seller","staff"],"orders");
      const seller=await loadFinanceModule("app/api/seller/orders/[id]/route.js",{db,account:{id:2,role:"seller",status:"active"}});
      for(const status of ["confirmed","processing","shipped"]){
        messages.length=0;const response=await seller.PATCH(new Request(`http://localhost/api/seller/orders/${orderId}`,{method:"PATCH",body:JSON.stringify({status})}),{params:Promise.resolve({id:String(orderId)})});
        assert.equal(response.status,200);assert.equal((await response.json()).status,status);await received(["buyer","seller","staff"],"orders");
      }
      messages.length=0;const buyer=await loadFinanceModule("app/api/orders/[id]/route.js",withProofStorage({db,account:{id:1,role:"user",status:"active"}}));
      const form=new FormData();form.set("action","confirm_delivery");form.set("pickup_proof",proofPhoto());
      const response=await buyer.PATCH(new Request(`http://localhost/api/orders/${orderId}`,{method:"PATCH",body:form}),{params:Promise.resolve({id:String(orderId)})});
      assert.equal(response.status,200);assert.equal((await response.json()).status,"completed");await received(["buyer","seller","staff"],"orders");
    });
    await t.test("BAO commission destination and cashout changes reach staff without notifying sellers",async()=>{
      const wallet=await loadFinanceModule("lib/payments/wallet.js",{db,env:{WALLET_ENCRYPTION_KEY:"ab".repeat(32)}});
      messages.length=0;await query("INSERT INTO wallet_transactions(wallet_id,bucket,amount,kind,idempotency_key) SELECT id,'available',150,'fixture',$1 FROM wallets WHERE kind='bao'",[randomUUID()]);await received(["staff"],"wallet");assert.ok(messages.every(message=>message.name==="staff"));
      messages.length=0;const destination=await wallet.addCommissionDestination(3,{institution:"TESTPHMM",account_name:"Fixture BAO",account_number:"09179876543"});await received(["staff"],"wallet");
      assert.equal(destination.status,"approved");
      messages.length=0;const cashout=await wallet.requestCommissionCashout(3,{amount:"125.00",destination_id:destination.id},randomUUID());await received(["staff"],"wallet");assert.ok(messages.every(message=>message.name==="staff"));
      assert.equal(cashout.status,"approved");messages.length=0;await wallet.reviewCashout(4,cashout.id,"cancel");await received(["staff"],"wallet");assert.ok(messages.every(message=>message.name==="staff"));
    });
  }finally{
    if(realtime)await realtime.removeAllChannels();if(pool)await pool.end();
    if(created)await control.query(`DROP SCHEMA ${schema} CASCADE`);await control.end();
  }
});
