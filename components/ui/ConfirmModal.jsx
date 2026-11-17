"use client";

import { useRef, useState } from "react";
import ModalShell, { ModalSpinner, ModalSymbol } from "@/components/ui/ModalShell";
import FeedbackModal from "@/components/ui/FeedbackModal";

export default function ConfirmModal({ open, title = "Confirm action", description, confirmText = "Confirm", cancelText = "Cancel", onConfirm, onCancel, loading = false, loadingText = "Processing your request", children }) {
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  const locked = useRef(false);
  const busy = loading || Boolean(pending);
  async function confirm() {
    if (locked.current || busy) return;
    locked.current = true;
    setError("");
    setPending(true);
    try { await onConfirm?.(); }
    catch (failure) { setError(failure.message || "Unable to complete this action. Please try again."); }
    finally { locked.current = false; setPending(false); }
  }
  function cancel() { setError(""); onCancel?.(); }
  if (!open && !pending && error) return <FeedbackModal open type="error" title="Unable to complete this action" description={error} onClose={() => setError("")} />;
  return <ModalShell open={Boolean(open || pending)} title={busy ? loadingText : title} description={busy ? "Please wait while we complete this action." : description}
    icon={busy ? <ModalSpinner /> : <ModalSymbol type="confirm" />} onClose={cancel} dismissible={!busy} busy={busy}>
    {busy ? <div role="status" aria-live="polite" className="mt-6"><div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-[#1a2a6c]/8 dark:bg-white/10"><div className="pm-modal-progress h-full w-2/5 rounded-full bg-[#c9a028]" /></div><p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Your request is in progress. Please keep this window open.</p></div> : <>
      {children}
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">{error}</p>}
      <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row">
        <button autoFocus type="button" onClick={cancel} className="flex-1 rounded-xl border border-[#dbe1f0] px-4 py-3 text-sm font-bold text-[#58657e] transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c9a028] dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">{cancelText}</button>
        <button type="button" onClick={confirm} className="flex-1 rounded-xl bg-[#1a2a6c] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#24377f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c9a028] dark:bg-[#c9a028] dark:text-[#101827] dark:hover:bg-[#e0b744]">{confirmText}</button>
      </div>
    </>}
  </ModalShell>;
}
