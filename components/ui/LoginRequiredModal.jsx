"use client";

import { useRouter } from "next/navigation";

export default function LoginRequiredModal({
  open,
  onClose,
  description = "You need to be logged in to add items or buy.",
}) {
  const router = useRouter();

  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-required-title"
        aria-describedby="login-required-description"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-[320px] rounded-2xl border border-[#c5cfe8] bg-white p-6 text-center shadow-[0_24px_60px_rgba(0,0,0,0.2)] dark:border-white/[0.07] dark:bg-[#0e1520] sm:p-9"
      >
        <div aria-hidden="true" className="mb-3.5 text-4xl">🔒</div>
        <h2 id="login-required-title" className="mb-2 text-lg font-bold text-[#0e1a3d] dark:text-[#e8edf8]">
          Sign in to continue
        </h2>
        <p id="login-required-description" className="mb-6 text-xs leading-relaxed text-[#0e1a3d]/50 dark:text-[#e8edf8]/45">
          {description}
        </p>
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => {
              onClose();
              router.push("/login");
            }}
            className="w-full cursor-pointer rounded-xl border-none bg-[#1a2a6c] py-3 text-sm font-bold text-white transition hover:bg-[#142060] dark:bg-[#c9a028] dark:text-[#0a0e1f] dark:hover:bg-[#b78f20]"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full cursor-pointer rounded-xl border border-[#c5cfe8] bg-transparent py-3 text-sm text-[#0e1a3d]/60 transition hover:bg-[#f0f4ff] dark:border-white/10 dark:text-[#e8edf8]/50 dark:hover:bg-white/[0.04]"
          >
            Continue browsing
          </button>
        </div>
      </div>
    </div>
  );
}
