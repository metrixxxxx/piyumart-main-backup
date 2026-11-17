"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useMarketplaceRealtime } from "@/lib/realtime/useMarketplaceRealtime";
import ConfirmModal from "@/components/ui/ConfirmModal";

function StatCard({ label, value, accent, description }) {
  return (
    <div className="bg-white dark:bg-[#0e1520] rounded-2xl border border-[#c5cfe8] dark:border-white/[0.07] p-4">
      <p className="text-[11px] font-semibold text-[#0e1a3d]/50 dark:text-[#e8edf8]/40 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-bold ${accent || "text-[#0e1a3d] dark:text-[#e8edf8]"}`}>{value}</p>
      {description ? <p className="mt-1 text-[10px] leading-4 text-[#0e1a3d]/45 dark:text-[#e8edf8]/40">{description}</p> : null}
    </div>
  );
}

function formatCurrency(value) {
  return `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function groupOrdersById(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const key = String(row.id);
    if (!grouped.has(key)) grouped.set(key, { ...row, items: [] });
    grouped.get(key).items.push(row);
  }
  return [...grouped.values()];
}

export default function MyListingsPage() {
  const { data: session } = useSession();
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [orderStats, setOrderStats] = useState({
    totalOrders: 0,
    completedOrders: 0,
    grossRevenue: 0,
    commission: 0,
    revenue: 0,
    unrecordedCompletedOrders: 0,
    unrecordedCommission: 0,
  });
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("listings");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useMarketplaceRealtime({
    enabled: !!session?.user?.id,
    identity: session?.user?.id,
    onChange: () => setRefresh((value) => value + 1),
  });

  useEffect(() => {
    if (!session) return;
    let mounted = true;

    const loadData = async () => {
      const [productsRes, statsRes, ordersRes, reviewsRes] = await Promise.all([
        fetch("/api/sell", { cache: "no-store" }),
        fetch("/api/my-listings/stats", { cache: "no-store" }),
        fetch("/api/seller/orders", { cache: "no-store" }),
        fetch("/api/seller/reviews", { cache: "no-store" }),
      ]);
      const productsData = await productsRes.json();
      const statsData = await statsRes.json();
      const ordersData = await ordersRes.json();
      const reviewsData = await reviewsRes.json();
      if (mounted) {
        setProducts(Array.isArray(productsData) ? productsData : []);
        setOrderStats(statsData);
        setOrders(Array.isArray(ordersData) ? ordersData : []);
        setReviews(Array.isArray(reviewsData) ? reviewsData : []);
        setLoading(false);
      }
    };

    loadData().catch((error) => {
      console.error("Unable to refresh seller orders:", error);
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [session?.user?.id, refresh]);

  async function handleOrderStatus(id, status) {
    setOrders((prev) =>
      prev.map((o) => (Number(o.id) === Number(id) ? { ...o, _loading: true } : o))
    );
    try {
      const res = await fetch(`/api/seller/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Unable to update order.");
      if (!data?.success || typeof data.status !== "string") {
        throw new Error("Unable to read the order update. Refresh the page to check its status.");
      }
      setOrders((prev) =>
        prev.map((o) => (Number(o.id) === Number(id) ? { ...o, status: data.status } : o))
      );
    } catch (error) {
      alert(error.message || "Unable to update order.");
    } finally {
      setOrders((prev) =>
        prev.map((o) => (Number(o.id) === Number(id) ? { ...o, _loading: false } : o))
      );
    }
  }

  async function handleDelete(id) {
    setConfirmDeleteId(id);
  }

  async function confirmDeleteListing() {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    await fetch(`/api/my-listings/${id}`, { method: "DELETE" });
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  async function toggleVisibility(id, current) {
    const newVisibility = !Boolean(current);
    await fetch(`/api/my-listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_visible: newVisibility }),
    });
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, is_visible: newVisibility } : p)));
  }

  const stats = {
    total: products.length,
    active: products.filter((p) => Number(p.is_visible) === 1).length,
    totalOrders: orderStats.totalOrders,
    revenue: orderStats.revenue,
  };
  const filtered =
    filter === "all"
      ? products
      : products.filter((p) => (filter === "visible" ? Number(p.is_visible) === 1 : Number(p.is_visible) === 0));
  const pendingOrders = orders.filter((o) => o.status === "pending").length;
  const groupedOrders = groupOrdersById(orders);

  if (!session)
    return (
      <div className="min-h-screen bg-[#f0eeff] dark:bg-[#070b14] flex items-center justify-center text-sm text-[#0e1a3d]/50 dark:text-[#e8edf8]/40">
        Please log in.
      </div>
    );
  if (loading)
    return (
      <div className="min-h-screen bg-[#f0eeff] dark:bg-[#070b14] flex items-center justify-center">
        <div className="w-10 h-10 border-[3px] border-[#c5cfe8] dark:border-white/10 border-t-[#1a2a6c] dark:border-t-[#c9a028] rounded-full animate-spin" />
      </div>
    );

  return (
    <main className="min-h-screen bg-[#f0eeff] dark:bg-[#070b14] transition-colors duration-300">
      <section className="bg-[#1a2a6c] dark:bg-[#0a0e1f] px-4 sm:px-5 py-10 sm:py-12 text-center">
        <div className="inline-flex items-center gap-2 bg-white/10 text-[#c9a028] text-[11px] font-bold px-4 py-1.5 rounded-full mb-4 uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-[#c9a028]" />
          Seller Dashboard
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">My Listings</h1>
        <p className="mt-2 text-sm text-white/60">Manage your products and orders</p>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-5 py-8">
        <div className="grid grid-cols-2 gap-3 mb-5 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Total Listings" value={stats.total} />
          <StatCard label="Active" value={stats.active} accent="text-green-500" />
          <StatCard label="Total Orders" value={stats.totalOrders} />
          <StatCard
            label="Completed Gross Sales"
            value={formatCurrency(orderStats.grossRevenue)}
            description={`${orderStats.completedOrders} completed transactions`}
          />
          <StatCard
            label="BAO Commission"
            value={formatCurrency(orderStats.commission)}
            accent="text-[#927116] dark:text-[#e9d48f]"
            description={
              orderStats.unrecordedCompletedOrders
                ? `${formatCurrency(orderStats.unrecordedCommission)} estimated on ${orderStats.unrecordedCompletedOrders} completed order(s) without saved snapshots`
                : "Calculated once per completed seller order"
            }
          />
          <StatCard
            label="Seller Net Revenue"
            value={formatCurrency(orderStats.revenue)}
            accent="text-[#1a2a6c] dark:text-[#c9a028]"
            description="Completed gross sales less the applicable BAO commission"
          />
        </div>
        <p className="mb-8 text-xs leading-5 text-[#0e1a3d]/55 dark:text-[#e8edf8]/45">
          The commission rate effective when each order was placed is applied once to the whole seller order, not to every item. Uncompleted orders show estimates; commission is recorded when the buyer confirms receipt. No money is automatically transferred.
        </p>

        <div className="flex justify-end mb-5">
          <Link href="/sell" className="bg-[#1a2a6c] text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-[#142060] transition">
            + Add Product
          </Link>
        </div>

        <div className="flex gap-1 mb-6 border-b border-[#c5cfe8] dark:border-white/[0.07]">
          <button onClick={() => setActiveTab("listings")}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 -mb-px transition
              ${activeTab === "listings" ? "border-[#1a2a6c] dark:border-[#c9a028] text-[#1a2a6c] dark:text-[#c9a028]" : "border-transparent text-[#0e1a3d]/50 dark:text-[#e8edf8]/40 hover:text-[#0e1a3d] dark:hover:text-[#e8edf8]"}`}>
            Listings
          </button>
          <button onClick={() => setActiveTab("orders")}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 -mb-px flex items-center gap-2 transition
              ${activeTab === "orders" ? "border-[#1a2a6c] dark:border-[#c9a028] text-[#1a2a6c] dark:text-[#c9a028]" : "border-transparent text-[#0e1a3d]/50 dark:text-[#e8edf8]/40 hover:text-[#0e1a3d] dark:hover:text-[#e8edf8]"}`}>
            Orders
            {pendingOrders > 0 && (
              <span className="text-[10px] bg-amber-400 text-black px-1.5 py-0.5 rounded-full font-bold">{pendingOrders}</span>
            )}
          </button>
          <button onClick={() => setActiveTab("reviews")}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 -mb-px flex items-center gap-2 transition
              ${activeTab === "reviews" ? "border-[#1a2a6c] dark:border-[#c9a028] text-[#1a2a6c] dark:text-[#c9a028]" : "border-transparent text-[#0e1a3d]/50 dark:text-[#e8edf8]/40 hover:text-[#0e1a3d] dark:hover:text-[#e8edf8]"}`}>
            Reviews
            {reviews.length > 0 && (
              <span className="text-[10px] bg-[#1a2a6c] dark:bg-[#c9a028] text-white dark:text-black px-1.5 py-0.5 rounded-full font-bold">{reviews.length}</span>
            )}
          </button>
        </div>

        {/* Listings Tab */}
        {activeTab === "listings" && (
          <>
            <div className="flex gap-2 mb-4">
              {["all", "visible", "hidden"].map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition
                    ${filter === f ? "bg-[#1a2a6c] text-white font-bold" : "bg-white dark:bg-white/[0.04] border border-[#c5cfe8] dark:border-white/[0.07] text-[#0e1a3d]/60 dark:text-[#e8edf8]/50 hover:border-[#1a2a6c] dark:hover:border-[#c9a028]"}`}>
                  {f}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-16 text-sm text-[#0e1a3d]/50 dark:text-[#e8edf8]/40">
                No listings found.{" "}
                <Link href="/sell" className="text-[#1a2a6c] dark:text-[#c9a028] hover:underline">Sell something</Link>
              </div>
            ) : (
              <div className="bg-white dark:bg-[#0e1520] rounded-2xl border border-[#c5cfe8] dark:border-white/[0.07] overflow-x-auto">
                <table className="w-full min-w-[720px] text-xs">
                  <thead>
                    <tr className="border-b border-[#c5cfe8] dark:border-white/[0.07] text-[#0e1a3d]/40 dark:text-[#e8edf8]/30 uppercase tracking-wider">
                      <th className="text-left px-4 py-3">Product</th>
                      <th className="text-left px-4 py-3">Price</th>
                      <th className="text-left px-4 py-3">Stock</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-left px-4 py-3">Date</th>
                      <th className="text-left px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr key={p.id} className="border-b border-[#c5cfe8] dark:border-white/[0.07] hover:bg-[#f0f4ff] dark:hover:bg-white/[0.02] transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {p.image_url && <Image src={p.image_url} alt={p.name} width={36} height={36} className="rounded-lg object-cover w-9 h-9 border border-[#c5cfe8] dark:border-white/[0.07]" />}
                            <span className="font-semibold text-[#0e1a3d] dark:text-[#e8edf8]">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#0e1a3d]/70 dark:text-[#e8edf8]/60">₱{Number(p.price).toLocaleString()}</td>
                        <td className="px-4 py-3 text-[#0e1a3d]/70 dark:text-[#e8edf8]/60">{p.stock}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold
                            ${p.is_visible ? "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400" : "bg-[#f0f4ff] dark:bg-white/[0.04] text-[#0e1a3d]/40 dark:text-[#e8edf8]/30"}`}>
                            {p.is_visible ? "Visible" : "Hidden"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#0e1a3d]/40 dark:text-[#e8edf8]/30">{new Date(p.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => toggleVisibility(p.id, p.is_visible)}
                              className="px-2.5 py-1 rounded-lg bg-[#f0f4ff] dark:bg-white/[0.04] text-[#1a2a6c] dark:text-[#c9a028] hover:bg-[#e8edf8] dark:hover:bg-white/[0.08] transition text-[11px] font-semibold">
                              {p.is_visible ? "Hide" : "Show"}
                            </button>
                            <button onClick={() => handleDelete(p.id)}
                              className="px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 transition text-[11px] font-semibold">
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <>
            {orders.length === 0 ? (
              <div className="text-center py-16 text-sm text-[#0e1a3d]/50 dark:text-[#e8edf8]/40">No orders yet.</div>
            ) : (
              <>
                <div className="mb-2 text-xs text-[#0e1a3d]/50 dark:text-[#e8edf8]/40">
                  Use the horizontal scrollbar below to view all order and commission details.
                </div>
                <div className="seller-orders-scrollbar overflow-x-auto rounded-2xl border border-[#c5cfe8] bg-white dark:border-white/[0.07] dark:bg-[#0e1520]">
                <table className="w-full min-w-[1180px] text-xs">
                  <thead>
                    <tr className="border-b border-[#c5cfe8] dark:border-white/[0.07] text-[#0e1a3d]/40 dark:text-[#e8edf8]/30 uppercase tracking-wider">
                      <th className="text-left px-4 py-3">Transaction &amp; action</th>
                      <th className="text-left px-4 py-3">Buyer</th>
                      <th className="text-left px-4 py-3">Items in this order</th>
                      <th className="text-right px-4 py-3">Gross order</th>
                      <th className="text-right px-4 py-3">BAO commission</th>
                      <th className="text-right px-4 py-3">Seller net</th>
                      <th className="text-left px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedOrders.map((o) => {
                      const hasCommissionRate =
                        o.commission_rate !== null && o.commission_rate !== undefined;
                      const commissionRecorded = o.commission_recorded === true;
                      const isCancelled = o.status === "cancelled";
                      const commissionNote = isCancelled
                        ? "Not charged on cancelled orders"
                        : commissionRecorded
                          ? "Final saved order snapshot"
                          : hasCommissionRate
                            ? o.status === "completed"
                              ? "Calculated; snapshot not saved"
                              : "Estimate only; applied on completion"
                            : "No rate active when order was placed";

                      return (
                        <tr key={o.id} className="border-b border-[#c5cfe8] align-top transition hover:bg-[#f0f4ff] dark:border-white/[0.07] dark:hover:bg-white/[0.02]">
                          <td className="min-w-[170px] px-4 py-4">
                            <p className="font-mono font-semibold text-[#0e1a3d] dark:text-[#e8edf8]">#{o.id}</p>
                            <p className="mt-1 text-[10px] text-[#0e1a3d]/45 dark:text-[#e8edf8]/40">
                              {o.created_at ? new Date(o.created_at).toLocaleString("en-PH") : "—"}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {o.status === "pending" && (<>
                                <button disabled={o._loading} onClick={() => handleOrderStatus(o.id, "confirmed")}
                                  className="rounded-lg bg-green-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50">
                                  {o._loading ? "..." : "Confirm order"}
                                </button>
                                <button disabled={o._loading} onClick={() => handleOrderStatus(o.id, "cancelled")}
                                  className="rounded-lg bg-red-50 px-2 py-1.5 text-[11px] font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-500/10 dark:text-red-400">
                                  Cancel
                                </button>
                              </>)}
                              {o.status === "confirmed" && (<>
                                <button disabled={o._loading} onClick={() => handleOrderStatus(o.id, "processing")}
                                  className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                                  {o._loading ? "..." : "Process"}
                                </button>
                                <button disabled={o._loading} onClick={() => handleOrderStatus(o.id, "cancelled")}
                                  className="rounded-lg bg-red-50 px-2 py-1.5 text-[11px] font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-500/10 dark:text-red-400">
                                  Cancel
                                </button>
                              </>)}
                              {o.status === "processing" && (
                                <button disabled={o._loading} onClick={() => handleOrderStatus(o.id, "shipped")}
                                  className="rounded-lg bg-[#1a2a6c] px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#243987] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#c9a028] dark:text-[#070b14]">
                                  {o._loading ? "..." : "Mark shipped"}
                                </button>
                              )}
                              {o.status === "shipped" && (
                                <span className="text-[10px] italic text-[#0e1a3d]/40 dark:text-[#e8edf8]/40">
                                  Awaiting buyer confirmation
                                </span>
                              )}
                              {o.status === "completed" && (
                                <span className="text-[10px] italic text-green-600 dark:text-green-400">
                                  Order complete
                                </span>
                              )}
                              {o.status === "cancelled" && (
                                <span className="text-[10px] italic text-red-500">Cancelled</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-semibold text-[#0e1a3d] dark:text-[#e8edf8]">{o.buyer_name || "Buyer"}</p>
                            <p className="mt-1 text-[10px] text-[#0e1a3d]/45 dark:text-[#e8edf8]/40">{o.buyer_email}</p>
                          </td>
                          <td className="max-w-[260px] px-4 py-4">
                            <div className="space-y-2">
                              {o.items.map((item, index) => (
                                <div key={item.order_item_id || `${o.id}-${index}`}>
                                  <p className="font-semibold text-[#0e1a3d] dark:text-[#e8edf8]">
                                    {item.product_name || "Product"} × {item.quantity}
                                  </p>
                                  <p className="mt-0.5 text-[10px] text-[#0e1a3d]/50 dark:text-[#e8edf8]/45">
                                    {item.variant ? `${item.variant} · ` : ""}
                                    {formatCurrency(item.price)} each
                                  </p>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-right font-bold text-[#0e1a3d] dark:text-[#e8edf8]">
                            {formatCurrency(o.total)}
                          </td>
                          <td className="min-w-[190px] px-4 py-4 text-right">
                            <p className="font-bold text-[#927116] dark:text-[#e9d48f]">
                              {isCancelled ? "₱0.00" : `${hasCommissionRate ? Number(o.commission_rate) : 0}% · ${formatCurrency(o.commission_amount)}`}
                            </p>
                            <p className="mt-1 text-[10px] leading-4 text-[#0e1a3d]/45 dark:text-[#e8edf8]/40">
                              {commissionNote}
                            </p>
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-right font-bold text-[#1a2a6c] dark:text-[#c9a028]">
                            {isCancelled ? "—" : formatCurrency(o.seller_earnings)}
                            {!isCancelled && !commissionRecorded && hasCommissionRate ? (
                              <p className="mt-1 text-[10px] font-normal text-[#0e1a3d]/45 dark:text-[#e8edf8]/40">
                                estimated
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-4">
                            <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold
                              ${o.status === "pending" ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
                              : o.status === "confirmed" ? "bg-[#e8edf8] text-[#1a2a6c] dark:bg-[#1a2a6c]/10 dark:text-[#c9a028]"
                              : o.status === "processing" ? "bg-blue-50 text-blue-500 dark:bg-blue-500/10"
                              : o.status === "shipped" ? "bg-[#e8edf8] text-[#1a2a6c] dark:bg-[#c9a028]/10 dark:text-[#c9a028]"
                              : o.status === "cancelled" ? "bg-red-50 text-red-500 dark:bg-red-500/10"
                              : "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400"}`}>
                              {o.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </>
            )}
          </>
        )}

        {/* Reviews Tab */}
        {activeTab === "reviews" && (
          <>
            {reviews.length === 0 ? (
              <div className="text-center py-16 text-sm text-[#0e1a3d]/50 dark:text-[#e8edf8]/40">
                No reviews yet.
              </div>
            ) : (
              <div className="bg-white dark:bg-[#0e1520] rounded-2xl border border-[#c5cfe8] dark:border-white/[0.07] overflow-x-auto">
                <table className="w-full min-w-[640px] text-xs">
                  <thead>
                    <tr className="border-b border-[#c5cfe8] dark:border-white/[0.07] text-[#0e1a3d]/40 dark:text-[#e8edf8]/30 uppercase tracking-wider">
                      <th className="text-left px-4 py-3">Product</th>
                      <th className="text-left px-4 py-3">Variant</th>
                      <th className="text-left px-4 py-3">Buyer</th>
                      <th className="text-left px-4 py-3">Rating</th>
                      <th className="text-left px-4 py-3">Comment</th>
                      <th className="text-left px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviews.map((r) => (
                      <tr key={r.id} className="border-b border-[#c5cfe8] dark:border-white/[0.07] hover:bg-[#f0f4ff] dark:hover:bg-white/[0.02] transition">
                        <td className="px-4 py-3 font-semibold text-[#0e1a3d] dark:text-[#e8edf8]">{r.product_name}</td>
                        <td className="px-4 py-3 text-[#0e1a3d]/70 dark:text-[#e8edf8]/60">{r.variant|| "N/A"}</td>
                        <td className="px-4 py-3 text-[#0e1a3d]/70 dark:text-[#e8edf8]/60">{r.user_name}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map((i) => (
                              <span key={i} className={i <= r.rating ? "text-[#FFB800]" : "text-[#e5e7eb] dark:text-white/10"}>⭐</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#0e1a3d]/60 dark:text-[#e8edf8]/50 max-w-[240px] truncate">
                          {r.comment || <span className="italic opacity-40">No comment</span>}
                        </td>
                        <td className="px-4 py-3 text-[#0e1a3d]/40 dark:text-[#e8edf8]/30">
                          {new Date(r.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmModal
        open={Boolean(confirmDeleteId)}
        title="Delete this listing?"
        description="This will permanently remove the listing from your seller dashboard."
        confirmText="Delete listing"
        cancelText="Keep listing"
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={confirmDeleteListing}
      />
    </main>
  );
}
