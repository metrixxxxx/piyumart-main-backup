"use client";
import { useEffect,useState } from "react";
import { useSession } from "next-auth/react";
import { useMarketplaceRealtime } from "@/lib/realtime/useMarketplaceRealtime";
import { financePanel,financeField,financeButton,php,financeDate,readable,TestModeNotice,MoneyCard,FinanceStatus } from "@/components/payments/FinanceUI";

export default function SellerWallet() {
  const [data,setData]=useState(null),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0);
  const [amount,setAmount]=useState(""),[destination,setDestination]=useState(""),[account,setAccount]=useState({institution:"",account_name:"",account_number:""});
  const [requestKey,setRequestKey]=useState(null);
  const {data:session}=useSession();
  useMarketplaceRealtime({enabled:!!session?.user?.id,identity:session?.user?.id,scopes:["wallet","finance"],onChange:()=>setRefresh(value=>value+1)});
  useEffect(()=>{let active=true;fetch("/api/wallet",{cache:"no-store"}).then(async response=>{const result=await response.json();if(!response.ok)throw new Error(result.error);if(active){setData(result);setError("");}}).catch(err=>{if(active)setError(err.message);});return()=>{active=false;};},[refresh]);
  async function submit(event,type) {
    event.preventDefault();setBusy(true);setError("");setNotice("");
    try {
      const key=requestKey||crypto.randomUUID();if(type==="cashout")setRequestKey(key);
      const response=await fetch(type==="cashout"?"/api/wallet/cashouts":"/api/wallet/destinations",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":key},body:JSON.stringify(type==="cashout"?{amount,destination_id:destination}:account)});
      const result=await response.json();if(!response.ok)throw new Error(result.error);
      setNotice(type==="cashout"?"Cashout requested. Your amount is reserved while BAO reviews it.":"Payout destination submitted for review.");
      if(type==="cashout"){setAmount("");setRequestKey(null);}else setAccount({institution:"",account_name:"",account_number:""});
      setRefresh(value=>value+1);
    }catch(err){setError(err.message);}finally{setBusy(false);}
  }
  return <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 text-slate-900 dark:text-slate-100 sm:px-6">
    <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-[#927116]">PiyuMart seller</p><h1 className="mt-2 text-3xl font-extrabold text-[#1a2a6c] dark:text-white">My wallet</h1></div><button onClick={()=>setRefresh(value=>value+1)} className={financeButton}>Refresh</button></div>
    <TestModeNotice />
    {error&&<p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{error}</p>}
    {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">{notice}</p>}
    {!data?<p className="text-sm">{error?"Wallet could not be loaded.":"Loading wallet..."}</p>:<>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[["Available",data.balances.available],["Pending",data.balances.pending],["Reserved for cashout",data.balances.reserved],["Total earnings",data.totals.earnings],["Total withdrawals",data.totals.withdrawals]].map(([label,value])=><MoneyCard key={label} label={label} value={value}/>)}</div>
      <p className="text-sm text-slate-600 dark:text-slate-400">Your allocation is 97% of each online order. {data.settings.release_policy==="buyer_confirmation"?"Pending earnings become available when the buyer confirms receipt.":"Earnings become available after payment confirmation."} Cash-on-pickup proceeds are handled directly with the buyer.</p>
      {Number(data.balances.debt)>0&&<p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">Refund recovery: {php(data.balances.debt)}. New earnings will settle this amount before another cashout is available.</p>}
      <div className="grid gap-5 lg:grid-cols-2">
        <form onSubmit={event=>submit(event,"cashout")} className={`${financePanel} space-y-4`}><h2 className="text-lg font-bold">Request a cashout</h2><p className="text-xs text-slate-500">Minimum: {php(data.settings.minimum_cashout)}. Select a destination approved by BAO.</p>
          <label className="block text-sm font-semibold">Amount (PHP)<input required type="number" min={data.settings.minimum_cashout} step="0.01" value={amount} onChange={event=>{setAmount(event.target.value);setRequestKey(null);}} className={financeField}/></label>
          <label className="block text-sm font-semibold">Payout destination<select required value={destination} onChange={event=>{setDestination(event.target.value);setRequestKey(null);}} className={financeField}><option value="">Choose an approved destination</option>{data.destinations.filter(item=>item.status==="approved").map(item=><option key={item.id} value={item.id}>{item.institution} · ending {item.account_last_four}</option>)}</select></label>
          <button disabled={busy||Number(data.balances.debt)>0} className={financeButton}>{busy?"Saving...":"Request cashout"}</button>
        </form>
        <form onSubmit={event=>submit(event,"destination")} className={`${financePanel} space-y-4`}><h2 className="text-lg font-bold">Add a payout destination</h2><p className="text-xs text-slate-500">BAO reviews bank or e-wallet details before you can request a cashout.</p>
          {[["institution","Bank / e-wallet BIC","text"],["account_name","Account name","text"],["account_number","Account number","text"]].map(([key,label,type])=><label key={key} className="block text-sm font-semibold">{label}<input required type={type} autoComplete="off" maxLength={key==="account_name"?150:30} value={account[key]} onChange={event=>setAccount({...account,[key]:event.target.value})} className={financeField}/></label>)}
          <button disabled={busy} className={financeButton}>Submit destination</button>
          {data.destinations.map(item=><p key={item.id} className="text-xs">{item.institution} · ending {item.account_last_four} · <FinanceStatus value={item.status}/>{item.remarks&&<span className="mt-1 block">{item.remarks}</span>}</p>)}
        </form>
      </div>
      <section className={financePanel}><h2 className="mb-4 text-lg font-bold">Cashout requests</h2>{!data.cashouts.length?<p className="text-sm text-slate-500">No cashouts yet.</p>:<div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr>{["Date","Amount","Destination","Status","Transfer reference"].map(label=><th key={label} className="p-3 text-xs text-slate-500">{label}</th>)}</tr></thead><tbody>{data.cashouts.map(item=><tr key={item.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3 text-xs">{financeDate(item.created_at)}</td><td className="p-3 font-bold">{php(item.amount)}</td><td className="p-3">{item.institution} · {item.account_last_four}</td><td className="p-3"><FinanceStatus value={item.status}/>{item.reason&&<p className="mt-1 text-xs">{item.reason}</p>}</td><td className="p-3 text-xs">{item.payout_reference||"Awaiting confirmed transfer"}</td></tr>)}</tbody></table></div>}</section>
      <section className={financePanel}><h2 className="mb-4 text-lg font-bold">Transaction history</h2>{!data.history.length?<p className="text-sm text-slate-500">Your online earnings and cashout movements will appear here.</p>:<div className="overflow-x-auto"><table className="w-full min-w-[580px] text-left text-sm"><thead><tr>{["Date","Transaction","Balance","Amount","Order"].map(label=><th key={label} className="p-3 text-xs text-slate-500">{label}</th>)}</tr></thead><tbody>{data.history.map(item=><tr key={item.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3 text-xs">{financeDate(item.created_at)}</td><td className="p-3 capitalize">{readable(item.kind)}</td><td className="p-3 capitalize">{readable(item.bucket)}</td><td className="p-3 font-semibold">{php(item.amount)}</td><td className="p-3">{item.order_id?`#${item.order_id}`:"—"}</td></tr>)}</tbody></table></div>}</section>
    </>}
  </div>;
}
