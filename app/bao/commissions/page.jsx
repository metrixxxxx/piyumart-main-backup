"use client";

import { useEffect, useState } from "react";
import BaoHeader from "@/components/bao/BaoHeader";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { FinanceStatus } from "@/components/payments/FinanceUI";
import { useMarketplaceRealtime } from "@/lib/realtime/useMarketplaceRealtime";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
});
const countFormatter = new Intl.NumberFormat("en-PH");

function formatCurrency(value) {
  return currencyFormatter.format(Number(value || 0));
}

function formatCount(value) {
  return countFormatter.format(Number(value || 0));
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString("en-PH") : "—";
}

export default function BaoCommissionsPage() {
  const [report, setReport] = useState(null);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [appliedRange, setAppliedRange] = useState({ from: "", to: "" });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [rateInput, setRateInput] = useState("");
  const [reason, setReason] = useState("");
  const [rateError, setRateError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [savingRate, setSavingRate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useMarketplaceRealtime({ audience: "staff", scopes: ["orders", "payments", "finance"],
    onChange: () => setRefreshKey((current) => current + 1) });

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page) });
    if (appliedRange.from) params.set("from", appliedRange.from);
    if (appliedRange.to) params.set("to", appliedRange.to);

    fetch(`/api/bao/commissions?${params.toString()}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load commission data.");
        if (!active) return;
        setReport(data);
        setError("");
        if (!appliedRange.from && !appliedRange.to) setDateRange(data.range);
        if (!data.currentRate) {
          setRateInput((current) => current || String(data.proposedInitialRate));
        }
      })
      .catch((requestError) => {
        if (requestError.name === "AbortError") return;
        console.error("BAO commission report request failed:", requestError);
        if (active) setError(requestError.message || "Unable to load commission data.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [appliedRange, page, refreshKey]);

  function applyDateRange(event) {
    event.preventDefault();
    if (!dateRange.from || !dateRange.to || dateRange.from > dateRange.to) {
      setFilterError("Choose a valid start and end date.");
      return;
    }

    setFilterError("");
    if (dateRange.from === appliedRange.from && dateRange.to === appliedRange.to) return;
    setLoading(true);
    setPage(1);
    setAppliedRange({ ...dateRange });
  }

  function requestRateChange(event) {
    event.preventDefault();
    setRateError("");
    setNotice("");

    const percentage = Number(rateInput);
    if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
      setRateError("Enter a rate greater than 0% and no more than 100%.");
      return;
    }
    if (!reason.trim()) {
      setRateError("A reason is required to set or change the rate.");
      return;
    }
    setConfirmOpen(true);
  }

  async function saveRate() {
    setSavingRate(true);
    setRateError("");
    try {
      const response = await fetch("/api/bao/commissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ percentage: rateInput, reason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save the commission rate.");

      setNotice(`Commission rate set to ${data.rate.percentage}%.`);
      setReason("");
      setRateInput("");
      setConfirmOpen(false);
      setLoading(true);
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      console.error("BAO commission rate update failed:", requestError);
      setRateError(requestError.message || "Unable to save the commission rate.");
      setConfirmOpen(false);
    } finally {
      setSavingRate(false);
    }
  }

  const currentRate = report?.currentRate;
  const rangeTotals = report?.totals?.selectedRange;
  const allTimeTotals = report?.totals?.allTime;
  const history = report?.history;

  return (
    <main className="min-h-dvh bg-[#eef2f7] text-slate-900 dark:bg-[#090e1b] dark:text-slate-100">
      <BaoHeader active="commissions" />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#927116] dark:text-[#e3c36c]">
              Business Administration Office
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#1a2a6c] dark:text-white sm:text-4xl">
              Commission management
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              Confirmed online payments appear here immediately. Commission becomes earned when
              the buyer confirms receipt. Cash-on-pickup commissions appear on order completion.
            </p>
          </div>
          <button type="button" onClick={() => setRefreshKey((current) => current + 1)}
            className="rounded-xl bg-[#1a2a6c] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#24377f]">Refresh</button>
        </div>

        {notice ? (
          <div role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200">
            {notice}
          </div>
        ) : null}
        {error ? (
          <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        ) : null}

        {!currentRate && report ? (
          <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            No cash-on-pickup rate is active. The proposed initial rate of {report.proposedInitialRate}% is only a
            suggestion; an authorized BAO or admin must set it with a reason before it applies to
            eligible future cash orders. Online orders keep their original 3% allocation.
          </div>
        ) : null}

        <section aria-label="Commission totals" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/70 dark:bg-[#111a2b]">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total commission earned</p>
            <p className="mt-4 text-2xl font-extrabold text-[#1a2a6c] dark:text-white">
              {loading ? "…" : formatCurrency(allTimeTotals?.commission_amount)}
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">From recorded completed orders</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/70 dark:bg-[#111a2b]">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Pending online commission</p>
            <p className="mt-4 text-2xl font-extrabold text-[#1a2a6c] dark:text-white">
              {loading ? "…" : formatCurrency(allTimeTotals?.pending_commission_amount)}
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Paid orders awaiting completion, after refunds</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/70 dark:bg-[#111a2b]">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Selected-range commission</p>
            <p className="mt-4 text-2xl font-extrabold text-[#1a2a6c] dark:text-white">
              {loading ? "…" : formatCurrency(rangeTotals?.commission_amount)}
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {loading ? "Loading date range…" : `${formatCount(rangeTotals?.order_count)} completed orders`}
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/70 dark:bg-[#111a2b]">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Cash-on-pickup rate</p>
            <p className="mt-4 text-2xl font-extrabold text-[#1a2a6c] dark:text-white">
              {loading ? "…" : currentRate ? `${currentRate.percentage}%` : "Not set"}
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {currentRate ? `Effective ${formatDate(currentRate.effective_at)}` : "Proposed start: 3%"}
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/70 dark:bg-[#111a2b]">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Seller earnings in range</p>
            <p className="mt-4 text-2xl font-extrabold text-[#1a2a6c] dark:text-white">
              {loading ? "…" : formatCurrency(rangeTotals?.seller_earnings)}
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Product order amounts less commission
            </p>
          </article>
        </section>

        <section className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/70 dark:bg-[#111a2b]">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <h2 className="text-lg font-extrabold text-[#1a2a6c] dark:text-white">Commission by date range</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Philippine calendar dates: online payment confirmation or cash order completion. Amounts reflect confirmed refunds.</p>
              </div>
              <form onSubmit={applyDateRange} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  From
                  <input
                    type="date"
                    value={dateRange.from}
                    onChange={(event) => setDateRange((current) => ({ ...current, from: event.target.value }))}
                    className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0b1220]"
                    required
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  To
                  <input
                    type="date"
                    value={dateRange.to}
                    onChange={(event) => setDateRange((current) => ({ ...current, to: event.target.value }))}
                    className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0b1220]"
                    required
                  />
                </label>
                <button type="submit" className="self-end rounded-lg bg-[#1a2a6c] px-4 py-2 text-sm font-bold text-white hover:bg-[#24377f]">
                  Apply
                </button>
              </form>
            </div>
            {filterError ? <p role="alert" className="mt-3 text-xs text-red-600 dark:text-red-300">{filterError}</p> : null}
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Order amount: {formatCurrency(rangeTotals?.order_amount)} · Seller earnings: {formatCurrency(rangeTotals?.seller_earnings)}
            </p>
          </div>

          <form onSubmit={requestRateChange} className="rounded-2xl border border-[#c9a028]/50 bg-white p-5 shadow-sm dark:border-[#c9a028]/30 dark:bg-[#111a2b]">
            <h2 className="text-lg font-extrabold text-[#1a2a6c] dark:text-white">
              {currentRate ? "Update commission rate" : "Set initial commission rate"}
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              This appends an immutable rate record. It only applies to orders placed on or after its effective time.
              Online payments keep their original 3% allocation.
            </p>
            <label htmlFor="bao-commission-rate" className="mt-4 block text-sm font-semibold">
              Rate percentage
            </label>
            <div className="relative mt-1">
              <input
                id="bao-commission-rate"
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                value={rateInput}
                onChange={(event) => setRateInput(event.target.value)}
                placeholder={String(report?.proposedInitialRate ?? 3)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pr-10 text-sm outline-none focus:border-[#1a2a6c] dark:border-slate-700 dark:bg-[#0b1220] dark:focus:border-[#c9a028]"
                required
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">%</span>
            </div>
            <label htmlFor="bao-commission-reason" className="mt-4 block text-sm font-semibold">
              Required reason
            </label>
            <textarea
              id="bao-commission-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Explain why this commission rate is being set or changed."
              className="mt-1 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-[#1a2a6c] dark:border-slate-700 dark:bg-[#0b1220] dark:focus:border-[#c9a028]"
              required
            />
            {rateError ? <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-300">{rateError}</p> : null}
            <button type="submit" disabled={savingRate} className="mt-4 w-full rounded-xl bg-[#1a2a6c] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#24377f] disabled:cursor-not-allowed disabled:opacity-60">
              Review rate change
            </button>
          </form>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/70 dark:bg-[#111a2b]">
          <h2 className="text-lg font-extrabold text-[#1a2a6c] dark:text-white">Commission per seller</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Net allocations from paid online orders and completed cash orders in this range, including pending commission.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-3">Seller</th>
                  <th className="px-3 py-3 text-right">Orders</th>
                  <th className="px-3 py-3 text-right">Order amount</th>
                  <th className="px-3 py-3 text-right">Commission</th>
                  <th className="px-3 py-3 text-right">Seller earnings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">Loading seller totals…</td></tr>
                ) : report?.sellers?.length ? report.sellers.map((seller) => (
                  <tr key={seller.seller_id ?? seller.seller_name}>
                    <td className="px-3 py-3 font-semibold">{seller.seller_name}</td>
                    <td className="px-3 py-3 text-right">{formatCount(seller.order_count)}</td>
                    <td className="px-3 py-3 text-right">{formatCurrency(seller.order_amount)}</td>
                    <td className="px-3 py-3 text-right font-bold text-[#1a2a6c] dark:text-[#e9d48f]">{formatCurrency(seller.commission_amount)}</td>
                    <td className="px-3 py-3 text-right">{formatCurrency(seller.seller_earnings)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500 dark:text-slate-400">No commission records in this date range.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/70 dark:bg-[#111a2b]">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-[#1a2a6c] dark:text-white">Commission transactions</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {formatCount(history?.totalRows)} record(s) · cash and verified online payments · one row per seller order
              </p>
            </div>
            {history?.totalPages > 1 ? (
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <button
                  type="button"
                  disabled={loading || history.page <= 1}
                  onClick={() => { setLoading(true); setPage((current) => Math.max(1, current - 1)); }}
                  className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-50 dark:border-slate-700"
                >
                  Previous
                </button>
                <span>Page {history.page} of {history.totalPages}</span>
                <button
                  type="button"
                  disabled={loading || history.page >= history.totalPages}
                  onClick={() => { setLoading(true); setPage((current) => current + 1); }}
                  className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-50 dark:border-slate-700"
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-3">Recorded</th>
                  <th className="px-3 py-3">Order</th>
                  <th className="px-3 py-3">Seller</th>
                  <th className="px-3 py-3">Payment</th>
                  <th className="px-3 py-3">Order status</th>
                  <th className="px-3 py-3 text-right">Rate</th>
                  <th className="px-3 py-3 text-right">Net order amount</th>
                  <th className="px-3 py-3 text-right">Commission</th>
                  <th className="px-3 py-3 text-right">Seller earnings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-500">Loading commission history…</td></tr>
                ) : history?.records?.length ? history.records.map((record) => (
                  <tr key={record.id}>
                    <td className="px-3 py-3 whitespace-nowrap">{formatDate(record.created_at)}</td>
                    <td className="px-3 py-3 font-semibold">#{record.order_id}</td>
                    <td className="px-3 py-3">{record.seller_name}</td>
                    <td className="max-w-[200px] px-3 py-3 text-xs">
                      <p className="font-semibold">{record.payment_method === "paymongo" ? "PayMongo · Paid online" : "Cash on Pick-up"}</p>
                      {record.payment_reference && <p className="mt-1 break-all text-slate-500 dark:text-slate-400">{record.payment_reference}</p>}
                      {Number(record.refunded_amount) > 0 && <p className="mt-1 text-rose-700 dark:text-rose-300">Refunded {formatCurrency(record.refunded_amount)}</p>}
                    </td>
                    <td className="px-3 py-3"><FinanceStatus value={record.order_status} /></td>
                    <td className="px-3 py-3 text-right">{record.commission_rate}%</td>
                    <td className="px-3 py-3 text-right">{formatCurrency(record.order_amount)}</td>
                    <td className="px-3 py-3 text-right font-bold text-[#1a2a6c] dark:text-[#e9d48f]">{formatCurrency(record.commission_amount)}</td>
                    <td className="px-3 py-3 text-right">{formatCurrency(record.seller_earnings)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-500 dark:text-slate-400">No commission records in this date range.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/70 dark:bg-[#111a2b]">
          <h2 className="text-lg font-extrabold text-[#1a2a6c] dark:text-white">Commission rate history</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Rate records are append-only and include the reason and authorized actor.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-3">Effective</th>
                  <th className="px-3 py-3 text-right">Rate</th>
                  <th className="px-3 py-3">Changed by</th>
                  <th className="px-3 py-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-500">Loading rate history…</td></tr>
                ) : report?.rateHistory?.length ? report.rateHistory.map((rate) => (
                  <tr key={rate.id}>
                    <td className="px-3 py-3 whitespace-nowrap">{formatDate(rate.effective_at)}</td>
                    <td className="px-3 py-3 text-right font-bold">{rate.percentage}%</td>
                    <td className="px-3 py-3">{[rate.actor_name, rate.actor_last_name].filter(Boolean).join(" ") || `User ${rate.changed_by}`}</td>
                    <td className="px-3 py-3 whitespace-pre-wrap">{rate.notes || "—"}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-500 dark:text-slate-400">No commission rates have been configured.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title={currentRate ? "Confirm commission rate update" : "Confirm initial commission rate"}
        description={`Set the commission rate to ${rateInput}%. The change will be recorded with your reason and will apply only to orders placed at or after its effective time. Existing rate and order commission snapshots will remain unchanged.`}
        confirmText={currentRate ? "Update rate" : "Set rate"}
        onConfirm={saveRate}
        onCancel={() => setConfirmOpen(false)}
        loading={savingRate}
      />
    </main>
  );
}
