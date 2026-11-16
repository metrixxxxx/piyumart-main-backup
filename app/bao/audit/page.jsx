"use client";

import { useEffect, useState } from "react";
import BaoHeader from "@/components/bao/BaoHeader";

const ENTITY_OPTIONS = [
  { value: "marketplace_report", label: "Marketplace report" },
  { value: "product", label: "Product" },
  { value: "seller", label: "Seller" },
  { value: "commission_rate", label: "Commission rate" },
  { value: "order", label: "Order" },
  { value: "user", label: "User" },
];

function formatDate(value) {
  return value ? new Date(value).toLocaleString("en-PH") : "—";
}

function formatLabel(value) {
  return value ? value.replaceAll("_", " ") : "—";
}

export default function BaoAuditPage() {
  const [logs, setLogs] = useState([]);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    entityType: "",
    search: "",
  });
  const [searchInput, setSearchInput] = useState("");
  const [entityInput, setEntityInput] = useState("");
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(page) });
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.entityType) params.set("entity_type", filters.entityType);
    if (filters.search) params.set("search", filters.search);

    fetch(`/api/bao/audit-logs?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load audit logs.");
        if (!active) return;
        setLogs(data.logs);
        setPageInfo(data.page);
        setError("");
        if (!filters.from && !filters.to) setDateRange(data.range);
      })
      .catch((requestError) => {
        console.error("BAO audit log request failed:", requestError);
        if (active) setError(requestError.message || "Unable to load audit logs.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [filters, page]);

  function applyFilters(event) {
    event.preventDefault();
    if (!dateRange.from || !dateRange.to || dateRange.from > dateRange.to) {
      setFilterError("Choose a valid start and end date.");
      return;
    }

    const nextFilters = {
      from: dateRange.from,
      to: dateRange.to,
      entityType: entityInput,
      search: searchInput.trim(),
    };
    setFilterError("");
    if (
      nextFilters.from === filters.from &&
      nextFilters.to === filters.to &&
      nextFilters.entityType === filters.entityType &&
      nextFilters.search === filters.search &&
      page === 1
    ) {
      return;
    }
    setLoading(true);
    setPage(1);
    setFilters(nextFilters);
  }

  return (
    <main className="min-h-dvh bg-[#eef2f7] text-slate-900 dark:bg-[#090e1b] dark:text-slate-100">
      <BaoHeader active="audit" />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#927116] dark:text-[#e3c36c]">
            Business Administration Office
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#1a2a6c] dark:text-white sm:text-4xl">
            Administrative audit log
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
            Review who performed marketplace administration actions, what was affected, and the recorded reason.
          </p>
        </div>

        <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-100">
          Audit history is read-only here. Entries cannot be edited or deleted through the BAO interface.
        </div>
        {error ? <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">{error}</div> : null}

        <form onSubmit={applyFilters} className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/70 dark:bg-[#111a2b] sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.2fr_1fr_auto]">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            From
            <input type="date" value={dateRange.from} onChange={(event) => setDateRange((current) => ({ ...current, from: event.target.value }))} required className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-[#0b1220]" />
          </label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            To
            <input type="date" value={dateRange.to} onChange={(event) => setDateRange((current) => ({ ...current, to: event.target.value }))} required className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-[#0b1220]" />
          </label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Entity type
            <select value={entityInput} onChange={(event) => setEntityInput(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-[#0b1220]">
              <option value="">All entities</option>
              {ENTITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Search
            <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} maxLength={200} placeholder="Action, actor, reason, entity ID" className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-[#0b1220]" />
          </label>
          <button type="submit" className="self-end rounded-lg bg-[#1a2a6c] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#24377f]">Apply filters</button>
          {filterError ? <p role="alert" className="text-xs text-red-600 dark:text-red-300 sm:col-span-2 lg:col-span-5">{filterError}</p> : null}
        </form>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/70 dark:bg-[#111a2b]">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-[#1a2a6c] dark:text-white">Audit entries</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {pageInfo ? `${pageInfo.totalRows.toLocaleString()} matching record(s)` : "Loading records…"} · Philippine calendar dates
              </p>
            </div>
            {pageInfo?.totalPages > 1 ? (
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <button type="button" disabled={loading || pageInfo.current <= 1} onClick={() => { setLoading(true); setPage((current) => Math.max(1, current - 1)); }} className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-50 dark:border-slate-700">Previous</button>
                <span>Page {pageInfo.current} of {pageInfo.totalPages}</span>
                <button type="button" disabled={loading || pageInfo.current >= pageInfo.totalPages} onClick={() => { setLoading(true); setPage((current) => current + 1); }} className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-50 dark:border-slate-700">Next</button>
              </div>
            ) : null}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-3">Timestamp</th>
                  <th className="px-3 py-3">Actor</th>
                  <th className="px-3 py-3">Action</th>
                  <th className="px-3 py-3">Affected entity</th>
                  <th className="px-3 py-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-500">Loading audit entries…</td></tr>
                ) : logs.length ? logs.map((log) => (
                  <tr key={log.id} className="align-top">
                    <td className="whitespace-nowrap px-3 py-3 text-xs">{formatDate(log.created_at)}</td>
                    <td className="px-3 py-3">
                      <p className="font-semibold">{[log.actor_name, log.actor_last_name].filter(Boolean).join(" ") || `User ${log.actor_id}`}</p>
                      <p className="mt-1 text-xs capitalize text-slate-500 dark:text-slate-400">{log.actor_role || "Former account"} · #{log.actor_id}</p>
                    </td>
                    <td className="px-3 py-3 font-semibold capitalize">{formatLabel(log.action)}</td>
                    <td className="px-3 py-3">
                      <p className="capitalize">{formatLabel(log.entity_type)}</p>
                      <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">{log.entity_id || "—"}</p>
                    </td>
                    <td className="max-w-xs whitespace-pre-wrap px-3 py-3 text-slate-600 dark:text-slate-300">{log.reason || "—"}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-500 dark:text-slate-400">No audit entries match these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
