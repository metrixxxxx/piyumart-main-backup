import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import pg from "pg";
import dotenv from "dotenv";
import {createClient} from "@supabase/supabase-js";
import {loadFinanceModule} from "./helpers/load-finance-module.mjs";

test("paginated marketplace read performance and isolation",{skip:process.env.PIYUMART_PERFORMANCE_DB_TEST!=="1"},async t=>{
  dotenv.config({path:".env.local",quiet:true});
  const schema=`piyumart_perf_test_${randomUUID().replaceAll("-","")}`;
  assert.match(schema,/^piyumart_perf_test_[a-f0-9]{32}$/);
  const config={connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000,query_timeout:15000};
  const control=new pg.Pool(config);let pool,created=false,realtime;
  try{
    await control.query(`CREATE SCHEMA ${schema}`);created=true;
    pool=new pg.Pool({...config,options:`-c search_path=${schema},public`});
    const sql=async(sql,values)=>(await pool.query(sql,values)).rows;
    const migrate=async path=>pool.query((await readFile(path,"utf8")).replaceAll("public.",`${schema}.`).replaceAll("search_path=public",`search_path=${schema}`));
    await pool.query(await readFile("tests/fixtures/finance-base.sql","utf8"));
    await pool.query(await readFile("tests/fixtures/performance.sql","utf8"));
    await migrate("migrations/add_seller_application_cor.sql");
    for(const path of ["migrations/add_marketplace_payments.sql","migrations/add_bao_item_price_tiers.sql","migrations/add_bao_commission_cashouts.sql","migrations/add_marketplace_realtime.sql","migrations/add_marketplace_performance.sql"])await migrate(path);
    let queries=[];
    const db={query:async(text,values)=>{queries.push(text);return [await sql(text,values)];}};
    const context=account=>({db,account});
    const buyer={id:1,role:"user",status:"active"},seller={id:2,role:"seller",status:"active"};
    const catalog=await loadFinanceModule("app/api/products/route.js",context(buyer));
    await t.test("catalog pages are deterministic, bounded and do not repeat rows",async()=>{
      const ids=[];
      for(const page of [1,2]){queries=[];const r=await catalog.GET(new Request(`http://localhost/api/products?page=${page}`));assert.equal(r.status,200);const rows=await r.json();assert.equal(rows.length,20);assert.equal(queries.length,2);ids.push(...rows.map(row=>row.id));assert.ok(rows.every(row=>row.status==="approved"&&row.is_visible));}
      assert.equal(new Set(ids).size,40);
      const r=await catalog.GET(new Request("http://localhost/api/products?pageSize=100000"));assert.equal((await r.json()).length,48);assert.equal(r.headers.get("cache-control"),"private, no-store");
    });
    await t.test("search and category apply before pagination and literal wildcards stay literal",async()=>{
      const r=await catalog.GET(new Request("http://localhost/api/products?q=%25"));const rows=await r.json();assert.equal(rows.length,1);assert.equal(rows[0].name,"Literal%Notebook");
      const category=await catalog.GET(new Request("http://localhost/api/products?category=2&page=2"));assert.ok((await category.json()).every(row=>row.category_id===2));
    });
    await t.test("personalized and shop results preserve seller isolation and inactive filtering",async()=>{
      const own=await loadFinanceModule("app/api/products/route.js",context(seller));
      let r=await own.GET(new Request("http://localhost/api/products"));assert.ok((await r.json()).every(row=>row.seller_id!==2));
      r=await own.GET(new Request("http://localhost/api/products?seller_id=2"));assert.equal((await r.json()).length,20);
      r=await catalog.GET(new Request("http://localhost/api/products?seller_id=7"));assert.deepEqual(await r.json(),[]);
    });
    await t.test("out-of-range pages skip the row scan",async()=>{
      queries=[];const r=await catalog.GET(new Request("http://localhost/api/products?page=100000"));assert.deepEqual(await r.json(),[]);assert.equal(queries.length,1);
    });
    await t.test("seller inventory hydrates one page in five data queries, including metadata",async()=>{
      const api=await loadFinanceModule("app/api/sell/route.js",context(seller));queries=[];
      const r=await api.GET(new Request("http://localhost/api/sell?page=2"));assert.equal(r.status,200);const rows=await r.json();assert.equal(rows.length,20);assert.equal(queries.length,5);
      assert.ok(rows.every(row=>row.seller_id===2&&row.images.length===2&&row.variants.length===1&&row.attributes.length===1));assert.equal(r.headers.get("x-total-listings"),"252");
      const hidden=await api.GET(new Request("http://localhost/api/sell?visibility=hidden"));assert.ok((await hidden.json()).every(row=>!row.is_visible));assert.equal(hidden.headers.get("x-total-count"),"1");
    });
    await t.test("buyer history uses three queries per page, complete items and global status counts",async()=>{
      const api=await loadFinanceModule("app/api/orders/route.js",context(buyer));queries=[];
      const r=await api.GET(new Request("http://localhost/api/orders?page=2&pageSize=10"));assert.equal(r.status,200);const rows=await r.json();assert.equal(rows.length,10);assert.ok(rows.every(row=>row.items.length===1));assert.equal(queries.length,3);assert.equal(r.headers.get("x-total-count"),"76");
      const counts=JSON.parse(r.headers.get("x-status-counts"));assert.equal(counts.pending+counts.completed,76);
      const other=await loadFinanceModule("app/api/orders/route.js",context({id:5,role:"user",status:"active"}));assert.deepEqual(await(await other.GET(new Request("http://localhost/api/orders"))).json(),[]);
    });
    await t.test("seller pagination is by order and retains only that seller's legacy items",async()=>{
      const api=await loadFinanceModule("app/api/seller/orders/route.js",context(seller));
      const r=await api.GET(new Request("http://localhost/api/seller/orders?pageSize=10"));assert.equal(r.status,200);const rows=await r.json();assert.equal(new Set(rows.map(row=>row.id)).size,10);assert.equal(r.headers.get("x-total-count"),"76");
      const latest=rows.filter(row=>row.id===Math.max(...rows.map(row=>row.id)));assert.equal(latest.length,1);assert.equal(latest[0].product_name,"Legacy own item");
      const other=await loadFinanceModule("app/api/seller/orders/route.js",context({id:6,role:"seller",status:"active"}));const otherRows=await(await other.GET(new Request("http://localhost/api/seller/orders"))).json();assert.equal(otherRows.length,1);assert.equal(otherRows[0].product_name,"Legacy other item");
    });
    await t.test("seller reviews are paginated without duplicate variants",async()=>{
      const api=await loadFinanceModule("app/api/seller/reviews/route.js",context(seller));const r=await api.GET(new Request("http://localhost/api/seller/reviews?page=2"));assert.equal(r.status,200);assert.equal((await r.json()).length,20);assert.equal(r.headers.get("x-total-count"),"55");
    });
    await t.test("staff application pages are bounded and omit private document keys",async()=>{
      const api=await loadFinanceModule("app/api/bao/seller-applications/route.js",{db,staff:{id:3,role:"bao"}});
      const r=await api.GET(new Request("http://localhost/api/bao/seller-applications?status=approved&page=2"));assert.equal(r.status,200);const body=await r.json();assert.equal(body.applications.length,20);assert.equal(r.headers.get("x-total-count"),"55");assert.ok(!JSON.stringify(body).includes("fixture-proof"));
    });
    await t.test("synthetic catalog response size is reduced compared with the old full-table response",async()=>{
      const raw=await sql("SELECT p.* FROM products p WHERE p.status='approved' AND p.is_visible=true AND EXISTS(SELECT 1 FROM users u WHERE u.id=p.seller_id AND u.status='active')");
      const response=await catalog.GET(new Request("http://localhost/api/products")),body=await response.text();
      const before=Buffer.byteLength(JSON.stringify(raw)),after=Buffer.byteLength(body);assert.ok(after<before/10);assert.ok(JSON.parse(body).every(row=>row.description.length<=500));
      t.diagnostic(`Synthetic catalog: ${raw.length} full records / ${before} bytes → 20 page records / ${after} bytes; inventory 1+3N → 5 data queries; buyer history 1+N → 3 data queries.`);
    });
    await t.test("public catalog broadcasts carry no rows and rollbacks emit nothing",async()=>{
      const messages=[],inventory=[],unrelated=[];realtime=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
      async function topic(account){const api=await loadFinanceModule("app/api/realtime/channel/route.js",context(account));return (await(await api.GET(new Request("http://localhost/api/realtime/channel"))).json()).topic;}
      const ownerTopic=await topic(seller),buyerTopic=await topic(buyer);
      function subscribe(topic,event,target){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error("Catalog subscription timeout")),15000);realtime.channel(topic).on("broadcast",{event},({payload})=>target.push(payload)).subscribe(status=>{if(status==="SUBSCRIBED"){clearTimeout(timer);resolve();}else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"){clearTimeout(timer);reject(new Error("Catalog subscription failed"));}});});}
      await Promise.all([subscribe("marketplace:catalog","catalog:changed",messages),subscribe(ownerTopic,"marketplace:changed",inventory),subscribe(buyerTopic,"marketplace:changed",unrelated)]);
      await sql("UPDATE products SET stock=stock-1 WHERE id=1");const until=Date.now()+10000;while((messages.length===0||inventory.length===0)&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,25));assert.ok(messages.length);assert.ok(inventory.some(payload=>payload.scope==="inventory"));assert.equal(unrelated.length,0);assert.ok(messages.every(payload=>Object.keys(payload).every(key=>["id","scope"].includes(key))&&payload.scope==="catalog"));
      await new Promise(resolve=>setTimeout(resolve,150));messages.length=0;inventory.length=0;
      await sql("UPDATE products SET stock=stock-1 WHERE name='Pending fixture'");const wait=Date.now()+10000;while(inventory.length===0&&Date.now()<wait)await new Promise(resolve=>setTimeout(resolve,25));assert.ok(inventory.length);await new Promise(resolve=>setTimeout(resolve,150));assert.equal(messages.length,0);
      inventory.length=0;const c=await pool.connect();try{await c.query("BEGIN");await c.query("UPDATE products SET stock=stock-1 WHERE id=1");await c.query("ROLLBACK");}finally{c.release();}await new Promise(resolve=>setTimeout(resolve,300));assert.equal(messages.length,0);assert.equal(inventory.length,0);assert.equal(unrelated.length,0);
    });
  }finally{if(realtime)await realtime.removeAllChannels();if(pool)await pool.end();if(created)await control.query(`DROP SCHEMA ${schema} CASCADE`);await control.end();}
});
