import { readFile } from "node:fs/promises";
import { resolve,dirname,extname } from "node:path";
import { SourceTextModule,SyntheticModule,createContext } from "node:vm";
export async function loadFinanceModule(file,{db,env={},fetch,account=null,staff=null,notificationFailure=()=>false}={}) {
  const root=process.cwd(),context=createContext({Buffer,Request,Response,FormData,File,URL,AbortSignal,fetch,process:{env},console:{error(){}}}),cache=new Map();
  const mocks={"server-only":{},"@/lib/db":{db},"next/server":{NextResponse:Response},"next-auth":{getServerSession:async()=>account?{user:account}:null},"next-auth/next":{getServerSession:async()=>account?{user:account}:null},"@/lib/authOptions":{authOptions:{}},"@/app/api/auth/[...nextauth]/route":{authOptions:{}},"@/lib/seller-access":{getMarketplaceAccount:async()=>account,isActiveSellerAccount:async()=>account?.role==="seller"&&account.status==="active"},"@/lib/bao-access":{getBaoAccess:async()=>staff?{session:{user:staff},status:200}:{session:null,status:401}},
    "@/lib/notify":{createNotificationRecord:async({userId,type,message},client)=>{
      if(notificationFailure())throw new Error("Injected notification failure");
      const {rows}=await client.query("INSERT INTO notifications(user_id,type,message) VALUES($1,$2,$3) RETURNING *",[userId,type,message]);return rows[0];
    }}};
  async function moduleFor(specifier,parent=root) {
    const mocked=Object.hasOwn(mocks,specifier),native=specifier.startsWith("node:"),key=mocked||native?specifier:specifier.startsWith("@/")?resolve(root,specifier.slice(2)):resolve(parent,specifier);
    const filename=mocked||native||extname(key)?key:`${key}.js`;
    if(cache.has(filename))return cache.get(filename);
    const pending=(async()=>{
      if(mocked||native){const values=mocked?mocks[specifier]:await import(specifier);return new SyntheticModule(Object.keys(values),function(){for(const [key,value]of Object.entries(values))this.setExport(key,value);},{context,identifier:filename});}
      return new SourceTextModule(await readFile(filename,"utf8"),{context,identifier:filename});
    })();cache.set(filename,pending);return pending;
  }
  const mod=await moduleFor(resolve(root,file));await mod.link((specifier,parent)=>moduleFor(specifier,dirname(parent.identifier)));await mod.evaluate();return mod.namespace;
}
