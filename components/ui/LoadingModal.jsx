"use client";

export default function LoadingModal({ open, title = "Please wait", description = "This may take a moment." }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-[#c5cfe8] bg-white p-6 text-center shadow-2xl dark:border-white/[0.07] dark:bg-[#0e1520]">
        <div className="mx-auto mb-4 h-11 w-11 animate-spin rounded-full border-[3px] border-[#c5cfe8] border-t-[#1a2a6c] dark:border-white/10 dark:border-t-[#c9a028]" />
        <h2 className="text-base font-bold text-[#0e1a3d] dark:text-[#e8edf8]">{title}</h2>
        <p className="mt-2 text-sm text-[#0e1a3d]/55 dark:text-[#e8edf8]/45">{description}</p>
      </div>
    </div>
  );
}
