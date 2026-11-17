"use client";

import { useRouter } from "next/navigation";
import ModalShell, { ModalSymbol } from "@/components/ui/ModalShell";

export default function LoginRequiredModal({ open, onClose, description = "Sign in to add items to your cart or place an order." }) {
  const router = useRouter();
  return <ModalShell open={open} title="Sign in to continue" description={description} icon={<ModalSymbol />} onClose={onClose}>
    <div className="mt-7 flex flex-col gap-3">
      <button autoFocus type="button" onClick={() => { onClose(); router.push("/login"); }} className="rounded-xl bg-[#1a2a6c] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#24377f] dark:bg-[#c9a028] dark:text-[#101827] dark:hover:bg-[#e0b744]">Sign in</button>
      <button type="button" onClick={onClose} className="rounded-xl border border-[#dbe1f0] px-5 py-3 text-sm font-semibold text-[#58657e] transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">Continue browsing</button>
    </div>
  </ModalShell>;
}
