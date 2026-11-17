"use client";
export default function Pagination({ pagination, onPageChange, loading = false }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, pageSize, total, totalPages } = pagination;
  const button = "rounded-lg border border-[#c5cfe8] bg-white px-4 py-2 text-xs font-bold text-[#1a2a6c] transition hover:bg-[#eef2f7] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/15 dark:bg-[#111a2b] dark:text-[#e3c36c]";
  return <nav aria-label="Pagination" className="mt-6 flex flex-wrap items-center justify-between gap-3">
    <p role="status" className="text-xs text-slate-600 dark:text-slate-400">{Math.min((page-1)*pageSize+1,total)}–{Math.min(page*pageSize,total)} of {total} · Page {page} of {totalPages}</p>
    <div className="flex gap-2"><button type="button" className={button} disabled={loading||page<=1} onClick={()=>onPageChange(page-1)}>Previous</button><button type="button" className={button} disabled={loading||page>=totalPages} onClick={()=>onPageChange(page+1)}>Next</button></div>
  </nav>;
}
