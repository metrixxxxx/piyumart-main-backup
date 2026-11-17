"use client";

import ModalShell, { ModalSpinner } from "@/components/ui/ModalShell";

export default function LoadingModal({ open, title = "Please wait", description = "This may take a moment." }) {
  return <ModalShell open={open} title={title} description={description} icon={<ModalSpinner />} busy dismissible={false}>
    <div role="status" aria-live="polite" className="mt-6">
      <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-[#1a2a6c]/8 dark:bg-white/10"><div className="pm-modal-progress h-full w-2/5 rounded-full bg-[#c9a028]" /></div>
      <p className="mt-4 text-xs text-[#71809c] dark:text-slate-400">Please keep this window open while we finish.</p>
    </div>
  </ModalShell>;
}
