export default function ConfirmModal({
  open,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  loading = false,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#c5cfe8] bg-white p-6 shadow-2xl dark:border-white/[0.07] dark:bg-[#0e1520]">
        <div className="mb-2 text-sm font-semibold text-[#0e1a3d] dark:text-[#e8edf8]">{title}</div>
        <p className="mb-6 text-sm text-[#0e1a3d]/70 dark:text-[#e8edf8]/70">{description}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl border border-[#c5cfe8] bg-white px-4 py-2 text-sm font-semibold text-[#0e1a3d] transition hover:bg-[#e8edf8] disabled:opacity-50 dark:border-white/[0.07] dark:bg-white/[0.04] dark:text-[#e8edf8] dark:hover:bg-white/[0.06]"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-xl bg-[#1a2a6c] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#142060] disabled:opacity-50"
          >
            {loading ? "Working..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
