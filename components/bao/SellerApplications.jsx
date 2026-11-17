"use client";

import ModalShell from "@/components/ui/ModalShell";
import ActionFeedback from "@/components/ui/ActionFeedback";
import { useState, useEffect } from "react";
import Pagination from "@/components/ui/Pagination";
import { readPageHeaders } from "@/lib/pagination";

export default function SellerApplications() {
  const [tab, setTab] = useState("pending");
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [working, setWorking] = useState(false);
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState("");
  const [page,setPage]=useState(1),[pagination,setPagination]=useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const controller=new AbortController();
    fetch(`/api/bao/seller-applications?status=${tab}&page=${page}`, { cache: "no-store",signal:controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load applications.");
        if (active) {const meta=readPageHeaders(response);if(meta.page>meta.totalPages){setPage(meta.totalPages);return;}setPagination(meta);setApplications(data.applications); setError(""); }
      })
      .catch((err) => { if (active) { setApplications([]); setError(err.message); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false;controller.abort(); };
  }, [tab, refresh,page]);

  async function viewProof(id) {
    const preview = window.open("about:blank", "_blank");
    if (!preview) { setError("Allow popups to view the proof document."); return; }
    preview.opener = null;
    try {
      const response = await fetch(`/api/bao/seller-applications/${id}/proof`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to open document.");
      preview.location.replace(data.url);
    } catch (err) { preview.close(); setError(err.message); }
  }

  async function review(event) {
    event.preventDefault();
    setWorking(true);
    setError("");
    try {
      const response = await fetch(`/api/bao/seller-applications/${decision.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: decision.action, reason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to review application.");
      setNotice(`Application ${data.status}. The applicant has been notified.`);
      setDecision(null);
      setReason("");
      setLoading(true);
      setRefresh((value) => value + 1);
    } catch (err) { setError(err.message); }
    finally { setWorking(false); }
  }

  return <section className="mx-auto max-w-7xl px-4 py-8 text-slate-900 dark:text-slate-100 sm:px-6">
    <h1 className="text-3xl font-extrabold text-[#1a2a6c] dark:text-white">Seller Applications</h1>
    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Review student verification before granting access to seller tools.</p>
    <div role="tablist" aria-label="Application status" className="my-6 flex flex-wrap gap-2">
      {["pending", "approved", "rejected"].map((status) => <button type="button" key={status} role="tab" aria-selected={tab === status} aria-controls="application-list" id={`tab-${status}`} onClick={() => { if (tab !== status) { setLoading(true); setTab(status);setPage(1); setNotice(""); } }} className={`rounded-xl px-5 py-2 text-sm font-bold capitalize ${tab === status ? "bg-[#1a2a6c] text-white" : "bg-white text-[#1a2a6c] dark:bg-slate-800 dark:text-white"}`}>{status}</button>)}
    </div>
    {error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">{error}</p>}
    {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{notice}</p>}
    <div id="application-list" role="tabpanel" aria-labelledby={`tab-${tab}`} className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-[#111a2b]">
      {loading ? <p className="p-6 text-sm">Loading applications...</p> : error && !applications.length ? <button type="button" onClick={() => { setLoading(true); setRefresh((value) => value + 1); }} className="m-6 rounded-xl border px-4 py-2 text-sm">Retry loading</button> : !applications.length ? <p className="p-6 text-sm text-slate-500 dark:text-slate-400">No {tab} applications.</p> : <table className="w-full min-w-[780px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400"><tr>{["Applicant", "Department", "Submitted", "Proof", "Review"].map((label) => <th key={label} className="p-4">{label}</th>)}</tr></thead>
        <tbody>{applications.map((item) => <tr key={item.id} className="border-t border-slate-100 align-top dark:border-slate-800">
          <td className="p-4"><p className="font-bold">{[item.name, item.last_name].filter(Boolean).join(" ")}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.email}</p>{item.note && <p className="mt-2 max-w-xs whitespace-pre-wrap text-xs">Note: {item.note}</p>}</td>
          <td className="p-4">{item.department}</td>
          <td className="p-4 whitespace-nowrap">{new Date(item.submitted_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</td>
          <td className="p-4"><button type="button" onClick={() => viewProof(item.id)} className="font-semibold text-[#1a2a6c] underline dark:text-[#c9a028]">View ID / COR</button><p className="mt-1 text-xs text-slate-500">Link expires in 60 seconds</p></td>
          <td className="p-4">{tab === "pending" ? <div className="flex gap-2"><button type="button" disabled={working} onClick={() => { setDecision({ id: item.id, action: "approve" }); setReason(""); }} className="rounded-lg bg-emerald-700 px-3 py-2 font-bold text-white">Approve</button><button type="button" disabled={working} onClick={() => { setDecision({ id: item.id, action: "reject" }); setReason(""); }} className="rounded-lg bg-rose-700 px-3 py-2 font-bold text-white">Reject</button></div> : <p className="max-w-xs whitespace-pre-wrap">{item.remarks || (tab === "approved" ? "Approved" : "Rejected")}</p>}</td>
        </tr>)}</tbody>
      </table>}
    </div>
    <Pagination pagination={pagination} loading={loading} onPageChange={setPage}/>
    {decision && <ModalShell open title={decision.action==="approve"?"Approve seller application?":"Reject seller application"} centered={false} busy={working} dismissible={!working} onClose={()=>setDecision(null)}>
      <form onSubmit={review}>

        {decision.action === "reject" ? <label className="mt-4 block text-sm font-semibold">Reason (required)<textarea autoFocus required maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-slate-300 bg-transparent p-3 dark:border-slate-600" /></label> : <p className="mt-3 text-sm">The applicant will be able to create listings after approval.</p>}
        {error && <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-300">{error}</p>}
        <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={working} onClick={() => setDecision(null)} className="rounded-xl border px-4 py-2 text-sm font-bold">Cancel</button><button disabled={working || (decision.action === "reject" && !reason.trim())} className="rounded-xl bg-[#1a2a6c] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{working ? "Saving..." : decision.action === "approve" ? "Approve" : "Reject"}</button></div>
      </form>
    </ModalShell>}
  <ActionFeedback pending={working} error={error} success={notice} pendingTitle="Saving the application decision" successTitle="Application updated" />
      </section>;
}
