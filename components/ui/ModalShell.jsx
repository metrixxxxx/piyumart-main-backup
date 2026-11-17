"use client";

import { useEffect, useId, useRef } from "react";

let openDialogs = 0;
let previousOverflow = "";
const dialogStack = [];

export function ModalSymbol({ type = "info" }) {
  const tone = type === "success" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300"
    : type === "error" ? "bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300"
      : "bg-[#1a2a6c]/8 text-[#1a2a6c] dark:bg-[#c9a028]/10 dark:text-[#f2ce65]";
  return <div aria-hidden="true" className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${tone}`}>
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {type === "success" ? <path d="m5 12 4 4L19 6" /> : type === "error" ? <><path d="m8 8 8 8m0-8-8 8" /><circle cx="12" cy="12" r="9" /></> : type === "confirm" ? <><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3h.01" /><circle cx="12" cy="12" r="9" /></> : <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10h.01" /></>}
    </svg>
  </div>;
}

export function ModalSpinner() {
  return <div aria-hidden="true" className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#1a2a6c]/5 dark:bg-[#c9a028]/8">
    <svg className="absolute inset-0 h-full w-full animate-spin motion-reduce:animate-none" viewBox="0 0 80 80" fill="none">
      <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="3" className="text-[#1a2a6c]/10 dark:text-white/10" />
      <path d="M40 6a34 34 0 0 1 34 34" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-[#c9a028]" />
    </svg>
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="text-[#1a2a6c] dark:text-[#f2ce65]">
      <path d="M5 8h14l-1.5 12h-11L5 8Z" strokeLinejoin="round" /><path d="M9 8V6a3 3 0 0 1 6 0v2" strokeLinecap="round" />
    </svg>
  </div>;
}

export default function ModalShell({ open, title, description, icon, children, onClose, dismissible = true, busy = false, centered = true, role = "dialog" }) {
  const ref = useRef(null);
  const titleId = useId(), descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    if (!dialog.open) dialog.showModal();
    dialogStack.push(dialog);
    if (openDialogs++ === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    return () => {
      dialog.close();
      const index = dialogStack.lastIndexOf(dialog);
      if (index !== -1) dialogStack.splice(index, 1);
      if (--openDialogs === 0) document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const cancel = event => {
      event.preventDefault();
      if (dialogStack.at(-1) === dialog && dismissible && !busy) onClose?.();
    };
    const keydown = event => {
      if (dialogStack.at(-1) !== dialog) return;
      if (event.key === "Escape") {
        event.preventDefault(); event.stopImmediatePropagation();
        if (dismissible && !busy) onClose?.();
      } else if (event.key === "Tab" && busy) {
        event.preventDefault(); dialog.focus({ preventScroll: true });
      }
    };
    dialog.addEventListener("cancel", cancel);
    document.addEventListener("keydown", keydown, true);
    if (busy) dialog.focus({ preventScroll: true });
    return () => { dialog.removeEventListener("cancel", cancel); document.removeEventListener("keydown", keydown, true); };
  }, [open, busy, dismissible, onClose]);

  if (!open) return null;

  return <dialog ref={ref} role={role} aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}
    aria-busy={busy || undefined} tabIndex={-1} className="pm-modal max-w-md rounded-3xl border border-[#dbe1f0] bg-white text-[#0e1a3d] shadow-[0_32px_100px_rgba(8,17,50,0.28)] dark:border-white/10 dark:bg-[#101827] dark:text-[#e8edf8]"
    onClick={event => {
      if (event.target !== event.currentTarget || !dismissible || busy) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose?.();
    }}>
    <div className="h-1.5 bg-gradient-to-r from-[#1a2a6c] via-[#c9a028] to-[#f2ce65]" />
    <div className={`p-6 sm:p-8 ${centered ? "text-center" : "text-left"}`}>
      <p className="mb-6 text-center text-[10px] font-extrabold tracking-[0.28em] text-[#6f7890] dark:text-slate-400">PIYU<span className="text-[#aa8118] dark:text-[#f2ce65]">MART</span></p>
      {icon && <div className="mb-5">{icon}</div>}
      <h2 id={titleId} className="text-xl font-extrabold tracking-tight">{title}</h2>
      {description && <p id={descriptionId} className="mt-3 break-words text-sm leading-relaxed text-[#58657e] dark:text-slate-300">{description}</p>}
      {children}
    </div>
  </dialog>;
}
