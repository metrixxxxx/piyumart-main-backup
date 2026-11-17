"use client";

import { useEffect, useState } from "react";
import BaoHeader from "@/components/bao/BaoHeader";
import { useMarketplaceRealtime } from "@/lib/realtime/useMarketplaceRealtime";

const metrics = [
  { key: "totalRegisteredUsers", label: "Registered users", kind: "count" },
  { key: "totalSellers", label: "Total sellers", kind: "count" },
  { key: "totalApprovedProducts", label: "Approved products", kind: "count" },
  { key: "pendingProductApprovals", label: "Pending product approvals", kind: "count" },
  { key: "completedOrders", label: "Completed orders", kind: "count" },
  { key: "totalMarketplaceSales", label: "Marketplace sales", kind: "currency" },
  { key: "totalBaoCommission", label: "BAO commission", kind: "currency" },
  { key: "pendingComplaints", label: "Pending complaints", kind: "count" },
];

const countFormatter = new Intl.NumberFormat("en-PH");
const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
});

function formatMetric(value, kind) {
  const numericValue = Number(value);
  return kind === "currency"
    ? currencyFormatter.format(numericValue)
    : countFormatter.format(numericValue);
}

export default function BaoDashboardPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useMarketplaceRealtime({ audience: "staff", scopes: ["orders", "payments", "finance"],
    onChange: () => setRefreshKey((current) => current + 1) });

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    fetch("/api/bao/dashboard", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Unable to load dashboard metrics.");
        }
        if (active) { setStats(data); setError(""); }
      })
      .catch((requestError) => {
        if (requestError.name === "AbortError") return;
        console.error("Unable to load BAO dashboard:", requestError);
        if (active) {
          setError(requestError.message || "Unable to load dashboard metrics.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [refreshKey]);

  return (
    <main className="min-h-dvh bg-[#eef2f7] text-slate-900 dark:bg-[#090e1b] dark:text-slate-100">
      <BaoHeader active="overview" />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#927116] dark:text-[#e3c36c]">
              Business Administration Office
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#1a2a6c] dark:text-white sm:text-4xl">
              Marketplace overview
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400 sm:text-base">
              Live marketplace activity and transaction totals.
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#c9a028]/40 bg-white px-3 py-2 text-xs font-semibold text-[#1a2a6c] shadow-sm dark:bg-[#111a2b] dark:text-[#e9d48f]">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            Authorized BAO access
          </div>
        </div>

        {error ? (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200"
          >
            {error}
          </div>
        ) : null}

        <section
          aria-label="Marketplace statistics"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {metrics.map((metric, index) => (
            <article
              key={metric.key}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700/70 dark:bg-[#111a2b]"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="max-w-[13rem] text-sm font-medium leading-5 text-slate-600 dark:text-slate-400">
                  {metric.label}
                </p>
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                    index % 2 === 0
                      ? "bg-[#1a2a6c]/10 text-[#1a2a6c] dark:bg-[#8494e8]/15 dark:text-[#b5c0ff]"
                      : "bg-[#c9a028]/15 text-[#846712] dark:text-[#e9d48f]"
                  }`}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
              </div>
              <p className="mt-6 min-h-9 text-2xl font-extrabold tracking-tight text-[#1a2a6c] dark:text-white sm:text-[1.7rem]">
                {loading ? (
                  <span className="inline-block h-7 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                ) : stats ? (
                  formatMetric(stats[metric.key], metric.kind)
                ) : (
                  "—"
                )}
              </p>
              <div className="mt-4 h-1 w-12 rounded-full bg-[#c9a028]" aria-hidden="true" />
            </article>
          ))}
        </section>

        <p className="mt-6 text-xs text-slate-500 dark:text-slate-500">
          Sales and commission totals include completed orders only.
        </p>
      </div>
    </main>
  );
}
