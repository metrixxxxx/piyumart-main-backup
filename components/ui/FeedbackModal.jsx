"use client";

const styles = {
  success: {
    icon: "✓",
    tone: "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400",
    button: "bg-[#1a2a6c] hover:bg-[#142060] text-white",
  },
  error: {
    icon: "!",
    tone: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
    button: "bg-red-600 hover:bg-red-700 text-white",
  },
  info: {
    icon: "i",
    tone: "bg-[#e8edf8] text-[#1a2a6c] dark:bg-[#c9a028]/10 dark:text-[#c9a028]",
    button: "bg-[#1a2a6c] hover:bg-[#142060] text-white",
  },
};

export default function FeedbackModal({ open, type = "info", title, description, actionText = "OK", onClose }) {
  if (!open) return null;

  const cfg = styles[type] || styles.info;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#c5cfe8] bg-white p-6 text-center shadow-2xl dark:border-white/[0.07] dark:bg-[#0e1520]">
        <div className={`mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full text-lg font-black ${cfg.tone}`}>
          {cfg.icon}
        </div>
        <h2 className="text-base font-bold text-[#0e1a3d] dark:text-[#e8edf8]">{title}</h2>
        {description && (
          <p className="mt-2 text-sm leading-relaxed text-[#0e1a3d]/60 dark:text-[#e8edf8]/50">{description}</p>
        )}
        <button
          type="button"
          onClick={onClose}
          className={`mt-6 w-full rounded-xl px-4 py-2.5 text-sm font-bold transition ${cfg.button}`}
        >
          {actionText}
        </button>
      </div>
    </div>
  );
}
