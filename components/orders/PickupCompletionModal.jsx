"use client";

import { useEffect, useId, useRef, useState } from "react";
import ModalShell from "@/components/ui/ModalShell";
import { validatePickupProofFile } from "@/lib/orders/pickup-proof-policy";

export default function PickupCompletionModal({ orderId, onlinePayment = false, busy, error, onCancel, onConfirm }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [fileError, setFileError] = useState("");
  const inputId = useId();
  const submitting = useRef(false);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function choosePhoto(event) {
    const selected = event.target.files?.[0];
    const problem = validatePickupProofFile(selected);
    setFileError(problem);
    setFile(problem ? null : selected);
    setPreview(problem ? "" : URL.createObjectURL(selected));
    if (problem) event.target.value = "";
  }

  async function submit(event) {
    event.preventDefault();
    if (busy || submitting.current) return;
    const problem = validatePickupProofFile(file);
    setFileError(problem);
    if (problem) return;
    submitting.current = true;
    try { await onConfirm(file); }
    catch (failure) { setFileError(failure.message || "Unable to complete your order. Please try again."); }
    finally { submitting.current = false; }
  }

  return <ModalShell open title={`Confirm receipt of order #${orderId}`} centered={false}
    description={onlinePayment ? "After collecting your order, upload a photo of the items you received." : "After collecting your order and paying the seller, upload a photo of the items you received."}
    onClose={onCancel} dismissible={!busy} busy={busy}>
    <form onSubmit={submit} className="mt-5 space-y-4">
      <div>
        <label htmlFor={inputId} className="block text-sm font-semibold">Proof of transaction (required)</label>
        <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" required disabled={busy}
          onChange={choosePhoto} aria-describedby={`${inputId}-help`}
          className="mt-2 block w-full min-w-0 rounded-xl border border-slate-200 p-2 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-[#e8edf8] file:px-3 file:py-2 file:font-semibold file:text-[#1a2a6c] dark:border-white/10 dark:file:bg-white/10 dark:file:text-[#e8edf8]" />
        <p id={`${inputId}-help`} className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">JPG, PNG, or WebP, up to 5 MB. The photo is visible to you, the seller, and BAO staff.</p>
      </div>
      {preview && <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
        {/* A temporary local preview must not go through image optimization. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="Selected proof photo" className="max-h-52 w-full object-contain"
          onError={() => { setFile(null); setPreview(""); setFileError("This photo could not be opened. Please choose another image."); }} />
      </div>}
      {(fileError || error) && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">{fileError || error}</p>}
      {busy && <p role="status" aria-live="polite" className="text-sm text-slate-600 dark:text-slate-300">Uploading your photo and completing the order…</p>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <button type="button" disabled={busy} onClick={onCancel} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold disabled:opacity-50 dark:border-white/10">Not yet</button>
        <button type="submit" disabled={busy || !file} className="flex-1 rounded-xl bg-[#1a2a6c] px-4 py-3 text-sm font-bold text-white disabled:opacity-50 dark:bg-[#c9a028] dark:text-[#101827]">{busy ? "Saving…" : "Confirm receipt and save proof"}</button>
      </div>
    </form>
  </ModalShell>;
}
