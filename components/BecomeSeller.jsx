"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { LSPU_DEPARTMENTS, validateProofFile } from "@/lib/campus";

export default function BecomeSeller({ initialApplication }) {
  const [application, setApplication] = useState(initialApplication);
  const [department, setDepartment] = useState(initialApplication?.department || "");
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
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
    const fileError = validateProofFile(file);
    if (fileError) { setError(fileError); return; }
    setWorking(true);
    setError("");
    try {
      const form = new FormData();
      form.set("department", department);
      form.set("note", note);
      form.set("id_proof", file);
      const response = await fetch("/api/seller-applications", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to submit application.");
      setApplication(data.application);
      setFile(null);
    } catch (err) { setError(err.message); }
    finally { setWorking(false); }
  }

  const pending = application?.status === "pending";
  const approved = application?.status === "approved";
  const fieldClass = "mt-2 w-full rounded-xl border border-[#c5cfe8] bg-white p-3 text-sm dark:border-slate-700 dark:bg-[#0b1220]";
  return (
    <main className="min-h-[75vh] bg-[#f0eeff] px-4 py-10 text-[#0e1a3d] dark:bg-[#070b14] dark:text-slate-100">
      <section className="mx-auto max-w-xl rounded-2xl border border-[#c5cfe8] bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-[#111a2b] sm:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-[#9a7410]">PiyuMart sellers</p>
        <h1 className="mt-2 text-3xl font-bold text-[#1a2a6c] dark:text-white">Become a seller</h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Verify your LSPU student account before creating marketplace listings.</p>
        {pending ? (
          <div role="status" className="mt-6 rounded-xl bg-amber-50 p-5 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <h2 className="font-bold">Your application is under review</h2>
            <p className="mt-2 text-sm">BAO will notify you after reviewing your application. You can submit one application at a time.</p>
          </div>
        ) : approved ? (
          <p role="status" className="mt-6 text-sm">Your application was approved. Refresh this page to open your seller tools.</p>
        ) : (
          <>
            {application?.status === "rejected" && (
              <div className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                <h2 className="font-bold">Your application was rejected</h2>
                <p className="mt-1 whitespace-pre-wrap">{application.remarks || "Please update your application and try again."}</p>
                <p className="mt-2">You can re-apply below with a new proof document.</p>
              </div>
            )}
            <form onSubmit={submit} className="mt-6 space-y-5">
              <label className="block text-sm font-semibold">Department
                <select required value={department} onChange={(event) => setDepartment(event.target.value)} className={fieldClass}>
                  <option value="">Select your department</option>
                  {LSPU_DEPARTMENTS.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold">Student ID / Certificate of Registration
                <input required type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" onChange={(event) => { const selected = event.target.files?.[0]; setFile(selected); setError(selected ? validateProofFile(selected) || "" : ""); }} className={fieldClass} />
                <span className="mt-2 block text-xs font-normal text-slate-500 dark:text-slate-400">JPG, PNG, or PDF, up to 5 MB. Only authorized BAO staff and admins can view your document.</span>
              </label>
              <label className="block text-sm font-semibold">Note (optional)
                <textarea maxLength={1000} rows={3} value={note} onChange={(event) => setNote(event.target.value)} className={fieldClass} />
              </label>
              {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
              <button disabled={working} className="w-full rounded-xl bg-[#1a2a6c] px-4 py-3 text-sm font-bold text-white hover:bg-[#24377f] disabled:opacity-50">{working ? "Submitting..." : application?.status === "rejected" ? "Re-apply to become a seller" : "Submit application"}</button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
