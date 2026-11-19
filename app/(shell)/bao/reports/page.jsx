"use client";

import ActionFeedback from "@/components/ui/ActionFeedback";
import { useEffect, useState } from "react";
import ConfirmModal from "@/components/ui/ConfirmModal";

const STATUS_LABELS = {
  pending: "Pending",
  under_investigation: "Under investigation",
  resolved: "Resolved",
  rejected: "Rejected",
};
const TYPE_LABELS = {
  product: "Product",
  seller: "Seller",
  transaction: "Transaction",
  other: "Other concern",
};
const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
});

function formatDate(value) {
  return value ? new Date(value).toLocaleString("en-PH") : "—";
}

function formatCurrency(value) {
  return currencyFormatter.format(Number(value || 0));
}

function getSafeImageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function StatusBadge({ status }) {
  const styles = {
    pending: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
    under_investigation: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200",
    resolved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
    rejected: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${styles[status] || "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>
      {STATUS_LABELS[status] || status || "Unknown"}
    </span>
  );
}

export default function BaoReportsPage() {
  const [reports, setReports] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [detailState, setDetailState] = useState({
    key: "",
    report: null,
    updates: [],
    error: "",
  });
  const [statusInput, setStatusInput] = useState("");
  const [assigneeInput, setAssigneeInput] = useState("");
  const [resolutionInput, setResolutionInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [updateError, setUpdateError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const detailRequestKey = selectedReportId ? `${selectedReportId}:${refreshKey}` : "";
  const detailLoading =
    Boolean(selectedReportId) && detailState.key !== detailRequestKey;
  const report =
    detailState.key === detailRequestKey ? detailState.report : null;
  const updates =
    detailState.key === detailRequestKey ? detailState.updates : [];
  const detailError =
    detailState.key === detailRequestKey ? detailState.error : "";
  const safeProductImageUrl = report ? getSafeImageUrl(report.product_image_url) : null;

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({
      status: statusFilter,
      type: typeFilter,
      page: String(page),
    });
    if (search) params.set("search", search);

    fetch(`/api/bao/reports?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load reports.");
        if (!active) return;
        setReports(data.reports);
        setAssignees(data.assignees);
        setPageInfo(data.page);
        setListError("");
        setSelectedReportId((current) =>
          current && data.reports.some((item) => item.id === current)
            ? current
            : data.reports[0]?.id ?? null
        );
      })
      .catch((requestError) => {
        console.error("BAO report list request failed:", requestError);
        if (active) setListError(requestError.message || "Unable to load reports.");
      })
      .finally(() => {
        if (active) setListLoading(false);
      });

    return () => {
      active = false;
    };
  }, [statusFilter, typeFilter, search, page, refreshKey]);

  useEffect(() => {
    if (!selectedReportId) return;

    let active = true;
    const requestKey = `${selectedReportId}:${refreshKey}`;
    fetch(`/api/bao/reports/${selectedReportId}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load report details.");
        if (!active) return;
        setDetailState({
          key: requestKey,
          report: data.report,
          updates: data.updates,
          error: "",
        });
        setStatusInput(data.report.status);
        setAssigneeInput(data.report.assigned_to ? String(data.report.assigned_to) : "");
        setResolutionInput(data.report.resolution || "");
        setNotesInput("");
      })
      .catch((requestError) => {
        console.error("BAO report detail request failed:", requestError);
        if (active) {
          setDetailState({
            key: requestKey,
            report: null,
            updates: [],
            error: requestError.message || "Unable to load report details.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [selectedReportId, refreshKey]);

  function changeListFilter(setter, value) {
    setListLoading(true);
    setListError("");
    setPage(1);
    setter(value);
  }

  function submitSearch(event) {
    event.preventDefault();
    const nextSearch = searchInput.trim();
    if (nextSearch === search && page === 1) return;
    setListLoading(true);
    setListError("");
    setPage(1);
    setSearch(nextSearch);
  }

  function requestUpdate(event) {
    event.preventDefault();
    setUpdateError("");
    setNotice("");

    if (statusInput === "resolved" && !resolutionInput.trim()) {
      setUpdateError("A resolution is required to resolve this report.");
      return;
    }
    if (
      report &&
      statusInput !== report.status &&
      !notesInput.trim() &&
      !(statusInput === "resolved" && resolutionInput.trim())
    ) {
      setUpdateError("Add an investigation note or resolution to explain the status change.");
      return;
    }
    if (report) {
      const nextAssignee = assigneeInput || "";
      const nextResolution = statusInput === "resolved" ? resolutionInput.trim() : "";
      const hasChanges =
        statusInput !== report.status ||
        nextAssignee !== (report.assigned_to ? String(report.assigned_to) : "") ||
        nextResolution !== (report.resolution || "") ||
        notesInput.trim().length > 0;
      if (!hasChanges) {
        setUpdateError("Make a report change or add an investigation note before saving.");
        return;
      }
    }
    setConfirmOpen(true);
  }

  async function saveUpdate() {
    if (!report) return;
    setSaving(true);
    setUpdateError("");
    try {
      const response = await fetch(`/api/bao/reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: statusInput,
          assigned_to: assigneeInput ? Number(assigneeInput) : null,
          resolution: statusInput === "resolved" ? resolutionInput : "",
          notes: notesInput,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save report updates.");

      setNotice("Report, update history, audit entry, and notifications were saved.");
      setConfirmOpen(false);
      setSaving(false);
      setListLoading(true);
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      console.error("BAO report update failed:", requestError);
      setUpdateError(requestError.message || "Unable to save report updates.");
      setConfirmOpen(false);
      setSaving(false);
    }
  }

  const currentAssigneeMissing =
    report?.assigned_to &&
    !assignees.some((person) => String(person.id) === String(report.assigned_to));

  return (
    <main className="min-h-dvh">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#927116] dark:text-[#e3c36c]">
            Marketplace management
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#1a2a6c] dark:text-white sm:text-4xl">
            Complaints & reports
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Review marketplace concerns, assign active BAO/admin staff, and record investigation outcomes.
          </p>
        </div>

        {notice ? <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200">{notice}</div> : null}
        {listError ? <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">{listError}</div> : null}

        <div className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/70 dark:bg-[#111a2b] md:grid-cols-[minmax(0,1fr)_200px_200px]">
          <form onSubmit={submitSearch} className="flex min-w-0 gap-2">
            <label htmlFor="bao-report-search" className="sr-only">Search reports</label>
            <input
              id="bao-report-search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search report, product, seller, or reporter"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-[#1a2a6c] dark:border-slate-700 dark:bg-[#0b1220] dark:focus:border-[#c9a028]"
            />
            <button type="submit" className="rounded-xl bg-[#1a2a6c] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#24377f]">Search</button>
          </form>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Status
            <select
              value={statusFilter}
              onChange={(event) => changeListFilter(setStatusFilter, event.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-[#0b1220]"
            >
              <option value="all">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Report type
            <select
              value={typeFilter}
              onChange={(event) => changeListFilter(setTypeFilter, event.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-[#0b1220]"
            >
              <option value="all">All concerns</option>
              {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>

        {updateError ? <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">{updateError}</div> : null}

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(290px,0.78fr)_minmax(0,1.22fr)]">
          <section aria-label="Submitted reports" className="space-y-3">
            {listLoading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-[#111a2b]">Loading reports…</div>
            ) : reports.length ? reports.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => {
                  setSelectedReportId(item.id);
                  setUpdateError("");
                  setNotice("");
                }}
                aria-pressed={selectedReportId === item.id}
                className={`w-full rounded-2xl border p-4 text-left shadow-sm transition ${
                  selectedReportId === item.id
                    ? "border-[#c9a028] bg-[#fffdf6] ring-1 ring-[#c9a028]/40 dark:bg-[#231e10]"
                    : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700/70 dark:bg-[#111a2b]"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="text-sm font-extrabold text-[#1a2a6c] dark:text-white">{TYPE_LABELS[item.report_type] || item.report_type}</span>
                  <StatusBadge status={item.status} />
                </div>
                <p className="mt-2 line-clamp-3 text-sm text-slate-700 dark:text-slate-300">{item.description}</p>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  {[item.reporter_name, item.reporter_last_name].filter(Boolean).join(" ") || `User ${item.reporter_id}`}
                  {" · "}{formatDate(item.created_at)}
                </p>
                <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                  {item.product_name || [item.seller_name, item.seller_last_name].filter(Boolean).join(" ") || (item.related_order_id ? `Order #${item.related_order_id}` : "") || "Marketplace concern"}
                </p>
              </button>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-[#111a2b]">
                <h2 className="font-semibold text-[#1a2a6c] dark:text-white">No reports found</h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Try a different status, type, or search term.</p>
              </div>
            )}
            {pageInfo?.totalPages > 1 ? (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-[#111a2b]">
                <button type="button" disabled={listLoading || pageInfo.current <= 1} onClick={() => { setListLoading(true); setPage((current) => Math.max(1, current - 1)); }} className="rounded-lg px-3 py-2 font-semibold disabled:opacity-50">Previous</button>
                <span>Page {pageInfo.current} of {pageInfo.totalPages}</span>
                <button type="button" disabled={listLoading || pageInfo.current >= pageInfo.totalPages} onClick={() => { setListLoading(true); setPage((current) => current + 1); }} className="rounded-lg px-3 py-2 font-semibold disabled:opacity-50">Next</button>
              </div>
            ) : null}
          </section>

          <section aria-label="Report details and actions" className="min-w-0">
            {!selectedReportId ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-[#111a2b]">
                Select a report to review its details and history.
              </div>
            ) : detailLoading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-[#111a2b]">Loading report details…</div>
            ) : detailError ? (
              <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">{detailError}</div>
            ) : report ? (
              <div className="space-y-4">
                <article className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/70 dark:bg-[#111a2b]">
                  <div className="border-b border-slate-100 p-5 dark:border-slate-800">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-extrabold text-[#1a2a6c] dark:text-white">{TYPE_LABELS[report.report_type] || report.report_type} report</h2>
                          <StatusBadge status={report.status} />
                        </div>
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Report {report.id} · Submitted {formatDate(report.created_at)}</p>
                      </div>
                    </div>
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-300">{report.description}</p>
                  </div>

                  <div className="grid gap-4 p-5 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900">
                      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Reporter</h3>
                      <p className="mt-2 text-sm font-semibold">{[report.reporter_name, report.reporter_last_name].filter(Boolean).join(" ") || `User ${report.reporter_id}`}</p>
                      {report.reporter_email ? <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">{report.reporter_email}</p> : null}
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900">
                      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Assigned personnel</h3>
                      <p className="mt-2 text-sm font-semibold">
                        {report.assigned_to
                          ? [report.assignee_name, report.assignee_last_name].filter(Boolean).join(" ") || `User ${report.assigned_to}`
                          : "Unassigned"}
                      </p>
                      {report.assigned_to && report.assignee_status !== "active" ? <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Current assignee is no longer active.</p> : null}
                    </div>
                  </div>

                  {report.report_type === "product" ? (
                    <div className="mx-5 mb-5 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                      <h3 className="text-sm font-bold text-[#1a2a6c] dark:text-white">Related product</h3>
                      {report.product_name ? (
                        <>
                          <p className="mt-2 font-semibold">{report.product_name}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Status: {report.product_status || "Unavailable"} · Price: {formatCurrency(report.product_price)}</p>
                          {report.product_description ? <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{report.product_description}</p> : null}
                          {safeProductImageUrl ? <a href={safeProductImageUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-semibold text-[#1a2a6c] underline dark:text-[#e9d48f]">Open product image</a> : null}
                        </>
                      ) : <p className="mt-2 text-sm text-slate-500">No related product is linked.</p>}
                    </div>
                  ) : null}

                  {report.report_type === "seller" ? (
                    <div className="mx-5 mb-5 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                      <h3 className="text-sm font-bold text-[#1a2a6c] dark:text-white">Related seller</h3>
                      <p className="mt-2 font-semibold">{[report.seller_name, report.seller_last_name].filter(Boolean).join(" ") || "No related seller linked"}</p>
                      {report.seller_email ? <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">{report.seller_email}</p> : null}
                      {report.related_seller_id ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Account status: {report.seller_status || "Unknown"}</p> : null}
                    </div>
                  ) : null}

                  {report.report_type === "transaction" ? (
                    <div className="mx-5 mb-5 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                      <h3 className="text-sm font-bold text-[#1a2a6c] dark:text-white">Related transaction</h3>
                      {report.related_order_id ? (
                        <>
                          <p className="mt-2 font-semibold">Order #{report.related_order_id}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Status: {report.order_status || "Unavailable"} · Amount: {formatCurrency(report.order_total)}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Seller: {[report.order_seller_name, report.order_seller_last_name].filter(Boolean).join(" ") || "Unattributed"}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Order date: {formatDate(report.order_created_at)}</p>
                        </>
                      ) : <p className="mt-2 text-sm text-slate-500">No related order is linked.</p>}
                    </div>
                  ) : null}

                  {report.resolution ? (
                    <div className="mx-5 mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/70 dark:bg-emerald-950/30">
                      <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">Recorded resolution</h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-emerald-900 dark:text-emerald-100">{report.resolution}</p>
                      {report.resolved_at ? <p className="mt-2 text-xs text-emerald-800/70 dark:text-emerald-200/70">Resolved {formatDate(report.resolved_at)}</p> : null}
                    </div>
                  ) : null}

                  <form onSubmit={requestUpdate} className="border-t border-slate-100 p-5 dark:border-slate-800">
                    <h3 className="text-base font-extrabold text-[#1a2a6c] dark:text-white">Investigation actions</h3>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <label className="text-sm font-semibold">
                        Report status
                        <select value={statusInput} onChange={(event) => setStatusInput(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-[#0b1220]">
                          {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </label>
                      <label className="text-sm font-semibold">
                        Assign to active BAO/admin
                        <select value={assigneeInput} onChange={(event) => setAssigneeInput(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-[#0b1220]">
                          <option value="">Unassigned</option>
                          {currentAssigneeMissing ? <option value={String(report.assigned_to)}>{[report.assignee_name, report.assignee_last_name].filter(Boolean).join(" ") || `User ${report.assigned_to}`} (inactive current assignee)</option> : null}
                          {assignees.map((person) => (
                            <option key={person.id} value={String(person.id)}>
                              {[person.name, person.last_name].filter(Boolean).join(" ") || `User ${person.id}`} · {person.role}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {statusInput === "resolved" ? (
                      <label htmlFor="bao-report-resolution" className="mt-4 block text-sm font-semibold">
                        Resolution (required)
                        <textarea id="bao-report-resolution" value={resolutionInput} onChange={(event) => setResolutionInput(event.target.value)} rows={3} maxLength={4000} className="mt-1 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-[#1a2a6c] dark:border-slate-700 dark:bg-[#0b1220]" placeholder="Record the outcome and resolution for the reporter." />
                      </label>
                    ) : null}
                    <label htmlFor="bao-report-notes" className="mt-4 block text-sm font-semibold">
                      Investigation notes
                      <textarea id="bao-report-notes" value={notesInput} onChange={(event) => setNotesInput(event.target.value)} rows={3} maxLength={4000} className="mt-1 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-[#1a2a6c] dark:border-slate-700 dark:bg-[#0b1220]" placeholder="Add internal investigation notes. Notes are not included in user notifications." />
                    </label>
                    <button type="submit" disabled={saving} className="mt-4 rounded-xl bg-[#1a2a6c] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#24377f] disabled:opacity-60">Review report update</button>
                  </form>
                </article>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/70 dark:bg-[#111a2b]">
                  <h3 className="text-base font-extrabold text-[#1a2a6c] dark:text-white">Report update history</h3>
                  {updates.length ? (
                    <ol className="mt-4 space-y-4">
                      {updates.map((update) => (
                        <li key={update.id} className="border-l-2 border-[#c9a028] pl-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-bold">
                              {STATUS_LABELS[update.previous_status] || "New"} → {STATUS_LABELS[update.new_status] || update.new_status}
                            </p>
                            <time className="text-xs text-slate-500 dark:text-slate-400">{formatDate(update.created_at)}</time>
                          </div>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            By {[update.actor_name, update.actor_last_name].filter(Boolean).join(" ") || `User ${update.updated_by}`}
                          </p>
                          {update.notes ? <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{update.notes}</p> : null}
                        </li>
                      ))}
                    </ol>
                  ) : <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No investigation updates have been recorded.</p>}
                </section>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-[#111a2b]">Report details are unavailable.</div>
            )}
          </section>
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Confirm report update"
        description={`Save status "${STATUS_LABELS[statusInput] || statusInput}", assignment, investigation notes, and resolution for this report? The update and notification records will be retained in history.`}
        confirmText="Save report update"
        onConfirm={saveUpdate}
        onCancel={() => setConfirmOpen(false)}
        loading={saving}
      />
    <ActionFeedback pending={saving} error={updateError} success={notice} showLoading={false} successTitle="Report updated" />
      </main>
  );
}
