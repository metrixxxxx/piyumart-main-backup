"use client";
import ActionFeedback from "@/components/ui/ActionFeedback";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { BAO_COMMISSION_DESCRIPTION } from "@/lib/commission-policy";
import PageShell from "@/components/layout/PageShell";
import { useEffect,useState } from "react";
import { useSession } from "next-auth/react";
import { useMarketplaceRealtime } from "@/lib/realtime/useMarketplaceRealtime";
import { financePanel,financeField,financeButton,php,financeDate,readable,TestModeNotice,MoneyCard,FinanceStatus } from "@/components/payments/FinanceUI";

export default function SellerWallet() {
  const [data,setData]=useState(null),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0);
  const [amount,setAmount]=useState(""),[destination,setDestination]=useState(""),[account,setAccount]=useState({institution:"",account_name:"",account_number:""});
  const [requestKey,setRequestKey]=useState(null);
  const [confirmType,setConfirmType]=useState(null);
  const [addingDestination,setAddingDestination]=useState(false);
  const hasDestination=Boolean(data?.destinations?.length);
  const showDestinationForm=!hasDestination||addingDestination;
  const {data:session}=useSession();
  useMarketplaceRealtime({enabled:!!session?.user?.id,identity:session?.user?.id,scopes:["wallet","finance"],onChange:()=>setRefresh(value=>value+1)});
  useEffect(()=>{let active=true;fetch("/api/wallet",{cache:"no-store"}).then(async response=>{const result=await response.json();if(!response.ok)throw new Error(result.error);if(active){setData(result);setError("");}}).catch(err=>{if(active)setError(err.message);});return()=>{active=false;};},[refresh]);
  function requestSubmit(event,type) {event.preventDefault();if(!busy)setConfirmType(type);}
  async function submit(type) {
    if(busy)return;
    setBusy(true);setError("");setNotice("");
    try {
      const key=requestKey||crypto.randomUUID();if(type==="cashout")setRequestKey(key);
      const response=await fetch(type==="cashout"?"/api/wallet/cashouts":"/api/wallet/destinations",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":key},body:JSON.stringify(type==="cashout"?{amount,destination_id:destination}:account)});
      const result=await response.json();if(!response.ok)throw new Error(result.error);
      setNotice(type==="cashout"?"Cashout requested. Your amount is reserved while BAO reviews it.":"Payout destination submitted for review.");
      if(type==="cashout"){setAmount("");setRequestKey(null);}else {setAccount({institution:"",account_name:"",account_number:""});setAddingDestination(false);}
      setRefresh(value=>value+1);
    }catch(err){setError(err.message);}finally{setBusy(false);}
  }
  return <PageShell title="My wallet" description="Your balance and earnings" actions={<>
    <button onClick={()=>setRefresh(value=>value+1)} className="rounded-lg border border-[#c5cfe8] bg-white px-3 py-2 text-xs font-semibold text-[#1a2a6c] hover:bg-[#e8edf8] dark:border-white/15 dark:bg-[#0e1520] dark:text-slate-100 dark:hover:bg-white/5 sm:px-4 sm:py-2.5 sm:text-sm">Refresh</button>
    <button disabled={!data} onClick={()=>document.getElementById("wallet-cashout")?.scrollIntoView({behavior:"smooth",block:"start"})} className="rounded-lg bg-[#FABB00] px-3 py-2 text-xs font-semibold text-[#0e1a3d] hover:bg-[#e2a800] disabled:opacity-50 sm:px-4 sm:py-2.5 sm:text-sm">Withdraw</button>
  </>}><div className="space-y-5">
    {error&&<p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{error}</p>}
    {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">{notice}</p>}
    {!data?<><TestModeNotice /><p className="text-sm">{error?"Wallet could not be loaded.":"Loading wallet..."}</p></>:<>
      <div className="grid gap-3 sm:grid-cols-3">{[["Available",data.balances.available],["Pending",data.balances.pending],["Total earnings",data.totals.earnings]].map(([label,value])=><MoneyCard key={label} label={label} value={value}/>)}</div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-slate-400"><p>Reserved for cashout: <strong className="text-slate-700 dark:text-slate-200">{php(data.balances.reserved)}</strong></p><p>Total withdrawals: <strong className="text-slate-700 dark:text-slate-200">{php(data.totals.withdrawals)}</strong></p></div>
      <section className={financePanel}>
        <h2 className="mb-4 text-lg font-bold">Transaction history</h2>
        {!data.history.length?<p className="text-sm text-slate-500">Your online earnings and cashout movements will appear here.</p>:<div className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
          {data.history.map(item=><div key={item.id} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-sm font-semibold capitalize">{item.order_id?`Order #${item.order_id} · `:""}{readable(item.kind)}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{financeDate(item.created_at)} · {readable(item.bucket)} balance</p>
            </div>
            <strong className={`shrink-0 whitespace-nowrap text-sm ${Number(item.amount)>0?"text-emerald-600 dark:text-emerald-400":"text-[#0e1a3d] dark:text-[#e8edf8]"}`}>{Number(item.amount)>0?"+":""}{php(item.amount)}</strong>
          </div>)}
        </div>}
      </section>
      <p className="text-sm text-slate-600 dark:text-slate-400">Your earnings are the item total less BAO commission. {BAO_COMMISSION_DESCRIPTION} {data.settings.release_policy==="buyer_confirmation"?"Pending earnings become available when the buyer confirms receipt.":"Earnings become available after payment confirmation."} Cash-on-pickup proceeds are handled directly with the buyer.</p>
      <section id="wallet-cashout" className="scroll-mt-5 space-y-5">
      <TestModeNotice />
      {Number(data.balances.debt)>0&&<p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">Refund recovery: {php(data.balances.debt)}. New earnings will settle this amount before another cashout is available.</p>}
      <div className={`grid gap-5 ${showDestinationForm?"lg:grid-cols-2":""}`}>
        <form onSubmit={event=>requestSubmit(event,"cashout")} className={`${financePanel} space-y-4`}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Request a cashout</h2>{hasDestination&&<button type="button" disabled={busy} onClick={()=>setAddingDestination(value=>!value)} className="text-xs font-semibold text-[#1a2a6c] underline disabled:opacity-50 dark:text-[#e3c36c]">{addingDestination?"Cancel":"Add another destination"}</button>}</div><p className="text-xs text-slate-500">Minimum: {php(data.settings.minimum_cashout)}. Select a destination approved by BAO.</p>
          <label className="block text-sm font-semibold">Amount (PHP)<input required type="number" min={data.settings.minimum_cashout} step="0.01" value={amount} onChange={event=>{setAmount(event.target.value);setRequestKey(null);}} className={financeField}/></label>
          <label className="block text-sm font-semibold">Payout destination<select required value={destination} onChange={event=>{setDestination(event.target.value);setRequestKey(null);}} className={financeField}><option value="">Choose an approved destination</option>{data.destinations.filter(item=>item.status==="approved").map(item=><option key={item.id} value={item.id}>{item.institution} · ending {item.account_last_four}</option>)}</select></label>
          {hasDestination&&<div className="space-y-2">{data.destinations.map(item=><p key={item.id} className="text-xs">{item.institution} · ending {item.account_last_four} · <FinanceStatus value={item.status}/>{item.remarks&&<span className="mt-1 block">{item.remarks}</span>}</p>)}</div>}
          <button disabled={busy||Number(data.balances.debt)>0} className={financeButton}>{busy?"Saving...":"Request cashout"}</button>
        </form>
        {showDestinationForm&&<form onSubmit={event=>requestSubmit(event,"destination")} className={`${financePanel} space-y-4`}><h2 className="text-lg font-bold">Add a payout destination</h2><p className="text-xs text-slate-500">BAO reviews bank or e-wallet details before you can request a cashout.</p>
          {[["institution","Bank / e-wallet BIC","text"],["account_name","Account name","text"],["account_number","Account number","text"]].map(([key,label,type])=><label key={key} className="block text-sm font-semibold">{label}<input required type={type} autoComplete="off" maxLength={key==="account_name"?150:30} value={account[key]} onChange={event=>setAccount({...account,[key]:event.target.value})} className={financeField}/></label>)}
          <button disabled={busy} className={financeButton}>Submit destination</button>
        </form>}
      </div>
      </section>
      <section className={financePanel}><h2 className="mb-4 text-lg font-bold">Cashout requests</h2>{!data.cashouts.length?<p className="text-sm text-slate-500">No cashouts yet.</p>:<div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr>{["Date","Amount","Destination","Status","Transfer reference"].map(label=><th key={label} className="p-3 text-xs text-slate-500">{label}</th>)}</tr></thead><tbody>{data.cashouts.map(item=><tr key={item.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3 text-xs">{financeDate(item.created_at)}</td><td className="p-3 font-bold">{php(item.amount)}</td><td className="p-3">{item.institution} · {item.account_last_four}</td><td className="p-3"><FinanceStatus value={item.status}/>{item.reason&&<p className="mt-1 text-xs">{item.reason}</p>}</td><td className="p-3 text-xs">{item.payout_reference||"Awaiting confirmed transfer"}</td></tr>)}</tbody></table></div>}</section>
    </>}
    <ConfirmModal open={Boolean(confirmType)} title={confirmType==="cashout"?"Request this cashout?":"Save this payout destination?"} description={confirmType==="cashout"?`${php(amount)} will be reserved from your available wallet balance while your request is processed.`:`Submit the ${account.institution} destination ending ${account.account_number.slice(-4)} for review?`} confirmText={confirmType==="cashout"?"Request cashout":"Save destination"} onCancel={()=>setConfirmType(null)} onConfirm={async()=>{const type=confirmType;setConfirmType(null);await submit(type);}} loadingText="Updating your wallet" />
  <ActionFeedback pending={busy} error={error} success={notice} showLoading={false} pendingTitle="Saving your wallet request" successTitle="Wallet request saved" />
      </div></PageShell>;
}
