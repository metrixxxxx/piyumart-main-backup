"use client";

import ActionFeedback from "@/components/ui/ActionFeedback";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useState } from "react";
import { financePanel,financeField,financeButton,php,financeDate,readable,MoneyCard,FinanceStatus } from "@/components/payments/FinanceUI";

export default function BaoCommissionWallet({data,onRefresh,onReview}) {
  const wallet=data.commissionWallet;
  const [confirmKind,setConfirmKind]=useState(null);
  const [amount,setAmount]=useState(""),[destination,setDestination]=useState("");
  const [account,setAccount]=useState({institution:"",account_name:"",account_number:""});
  const [requestKey,setRequestKey]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  function requestSubmit(event,kind) { event.preventDefault(); if(!busy)setConfirmKind(kind); }
  async function submit(kind) {
    if(busy)return;
    setBusy(true);setError("");setNotice("");
    try {
      const cashout=kind==="cashouts",key=requestKey||crypto.randomUUID();
      if(cashout)setRequestKey(key);
      const response=await fetch(`/api/bao/finance/wallet/${kind}`,{
        method:"POST",headers:{"Content-Type":"application/json",...(cashout?{"Idempotency-Key":key}:{})},
        body:JSON.stringify(cashout?{amount,destination_id:destination}:account),
      });
      const result=await response.json();if(!response.ok)throw new Error(result.error);
      if(cashout){setAmount("");setRequestKey(null);setNotice("Commission withdrawal is ready for transfer. The amount stays reserved until the transfer is confirmed.");}
      else{setAccount({institution:"",account_name:"",account_number:""});setDestination(result.id);setRequestKey(null);setNotice("BAO payout destination saved and ready to use. No review is required.");}
      onRefresh();
    }catch(err){setError(err.message);}finally{setBusy(false);}
  }
  return <section className="space-y-5" aria-labelledby="bao-wallet-heading">
    <div><h2 id="bao-wallet-heading" className="text-xl font-bold">BAO commission wallet</h2><p className="mt-2 text-sm text-slate-600 dark:text-slate-400">BAO payout destinations and commission withdrawals do not need manual review. Only available commission can be withdrawn; a confirmed transfer completes the withdrawal.</p></div>
    <div className="grid gap-3 sm:grid-cols-2"><MoneyCard label="Commission reserved for withdrawal" value={data.balances.reserved}/><MoneyCard label="Completed commission withdrawals" value={wallet.withdrawals}/></div>
    {error&&<p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{error}</p>}
    {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">{notice}</p>}
    <div className="grid gap-5 lg:grid-cols-2">
      <form onSubmit={event=>requestSubmit(event,"cashouts")} className={`${financePanel} space-y-4`}>
        <h3 className="text-lg font-bold">Withdraw commission</h3>
        <p className="text-xs text-slate-500">Available: {php(data.balances.available)}. Minimum: {php(data.settings.minimum_cashout)}. The amount is reserved immediately and stays reserved until a transfer is confirmed.</p>
        <label className="block text-sm font-semibold">Amount (PHP)<input required type="number" min={data.settings.minimum_cashout} max={data.balances.available} step="0.01" value={amount} onChange={event=>{setAmount(event.target.value);setRequestKey(null);}} className={financeField}/></label>
        <label className="block text-sm font-semibold">Payout destination<select required value={destination} onChange={event=>{setDestination(event.target.value);setRequestKey(null);}} className={financeField}><option value="">Choose a BAO destination</option>{wallet.destinations.filter(item=>item.status==="approved").map(item=><option key={item.id} value={item.id}>{item.institution} · ending {item.account_last_four}</option>)}</select></label>
        <button disabled={busy||Number(data.balances.debt)>0||Number(data.balances.available)<Number(data.settings.minimum_cashout)} className={financeButton}>{busy?"Submitting...":"Withdraw commission"}</button>
      </form>
      <form onSubmit={event=>requestSubmit(event,"destinations")} className={`${financePanel} space-y-4`}>
        <h3 className="text-lg font-bold">Add BAO payout destination</h3>
        {[["institution","Bank / e-wallet BIC"],["account_name","Account name"],["account_number","Account number"]].map(([key,label])=><label key={key} className="block text-sm font-semibold">{label}<input required autoComplete="off" maxLength={key==="account_name"?150:30} value={account[key]} onChange={event=>setAccount({...account,[key]:event.target.value})} className={financeField}/></label>)}
        <button disabled={busy} className={financeButton}>Save BAO destination</button>
      </form>
    </div>
    <section className={financePanel}><h3 className="mb-4 text-lg font-bold">BAO payout destinations</h3>
      {!wallet.destinations.length?<p className="text-sm text-slate-500">No commission payout destinations yet.</p>:<div className="space-y-3">{wallet.destinations.map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
        <div><p className="text-sm font-bold">{item.account_name} · {item.institution} · ending {item.account_last_four}</p><p className="mt-1 text-xs">Added by {item.submitted_by_name} · <FinanceStatus value={item.status==="approved"?"ready":item.status}/></p>{item.remarks&&<p className="mt-1 text-xs">{item.remarks}</p>}</div>
      </div>)}</div>}
    </section>
    <section className={financePanel}><h3 className="mb-4 text-lg font-bold">Commission withdrawal history</h3>
      {!wallet.cashouts.length?<p className="text-sm text-slate-500">No commission withdrawals yet.</p>:<div className="overflow-x-auto"><table className="w-full min-w-[750px] text-left text-sm"><thead><tr>{["Requested by / date","Amount","Destination","Status","Actions / transfer reference"].map(label=><th key={label} className="p-3 text-xs text-slate-500">{label}</th>)}</tr></thead><tbody>{wallet.cashouts.map(item=><tr key={item.id} className="border-t border-slate-100 dark:border-slate-800">
        <td className="p-3"><p className="font-bold">{item.name}</p><p className="mt-1 text-xs text-slate-500">{financeDate(item.created_at)}</p></td><td className="p-3 font-bold">{php(item.amount)}</td><td className="p-3 text-xs">{item.institution} · ending {item.account_last_four}</td><td className="p-3"><FinanceStatus value={item.status==="approved"?"ready_for_transfer":item.status}/>{item.reason&&<p className="mt-1 text-xs">{item.reason}</p>}</td>
        <td className="p-3"><div className="flex flex-wrap gap-2">{["approved","processing"].includes(item.status)&&<button disabled={!data.payoutsEnabled} className={financeButton} onClick={()=>onReview("cashouts",item.id,"verify_payout")}>Verify test transfer</button>}{["pending","approved"].includes(item.status)&&<button className="rounded-xl border border-rose-300 px-3 py-2 text-xs font-bold text-rose-700 dark:text-rose-300" onClick={()=>onReview("cashouts",item.id,"cancel")}>Cancel withdrawal</button>}{!["pending","approved","processing"].includes(item.status)&&<span className="break-all text-xs">{item.payout_reference||"—"}</span>}</div></td>
      </tr>)}</tbody></table></div>}
    </section>
    <section className={financePanel}><h3 className="mb-4 text-lg font-bold">Commission wallet transactions</h3>
      {!wallet.history.length?<p className="text-sm text-slate-500">No commission wallet transactions yet.</p>:<div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr>{["Date","Transaction","Balance","Amount"].map(label=><th key={label} className="p-3 text-xs text-slate-500">{label}</th>)}</tr></thead><tbody>{wallet.history.map(item=><tr key={item.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3 text-xs">{financeDate(item.created_at)}</td><td className="p-3">{readable(item.kind)}</td><td className="p-3">{readable(item.bucket)}</td><td className="p-3 font-bold">{php(item.amount)}</td></tr>)}</tbody></table></div>}
    </section>
    <ConfirmModal open={Boolean(confirmKind)} title={confirmKind==="cashouts"?"Withdraw this commission?":"Save this BAO destination?"} description={confirmKind==="cashouts"?`${php(amount)} will be reserved from the BAO commission wallet and become ready for transfer.`:`Save the ${account.institution} destination ending ${account.account_number.slice(-4)} for commission withdrawals?`} confirmText={confirmKind==="cashouts"?"Withdraw commission":"Save destination"} onCancel={()=>setConfirmKind(null)} onConfirm={async()=>{const kind=confirmKind;setConfirmKind(null);await submit(kind);}} loadingText="Updating the BAO wallet" />
  <ActionFeedback pending={busy} error={error} success={notice} showLoading={false} pendingTitle="Preparing your commission withdrawal" successTitle="BAO wallet updated" />
      </section>;
}
