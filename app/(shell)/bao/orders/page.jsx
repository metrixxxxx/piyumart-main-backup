"use client";

import { useEffect, useState } from "react";
import { useMarketplaceRealtime } from "@/lib/realtime/useMarketplaceRealtime";
import PickupProofLink from "@/components/orders/PickupProofLink";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

function statusClass(status) {
  if (status === "pending") return "bg-yellow-50 text-yellow-700";
  if (status === "confirmed") return "bg-purple-50 text-purple-700";
  if (status === "processing") return "bg-blue-50 text-blue-700";
  if (status === "shipped") return "bg-indigo-50 text-indigo-700";
  if (status === "completed") return "bg-green-50 text-green-700";
  return "bg-red-50 text-red-700";
}

export default function BaoOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useMarketplaceRealtime({
    audience: "staff",
    scopes: ["orders"],
    onChange: () => setRefreshKey((current) => current + 1),
  });

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    fetch("/api/bao/orders", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load orders.");
        if (active) {
          setOrders(data);
          setError("");
        }
      })
      .catch((requestError) => {
        if (requestError.name === "AbortError") return;
        console.error("BAO order list request failed:", requestError);
        if (active) setError(requestError.message || "Unable to load orders.");
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
      <div className="mb-5">
        <h2 className="text-xl font-bold text-[#1a2a6c]">Orders</h2>
        <p className="mt-1 text-sm text-slate-600">Review marketplace orders and payment status.</p>
      </div>
      {error ? (
        <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Order ID</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Buyer</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Address</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Total</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Payment</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Status</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Photo proof</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-4 text-slate-600">Loading orders...</td></tr>
            ) : orders.length ? (
              orders.map((order) => (
                <tr key={order.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-slate-600">#{order.id}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{order.buyer_name || order.name || "Unknown buyer"}</p>
                    <p className="text-xs text-slate-500">{order.buyer_email || ""}</p>
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-slate-600">{order.address || "—"}</td>
                  <td className="px-4 py-3 font-bold text-slate-900">{currencyFormatter.format(Number(order.total) || 0)}</td>
                  <td className="px-4 py-3 text-xs uppercase text-slate-600">{order.payment_method || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass(order.status)}`}>
                      {order.status || "unknown"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {order.has_pickup_proof ? <PickupProofLink orderId={order.id} audience="staff" /> : <span className="text-xs text-slate-500">No photo saved</span>}
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={7} className="px-4 py-4 text-slate-600">No orders found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
