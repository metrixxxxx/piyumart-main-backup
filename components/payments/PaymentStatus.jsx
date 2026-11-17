"use client";
import Link from "next/link";
import { useEffect,useState } from "react";
import { useSession } from "next-auth/react";
import { useMarketplaceRealtime } from "@/lib/realtime/useMarketplaceRealtime";
import { financePanel,financeButton,php,FinanceStatus,TestModeNotice } from "@/components/payments/FinanceUI";
export default function PaymentStatus({id}) {
  const [data,setData]=useState(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState({version:0,provider:true});
  const {data:session}=useSession();
  useMarketplaceRealtime({enabled:!!session?.user?.id,identity:session?.user?.id,onChange:()=>setRefresh(value=>({version:value.version+1,provider:false}))});
  // Reconcile on entry/manual refresh. Subsequent live events read committed data.
  useEffect(()=>{let active=true;async function load(){try{const response=await fetch(`/api/payments/${id}${refresh.provider?"?refresh=1":""}`,{cache:"no-store"});const result=await response.json();if(!response.ok)throw new Error(result.error);if(active){setData(result);setError(result.refreshError||"");}}catch(err){if(active)setError(err.message);}}load();return()=>{active=false;};},[id,refresh]);
  useEffect(()=>{if(["paid","partially_refunded","refunded","cancelled","expired","failed"].includes(data?.payment.status)){sessionStorage.removeItem("piyumart-checkout-key");sessionStorage.removeItem("piyumart-checkout-fingerprint");}},[data?.payment.status]);
  async function cancel(){setBusy(true);try{const response=await fetch(`/api/payments/${id}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"cancel"})});const result=await response.json();if(!response.ok)throw new Error(result.error);setRefresh(value=>({version:value.version+1,provider:false}));}catch(err){setError(err.message);}finally{setBusy(false);}}
  const payment=data?.payment,title=({paid:"Payment confirmed",partially_refunded:"Payment partially refunded",refunded:"Payment refunded",failed:"Payment failed",expired:"Checkout expired",cancelled:"Payment cancelled"})[payment?.status]||"Awaiting payment confirmation";
  return <div className="mx-auto max-w-2xl space-y-5 px-4 py-10 text-slate-900 dark:text-slate-100"><TestModeNotice/><section className={financePanel}>
    <h1 className="text-2xl font-extrabold text-[#1a2a6c] dark:text-white">{title}</h1>
    {error&&<p role="alert" className="mt-4 text-sm text-rose-700 dark:text-rose-300">{error}</p>}
    {!payment?<p className="mt-4 text-sm">{error?"Unable to load payment.":"Checking your payment..."}</p>:<>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><span className="text-3xl font-extrabold">{php(payment.amount)}</span><FinanceStatus value={payment.status}/></div>
      <p className="mt-4 break-all text-xs text-slate-500">Reference: {payment.reference}</p>
      {payment.status==="paid"?<p role="status" className="mt-5 text-sm">Your payment is confirmed. The seller will fulfill your order. Confirm receipt after you receive the items.</p>:payment.status==="pending"?<p className="mt-5 text-sm">{payment.error_code==="payment_attempt_failed"?"The last payment attempt failed. You can try again using the same checkout.":payment.checkout_url?"Payment confirmation is pending. Updates appear automatically when PayMongo confirms payment. Use Refresh status to check directly with PayMongo.":"Your checkout is being prepared or needs staff reconciliation. Keep this reference; another payment attempt will not be created automatically."}</p>:null}
      {Number(payment.refunded_amount)>0&&<p className="mt-3 text-sm">Confirmed refunds: {php(payment.refunded_amount)}</p>}
      <div className="mt-5 flex flex-wrap gap-3">{payment.checkout_url&&<><a className={financeButton} href={payment.checkout_url}>Continue to PayMongo</a><button disabled={busy} onClick={cancel} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold dark:border-slate-600">{busy?"Checking...":"Cancel unpaid checkout"}</button></>}<button onClick={()=>setRefresh(value=>({version:value.version+1,provider:true}))} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold dark:border-slate-600">Refresh status</button></div>
      <ul className="mt-6 space-y-2">{data.orders.map(order=><li key={order.order_id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-900"><span>Order #{order.order_id}</span><span>{php(order.gross_amount)}</span><FinanceStatus value={order.status}/></li>)}</ul>
    </>}
    <Link href="/my-orders" className="mt-6 inline-block text-sm font-bold text-[#1a2a6c] underline dark:text-[#e3c36c]">View my orders</Link>
  </section></div>;
}
