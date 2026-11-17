"use client";

import ModalShell, { ModalSymbol } from "@/components/ui/ModalShell";

export default function FeedbackModal({ open, type = "info", title, description, actionText = "Got it", onClose }) {
  return <ModalShell open={open} title={title || (type === "error" ? "Something needs your attention" : type === "success" ? "All done" : "Please note")}
    description={description} icon={<ModalSymbol type={type} />} onClose={onClose} role={type === "error" ? "alertdialog" : "dialog"}>
    <button autoFocus type="button" onClick={onClose} className="mt-7 w-full rounded-xl bg-[#1a2a6c] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#24377f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c9a028] dark:bg-[#c9a028] dark:text-[#101827] dark:hover:bg-[#e0b744]">{actionText}</button>
  </ModalShell>;
}
