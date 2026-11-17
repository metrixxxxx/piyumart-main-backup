import test from "node:test";
import assert from "node:assert/strict";
import {loadFinanceModule} from "./helpers/load-finance-module.mjs";

test("pagination validates input, caps page size and computes offsets",async()=>{
  const m=await loadFinanceModule("lib/pagination.js");
  const value=m.readPagination(new Request("http://localhost?page=3&pageSize=1000"));
  assert.equal(value.page,3);assert.equal(value.pageSize,48);assert.equal(value.offset,96);
  for(const params of ["page=0","page=-1","page=NaN","page=1.5","page=100001","pageSize=0","pageSize=9007199254740992"]){
    assert.throws(()=>m.readPagination(new Request("http://localhost?"+params)),error=>error.status===400);
  }
  assert.equal(m.pageHeaders({page:1,pageSize:20},0)["X-Total-Pages"],"1");
});

test("public category/featured caching reuses successful reads and invalidates after mutations",async()=>{
  const cache=new Map(),settings=[],invalidations=[];let queries=0;
  const m=await loadFinanceModule("lib/catalog-cache.js",{db:{query:async()=>{queries++;return [[{id:1,name:"Fixture"}]];}},moduleMocks:{"next/cache":{
    unstable_cache:(fn,key,options)=>{settings.push(options);return(...args)=>{const k=JSON.stringify([key,args]);if(!cache.has(k))cache.set(k,fn(...args));return cache.get(k);};},
    revalidateTag:(tag,profile)=>{invalidations.push({tag,profile});cache.clear();},
  }}});
  await m.cachedCategories();await m.cachedCategories();await m.cachedFeatured();await m.cachedFeatured();assert.equal(queries,2);
  assert.equal(settings[0].revalidate,300);assert.equal(settings[1].revalidate,15);
  const deny=m.withCatalogInvalidation(async()=>Response.json({error:"Forbidden"},{status:403}));await deny();assert.equal(invalidations.length,0);
  const success=m.withCatalogInvalidation(async()=>Response.json({success:true}));await success();assert.equal(invalidations.length,1);assert.equal(invalidations[0].profile.expire,0);
  await m.cachedCategories();assert.equal(queries,3);
});

test("catalog rejects oversized searches and malformed filters before querying",async()=>{
  let queries=0;const api=await loadFinanceModule("lib/catalog.js",{db:{query:async()=>{queries++;throw new Error("Unexpected query");}}});
  for(const params of ["category=bad","seller_id=-1","seller_id=99999999999","sortBy=sql","q="+"a".repeat(101)])await assert.rejects(api.publicProducts(new Request("http://localhost?"+params),null),error=>error.status===400);
  assert.equal(queries,0);
});

test("public category requests deduplicate in flight and failed responses are retried",async()=>{
  let calls=0,finish;
  const pending=new Promise(resolve=>{finish=resolve;});
  const api=await loadFinanceModule("lib/client-catalog.js",{fetch:async()=>{calls++;if(calls===1)await pending;return Response.json([{id:1,name:"Books"}]);}});
  const first=api.getCategories(),second=api.getCategories();assert.equal(first,second);finish();await Promise.all([first,second]);await api.getCategories();assert.equal(calls,1);
  let attempts=0;const failing=await loadFinanceModule("lib/client-catalog.js",{fetch:async()=>{attempts++;return attempts===1?Response.json({error:"Busy"},{status:503}):Response.json([]);}});
  await assert.rejects(failing.getCategories());await failing.getCategories();assert.equal(attempts,2);
});

test("database pools are bounded, reuse connections and register idle error handling",async()=>{
  let config,errors=0;
  await loadFinanceModule("lib/db.js",{env:{DB_POOL_MAX:"99999",DB_STATEMENT_TIMEOUT_MS:"30000",DB_QUERY_TIMEOUT_MS:"1000"},moduleMocks:{pg:{default:{Pool:class{constructor(value){config=value;}on(event){if(event==="error")errors++;}},types:{setTypeParser(){}}}}}});
  assert.equal(config.max,5);assert.equal(config.connectionTimeoutMillis,10000);assert.equal(config.statement_timeout,30000);assert.ok(config.query_timeout>config.statement_timeout);assert.equal(errors,1);assert.equal(config.keepAlive,true);
});
