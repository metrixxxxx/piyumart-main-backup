"use client";
import { orderStatusLabel } from "@/lib/orders/status";

import ModalShell from "@/components/ui/ModalShell";
import ActionFeedback from "@/components/ui/ActionFeedback";
import { useEffect, useState } from "react";
import Image from "next/image";

const countFormatter = new Intl.NumberFormat("en-PH");
const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
});

function formatCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? countFormatter.format(count) : "—";
}

function formatCurrency(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? currencyFormatter.format(amount) : "—";
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString("en-PH") : "—";
}

function StatusBadge({ status, label = status }) {
  const styles = {
    active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
    pending: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
    rejected: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200",
    suspended: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100",
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ${styles[status] || "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>
      {label || "unknown"}
    </span>
  );
}

function Metric({ label, value, currency = false }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-[#0b1220]">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-extrabold text-[#1a2a6c] dark:text-white">
        {currency ? formatCurrency(value) : formatCount(value)}
      </p>
    </div>
  );
}

export default function BaoSellersPage() {
  const [sellers, setSellers] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [suspensionSupported, setSuspensionSupported] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedSellerId, setSelectedSellerId] = useState(null);
  const [sellerDetail, setSellerDetail] = useState(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [detailRequest, setDetailRequest] = useState({ key: "", error: "" });
  const [actionError, setActionError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [working, setWorking] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const detailRequestKey = selectedSellerId ? `${selectedSellerId}:${refreshKey}` : "";
  const detailLoading = Boolean(selectedSellerId) && detailRequest.key !== detailRequestKey;
  const detailError = detailRequest.key === detailRequestKey ? detailRequest.error : "";

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ status: statusFilter });
    if (search) params.set("search", search);

    fetch(`/api/bao/sellers?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load sellers.");
        if (!active) return;
        setListError("");
        setSellers(data.sellers);
        setStatusOptions(data.statusOptions);
        setSuspensionSupported(data.suspensionSupported);
        setSelectedSellerId((current) =>
          current && data.sellers.some((seller) => String(seller.id) === String(current))
            ? current
            : data.sellers[0]?.id ?? null
        );
      })
      .catch((error) => {
        console.error("BAO seller list request failed:", error);
        if (active) setListError(error.message || "Unable to load sellers.");
      })
      .finally(() => {
        if (active) setListLoading(false);
      });

    return () => {
      active = false;
    };
  }, [statusFilter, search, refreshKey]);

  useEffect(() => {
    if (!selectedSellerId) return;

    let active = true;
    const requestKey = `${selectedSellerId}:${refreshKey}`;

    fetch(`/api/bao/sellers/${selectedSellerId}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load seller profile.");
        if (active) {
          setSellerDetail(data);
          setDetailRequest({ key: requestKey, error: "" });
        }
      })
      .catch((error) => {
        console.error("BAO seller detail request failed:", error);
        if (active) {
          setDetailRequest({
            key: requestKey,
            error: error.message || "Unable to load seller profile.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [selectedSellerId, refreshKey]);

  async function updateSellerStatus() {
    if (!pendingAction || !sellerDetail) return;
    const trimmedReason = reason.trim();
    if (pendingAction === "suspend" && !trimmedReason) {
      setReasonError("A reason is required to suspend a seller.");
      return;
    }

    setWorking(true);
    setActionError("");
    setActionNotice("");
    try {
      const response = await fetch(`/api/bao/sellers/${sellerDetail.seller.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: pendingAction, reason: trimmedReason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update seller status.");

      setActionNotice(
        `${sellerDetail.seller.name || "Seller"} was ${pendingAction === "suspend" ? "suspended" : "reactivated"}.`
      );
      setReason("");
      setReasonError("");
      setPendingAction("");
      setListLoading(true);
      setListError("");
      setRefreshKey((current) => current + 1);
    } catch (error) {
      console.error("BAO seller action failed:", error);
      setActionError(error.message || "Unable to update seller status.");
      setPendingAction("");
    } finally {
      setWorking(false);
    }
  }

  const seller = sellerDetail?.seller;
  const sellerName = seller
    ? [seller.name, seller.last_name].filter(Boolean).join(" ")
    : "";

  return (
    <main className="min-h-dvh">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#927116] dark:text-[#e3c36c]">
            Marketplace management
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#1a2a6c] dark:text-white sm:text-4xl">
            Seller management
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Review seller profiles, listings, completed sales, and recent activity.
          </p>
        </div>

        {actionNotice ? (
          <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200">
            {actionNotice}
          </div>
        ) : null}
        {actionError ? (
          <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
            {actionError}
          </div>
        ) : null}

        <div className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/70 dark:bg-[#111a2b] sm:grid-cols-[minmax(0,1fr)_220px]">
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setListLoading(true);
              setListError("");
              setSearch(searchInput.trim());
            }}
          >
            <label className="sr-only" htmlFor="bao-seller-search">Search sellers</label>
            <input
              id="bao-seller-search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by seller name or email"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-[#1a2a6c] dark:border-slate-700 dark:bg-[#0b1220] dark:focus:border-[#c9a028]"
            />
            <button type="submit" className="rounded-xl bg-[#1a2a6c] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#24377f]">
              Search
            </button>
          </form>
          <label className="flex items-center gap-3 text-sm font-medium text-slate-600 dark:text-slate-300">
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => {
                setListLoading(true);
                setListError("");
                setStatusFilter(event.target.value);
              }}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#1a2a6c] dark:border-slate-700 dark:bg-[#0b1220] dark:text-slate-100 dark:focus:border-[#c9a028]"
            >
              <option value="all">All statuses</option>
              {statusOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>

        {listError ? (
          <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
            {listError}
          </div>
        ) : null}

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)]">
          <section aria-label="Registered sellers" className="space-y-3">
            {listLoading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-[#111a2b] dark:text-slate-400">
                Loading sellers...
              </div>
            ) : sellers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-[#111a2b]">
                <h2 className="font-semibold text-[#1a2a6c] dark:text-white">No sellers found</h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Try another status or search term.</p>
              </div>
            ) : (
              sellers.map((item) => {
                const name = [item.name, item.last_name].filter(Boolean).join(" ") || "Unnamed seller";
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setSelectedSellerId(item.id)}
                    aria-pressed={String(selectedSellerId) === String(item.id)}
                    className={`w-full rounded-2xl border p-4 text-left shadow-sm transition ${
                      String(selectedSellerId) === String(item.id)
                        ? "border-[#c9a028] bg-[#fffdf6] ring-1 ring-[#c9a028]/40 dark:bg-[#231e10]"
                        : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700/70 dark:bg-[#111a2b] dark:hover:border-slate-600"
                    }`}
                  >
                    <span className="flex items-start gap-3">
                      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1a2a6c]/10 text-sm font-bold text-[#1a2a6c] dark:bg-[#8494e8]/15 dark:text-[#b5c0ff]">
                        {item.image ? (
                          <Image src={item.image} alt="" fill sizes="44px" unoptimized className="object-cover" />
                        ) : (
                          name.slice(0, 1).toUpperCase()
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">{name}</span>
                        <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">{item.email}</span>
                        <span className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <StatusBadge status={item.status} />
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {formatCount(item.product_count)} listings · {formatCount(item.completed_order_count)} completed
                          </span>
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </section>

          <section aria-label="Seller profile and activity" className="min-w-0">
            {!selectedSellerId ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-[#111a2b] dark:text-slate-400">
                Select a seller to view their marketplace activity.
              </div>
            ) : detailLoading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-[#111a2b] dark:text-slate-400">
                Loading seller profile...
              </div>
            ) : detailError ? (
              <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
                {detailError}
              </div>
            ) : !sellerDetail ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-[#111a2b] dark:text-slate-400">
                Select a seller to view their marketplace activity.
              </div>
            ) : (
              <div className="space-y-5">
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/70 dark:bg-[#111a2b]">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#1a2a6c]/10 text-lg font-bold text-[#1a2a6c] dark:bg-[#8494e8]/15 dark:text-[#b5c0ff]">
                        {seller.image ? (
                          <Image src={seller.image} alt="" fill sizes="64px" unoptimized className="object-cover" />
                        ) : (
                          (sellerName || "S").slice(0, 1).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-extrabold text-[#1a2a6c] dark:text-white">{sellerName || "Unnamed seller"}</h2>
                          <StatusBadge status={seller.status} />
                        </div>
                        <p className="mt-1 break-all text-sm text-slate-500 dark:text-slate-400">{seller.email}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Seller ID {seller.id} · Joined {formatDate(seller.created_at)}
                        </p>
                      </div>
                    </div>
                    {suspensionSupported ? (
                      <div className="flex flex-wrap gap-2">
                        {seller.status === "active" ? (
                          <button type="button" onClick={() => setPendingAction("suspend")} className="rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-800">
                            Suspend seller
                          </button>
                        ) : seller.status === "suspended" ? (
                          <button type="button" onClick={() => setPendingAction("reactivate")} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800">
                            Reactivate seller
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Contact number</p>
                      <p className="mt-1 text-sm font-semibold">{seller.contact_number || "Not provided"}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Latest activity</p>
                      <p className="mt-1 text-sm font-semibold">{formatDate(sellerDetail.stats.last_activity_at)}</p>
                    </div>
                  </div>

                  {!suspensionSupported ? (
                    <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
                      Suspension controls are unavailable because the current users.status values are {statusOptions.join(", ")}. No existing status value is being repurposed.
                    </p>
                  ) : null}
                </article>

                <section aria-label="Seller summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                  <Metric label="Total listings" value={sellerDetail.stats.product_count} />
                  <Metric label="Pending listings" value={sellerDetail.stats.pending_products} />
                  <Metric label="Completed orders" value={sellerDetail.stats.completed_order_count} />
                  <Metric label="Completed sales" value={sellerDetail.stats.completed_sales} currency />
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/70 dark:bg-[#111a2b]">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <h3 className="text-base font-extrabold text-[#1a2a6c] dark:text-white">Seller product listings</h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Includes pending, hidden, and moderated listings.</p>
                    </div>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {formatCount(sellerDetail.products.length)} total
                    </span>
                  </div>
                  {sellerDetail.products.length ? (
                    <div className="mt-4 space-y-3">
                      {sellerDetail.products.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                            {item.image_url ? (
                              <Image src={item.image_url} alt="" fill sizes="48px" unoptimized className="object-cover" />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{item.name}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {item.category_name || "Uncategorized"} · {formatCurrency(item.price)} · {formatDate(item.created_at)}
                            </p>
                          </div>
                          <StatusBadge status={item.status} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No product listings found.</p>
                  )}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/70 dark:bg-[#111a2b]">
                  <h3 className="text-base font-extrabold text-[#1a2a6c] dark:text-white">Recent seller orders</h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Completed sales above exclude cancelled and unsuccessful transactions.</p>
                  {sellerDetail.orders.length ? (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full min-w-[560px] text-left text-sm">
                        <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          <tr>
                            <th className="pb-3 pr-4 font-semibold">Order</th>
                            <th className="pb-3 pr-4 font-semibold">Date</th>
                            <th className="pb-3 pr-4 font-semibold">Items</th>
                            <th className="pb-3 pr-4 font-semibold">Status</th>
                            <th className="pb-3 text-right font-semibold">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sellerDetail.orders.map((order) => (
                            <tr key={order.id} className="border-t border-slate-100 dark:border-slate-800">
                              <td className="py-3 pr-4 font-semibold">#{order.id}</td>
                              <td className="py-3 pr-4 text-slate-500 dark:text-slate-400">{formatDate(order.created_at)}</td>
                              <td className="py-3 pr-4">{formatCount(order.item_count)}</td>
                              <td className="py-3 pr-4"><StatusBadge status={order.status} label={orderStatusLabel(order.status)} /></td>
                              <td className="py-3 text-right font-semibold">{formatCurrency(order.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No orders found.</p>
                  )}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/70 dark:bg-[#111a2b]">
                  <h3 className="text-base font-extrabold text-[#1a2a6c] dark:text-white">Seller management history</h3>
                  {sellerDetail.history.length ? (
                    <ol className="mt-4 space-y-4">
                      {sellerDetail.history.map((entry) => (
                        <li key={entry.id} className="border-l-2 border-[#c9a028] pl-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-bold capitalize">{entry.action.replaceAll("_", " ")}</p>
                            <time className="text-xs text-slate-500 dark:text-slate-400">{formatDate(entry.created_at)}</time>
                          </div>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            By {[entry.actor_name, entry.actor_last_name].filter(Boolean).join(" ") || `User ${entry.actor_id}`}
                          </p>
                          {entry.reason ? <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{entry.reason}</p> : null}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No seller management actions have been recorded.</p>
                  )}
                </section>
              </div>
            )}
          </section>
        </div>
      </div>

      {suspensionSupported && seller && pendingAction ? (
        <ModalShell open title={pendingAction==="suspend"?"Suspend seller":"Reactivate seller"} centered={false} busy={working} dismissible={!working} onClose={()=>setPendingAction("")}>
          <div>

            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {pendingAction === "suspend"
                ? `This will prevent ${sellerName || "this seller"} from publishing listings and updating seller orders.`
                : `This will restore active seller access for ${sellerName || "this seller"}.`}
            </p>
            {pendingAction === "suspend" ? (
              <label className="mt-4 block text-sm font-semibold">
                Reason
                <textarea
                  value={reason}
                  onChange={(event) => {
                    setReason(event.target.value);
                    setReasonError("");
                  }}
                  rows={3}
                  maxLength={1000}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-normal outline-none focus:border-[#1a2a6c] dark:border-slate-700 dark:bg-[#0b1220] dark:focus:border-[#c9a028]"
                  placeholder="Required for the audit log"
                />
                {reasonError ? <span role="alert" className="mt-1 block text-xs text-red-600 dark:text-red-300">{reasonError}</span> : null}
              </label>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={working} onClick={() => setPendingAction("")} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-600">
                Cancel
              </button>
              <button type="button" disabled={working} onClick={updateSellerStatus} className="rounded-xl bg-[#1a2a6c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#24377f] disabled:opacity-50">
                {working ? "Working..." : pendingAction === "suspend" ? "Suspend" : "Reactivate"}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}
    <ActionFeedback pending={working} error={actionError} success={actionNotice} pendingTitle="Updating seller access" successTitle="Seller updated" />
      </main>
  );
}
