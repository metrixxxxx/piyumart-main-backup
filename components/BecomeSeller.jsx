"use client";

import ActionFeedback from "@/components/ui/ActionFeedback";
import PageShell from "@/components/layout/PageShell";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { LSPU_DEPARTMENTS, SELLER_DOCUMENTS, validateProofFile } from "@/lib/campus";

export default function BecomeSeller({ initialApplication }) {
  const [application, setApplication] = useState(initialApplication);
  const [department, setDepartment] = useState(initialApplication?.department || "");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState(false);
  const { update } = useSession();
  const router = useRouter();

  useEffect(() => {
    async function refresh() {
      try {
        const response = await fetch("/api/seller-applications", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (data.role === "seller") { await update(); router.refresh(); }
        else setApplication(data.application);
      } catch { /* Retain the last known state when offline. */ }
    }
    window.addEventListener("focus", refresh);
    const timer = application?.status === "pending" ? setInterval(refresh, 15000) : null;
    return () => { window.removeEventListener("focus", refresh); if (timer) clearInterval(timer); };
  }, [application?.status, router, update]);

  async function submit(event) {
    event.preventDefault();
    if (working) return;
    setNotice("");
    const form = new FormData(event.currentTarget);
    for (const { field, label } of SELLER_DOCUMENTS) {
      const fileError = validateProofFile(form.get(field), label);
      if (fileError) { setError(fileError); return; }
    }
    setWorking(true);
    setError("");
    try {
      const response = await fetch("/api/seller-applications", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to submit application.");
      setApplication(data.application);
      setNotice("Your seller application has been submitted. You will be notified after it is reviewed.");
    } catch (err) { setError(err.message); }
    finally { setWorking(false); }
  }

  const pending = application?.status === "pending";
  const approved = application?.status === "approved";
  const fieldClass = "mt-2 min-w-0 w-full rounded-xl border border-[#c5cfe8] bg-white p-3 text-sm dark:border-slate-700 dark:bg-[#0b1220]";
  return (
    <PageShell title="Become a seller" description="Verify your LSPU student account before creating marketplace listings.">
      <section className="w-full rounded-2xl border border-[#c5cfe8] bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-[#111a2b] sm:p-6">
        {pending ? (
          <div role="status" className="rounded-xl bg-amber-50 p-5 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <h2 className="font-bold">Your application is under review</h2>
            <p className="mt-2 text-sm">BAO will notify you after reviewing your application. You can submit one application at a time.</p>
          </div>
        ) : approved ? (
          <p role="status" className="text-sm">Your application was approved. Refresh this page to open your seller tools.</p>
        ) : (
          <>
            {application?.status === "rejected" && (
              <div className="mb-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                <h2 className="font-bold">Your application was rejected</h2>
                <p className="mt-1 whitespace-pre-wrap">{application.remarks || "Please update your application and try again."}</p>
                <p className="mt-2">You can re-apply below with your student ID and COR.</p>
              </div>
            )}
            <form onSubmit={submit} className="grid gap-5 md:grid-cols-2">
              <label className="block min-w-0 text-sm font-semibold md:col-span-2">Department
                <select name="department" required value={department} onChange={(event) => setDepartment(event.target.value)} className={fieldClass}>
                  <option value="">Select your department</option>
                  {LSPU_DEPARTMENTS.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
              {SELLER_DOCUMENTS.map(({ field, label }) => (
                <label key={field} className="block min-w-0 text-sm font-semibold">{label} (required)
                  <input name={field} required type="file" accept=".jpg,.jpeg,.png,.pdf" aria-describedby="document-help"
                    onChange={(event) => {
                      const selected = event.target.files?.[0];
                      setError(selected ? validateProofFile(selected, label) || "" : "");
                    }} className={fieldClass} />
                </label>
              ))}
              <p id="document-help" className="text-xs text-slate-500 dark:text-slate-400 md:col-span-2">Upload each document as a JPG, PNG, or PDF, up to 5 MB per file. Only authorized BAO staff can view them.</p>
              <label className="block text-sm font-semibold md:col-span-2">Note (optional)
                <textarea name="note" maxLength={1000} rows={3} value={note} onChange={(event) => setNote(event.target.value)} className={fieldClass} />
              </label>
              {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300 md:col-span-2">{error}</p>}
              <button disabled={working} className="w-full rounded-xl bg-[#1a2a6c] px-4 py-3 text-sm font-bold text-white hover:bg-[#24377f] disabled:opacity-50 md:col-span-2">{working ? "Submitting..." : application?.status === "rejected" ? "Re-apply to become a seller" : "Submit application"}</button>
            </form>
          </>
        )}
      </section>
      <ActionFeedback pending={working} error={error} success={notice} pendingTitle="Submitting your application" pendingDescription="Uploading your student ID and COR." successTitle="Application submitted" />
    </PageShell>
  );
}
