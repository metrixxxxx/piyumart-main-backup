"use client";

import { useState } from "react";
import ModalShell from "@/components/ui/ModalShell";

export default function PickupProofLink({ orderId, audience = "marketplace" }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  async function viewPhoto() {
    setOpen(true); setBusy(true); setUrl(""); setError("");
    try {
      const response = await fetch(`/api/${audience === "staff" ? "bao/" : ""}orders/${orderId}/pickup-proof`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to open the proof photo.");
      setUrl(data.url);
    } catch (failure) { setError(failure.message || "Unable to open the proof photo."); }
    finally { setBusy(false); }
  }

  return <>
    <button type="button" onClick={viewPhoto} className="text-xs font-semibold text-[#1a2a6c] underline underline-offset-2 dark:text-[#e3c36c]">View proof photo</button>
    <ModalShell open={open} title={`Proof photo · Order #${orderId}`} onClose={() => setOpen(false)} centered={false}>
      <div className="mt-5">
        {busy && <p role="status" className="text-sm text-slate-500 dark:text-slate-400">Loading proof photo…</p>}
        {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">{error}</p>}
        {url && !error && <>
          {/* Signed private images must not be cached by the image optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`Proof of receipt for order #${orderId}`} referrerPolicy="no-referrer" className="max-h-[55dvh] w-full rounded-xl object-contain"
            onError={() => setError("The photo could not be loaded. Close and open it again to retry.")} />
        </>}
        <button type="button" onClick={() => setOpen(false)} className="mt-5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold dark:border-white/10">Close</button>
      </div>
    </ModalShell>
  </>;
}
