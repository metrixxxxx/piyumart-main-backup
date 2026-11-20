"use client";
import { orderStatusLabel } from "@/lib/orders/status";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMarketplaceRealtime } from "@/lib/realtime/useMarketplaceRealtime";

const metrics = [
  { key: "totalProducts", label: "Total Products", accent: "border-t-[#131f50]" },
  { key: "totalRegisteredUsers", label: "Total Users", accent: "border-t-[#1a6c2a]" },
  { key: "totalOrders", label: "Total Orders", accent: "border-t-[#FABB00]" },
];

const countFormatter = new Intl.NumberFormat("en-PH");
const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

function statusClass(status) {
  if (status === "completed") return "bg-green-50 text-green-700";
  if (status === "pending") return "bg-yellow-50 text-yellow-700";
  if (status === "cancelled" || status === "canceled") return "bg-red-50 text-red-700";
  return "bg-blue-50 text-blue-700";
}

export default function BaoDashboardPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useMarketplaceRealtime({
    audience: "staff",
    scopes: ["orders", "payments", "finance"],
    onChange: () => setRefreshKey((current) => current + 1),
  });

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    fetch("/api/bao/dashboard", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Unable to load dashboard metrics.");
        }
        if (active) {
          setStats(data);
          setError("");
        }
      })
      .catch((requestError) => {
        if (requestError.name === "AbortError") return;
        console.error("Unable to load BAO dashboard:", requestError);
        if (active) setError(requestError.message || "Unable to load dashboard metrics.");
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
    <main className="min-h-[calc(100dvh-3rem)] p-4 sm:p-6">
      {error ? (
        <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <section aria-label="Marketplace statistics" className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {metrics.map((metric) => (
          <article key={metric.key} className={`rounded-xl border border-[#dbe1f0] border-t-4 bg-white p-5 shadow-sm ${metric.accent}`}>
            <p className="text-sm font-semibold text-[#4a5a7a]">{metric.label}</p>
            <p className="mt-2 text-3xl font-extrabold tabular-nums text-[#131f50]">
              {loading ? (
                <span className="inline-block h-9 w-12 animate-pulse rounded bg-slate-200 align-middle" />
              ) : stats ? (
                countFormatter.format(Number(stats[metric.key] || 0))
              ) : (
                "—"
              )}
            </p>
          </article>
        ))}
      </section>

      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[#1a2a6c]">Recent Orders</h2>
        <Link href="/bao/orders" className="rounded text-sm font-semibold text-[#1a2a6c] underline decoration-[#FABB00] decoration-2 underline-offset-4 hover:decoration-current">
          View all
        </Link>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Order</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Buyer</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Total</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-4 text-slate-600">Loading recent orders...</td></tr>
            ) : stats?.recentOrders?.length ? (
              stats.recentOrders.map((order) => (
                <tr key={order.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-slate-600">#{order.id}</td>
                  <td className="px-4 py-3 text-slate-800">{order.buyer || "Unknown buyer"}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{currencyFormatter.format(Number(order.total) || 0)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass(order.status)}`}>
                      {orderStatusLabel(order.status)}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={4} className="px-4 py-4 text-slate-600">No recent orders.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
