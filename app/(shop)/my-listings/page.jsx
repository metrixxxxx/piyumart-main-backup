"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getSocket } from "@/lib/socket";
import ConfirmModal from "@/components/ui/ConfirmModal";

function StatCard({ label, value, accent }) {
  return (
    <div className="bg-white dark:bg-[#0e1520] rounded-2xl border border-[#c5cfe8] dark:border-white/[0.07] p-4">
      <p className="text-[11px] font-semibold text-[#0e1a3d]/50 dark:text-[#e8edf8]/40 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-bold ${accent || "text-[#0e1a3d] dark:text-[#e8edf8]"}`}>{value}</p>
    </div>
  );
}

export default function MyListingsPage() {
  const { data: session } = useSession();
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [orderStats, setOrderStats] = useState({ totalOrders: 0, revenue: 0 });
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("listings");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    let mounted = true;

    const loadData = async () => {
      const [productsRes, statsRes, ordersRes, reviewsRes] = await Promise.all([
        fetch("/api/sell"),
        fetch("/api/my-listings/stats"),
        fetch("/api/seller/orders"),
        fetch("/api/seller/reviews"),
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

    loadData();

    const socket = getSocket(session.user.id);

    socket.on("products:new", (product) => {
      if (String(product.seller_id) === String(session.user.id))
        setProducts((prev) => [product, ...prev]);
    });
    socket.on("products:updated", (updated) => {
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
    });
    socket.on("products:deleted", ({ id }) => {
      setProducts((prev) => prev.filter((p) => p.id !== id));
    });
    socket.on("orders:new", (order) => {
      if (order.items?.some((i) => String(i.seller_id) === String(session.user.id))) {
        setOrders((prev) => [{ ...order, id: order.orderId, status: "pending" }, ...prev]);
      }
    });
    socket.on("orders:updated", ({ id, status, tracking_number, courier }) => {
      setOrders((prev) =>
        prev.map((o) =>
          Number(o.id) === Number(id)
            ? { ...o, status, _loading: false, ...(tracking_number && { tracking_number }), ...(courier && { courier }) }
            : o
        )
      );
    });

    return () => {
      mounted = false;
      socket.off("products:new");
      socket.off("products:updated");
      socket.off("products:deleted");
      socket.off("orders:new");
      socket.off("orders:updated");
    };
  }, [session?.user?.id]);

  async function handleOrderStatus(id, status) {
    setOrders((prev) =>
      prev.map((o) => (Number(o.id) === Number(id) ? { ...o, _loading: true } : o))
    );
    const res = await fetch(`/api/seller/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) {
      setOrders((prev) =>
        prev.map((o) => (Number(o.id) === Number(id) ? { ...o, _loading: false } : o))
      );
      return alert(data.error || "Failed to update order");
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

  if (!session)
    return (
      <div className="min-h-screen bg-[#eef2f7] dark:bg-[#070b14] flex items-center justify-center text-sm text-[#0e1a3d]/50 dark:text-[#e8edf8]/40">
        Please log in.
      </div>
    );
  if (loading)
    return (
      <div className="min-h-screen bg-[#eef2f7] dark:bg-[#070b14] flex items-center justify-center">
        <div className="w-10 h-10 border-[3px] border-[#c5cfe8] dark:border-white/10 border-t-[#1a2a6c] dark:border-t-[#c9a028] rounded-full animate-spin" />
      </div>
    );

  return (
    <main className="min-h-screen bg-[#eef2f7] dark:bg-[#070b14] transition-colors duration-300">
      <section className="bg-[#1a2a6c] dark:bg-[#0a0e1f] px-4 sm:px-5 py-10 sm:py-12 text-center">
        <div className="inline-flex items-center gap-2 bg-white/10 text-[#c9a028] text-[11px] font-bold px-4 py-1.5 rounded-full mb-4 uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-[#c9a028]" />
          Seller Dashboard
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">My Listings</h1>
        <p className="mt-2 text-sm text-white/60">Manage your products and orders</p>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-5 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard label="Total Listings" value={stats.total} />
          <StatCard label="Active" value={stats.active} accent="text-green-500" />
          <StatCard label="Total Orders" value={stats.totalOrders} />
          <StatCard label="Revenue" value={`₱${Number(stats.revenue).toLocaleString()}`} accent="text-[#1a2a6c] dark:text-[#c9a028]" />
        </div>

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
              <div className="bg-white dark:bg-[#0e1520] rounded-2xl border border-[#c5cfe8] dark:border-white/[0.07] overflow-x-auto">
                <table className="w-full min-w-[820px] text-xs">
                  <thead>
                    <tr className="border-b border-[#c5cfe8] dark:border-white/[0.07] text-[#0e1a3d]/40 dark:text-[#e8edf8]/30 uppercase tracking-wider">
                      <th className="text-left px-4 py-3">Order ID</th>
                      <th className="text-left px-4 py-3">Product</th>
                      <th className="text-left px-4 py-3">Variant</th>
                      <th className="text-left px-4 py-3">Buyer</th>
                      <th className="text-left px-4 py-3">Qty</th>
                      <th className="text-left px-4 py-3">Total</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-left px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id} className="border-b border-[#c5cfe8] dark:border-white/[0.07] hover:bg-[#f0f4ff] dark:hover:bg-white/[0.02] transition">
                        <td className="px-4 py-3 font-mono text-[#0e1a3d]/40 dark:text-[#e8edf8]/30">#{o.id}</td>
                        <td className="px-4 py-3 font-semibold text-[#0e1a3d] dark:text-[#e8edf8]">{o.product_name}   
                        </td>
                        <td className="px-4 py-3 text-[#0e1a3d]/60 dark:text-[#e8edf8]/50">
                              {o.variant || <span className="italic opacity-40">—</span>}
                                                                                 </td>
                        
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[#0e1a3d] dark:text-[#e8edf8]">{o.buyer_name}</p>
                          <p className="text-[#0e1a3d]/40 dark:text-[#e8edf8]/30">{o.buyer_email}</p>
                        </td>
                        <td className="px-4 py-3 text-[#0e1a3d]/70 dark:text-[#e8edf8]/60">{o.quantity}</td>
                        <td className="px-4 py-3 font-bold text-[#0e1a3d] dark:text-[#e8edf8]">₱{Number(o.total).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold
                            ${o.status === "pending"    ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : o.status === "confirmed"  ? "bg-[#e8edf8] dark:bg-[#1a2a6c]/10 text-[#1a2a6c] dark:text-[#c9a028]"
                            : o.status === "processing" ? "bg-blue-50 dark:bg-blue-500/10 text-blue-500"
                            : o.status === "shipped"    ? "bg-[#e8edf8] dark:bg-[#c9a028]/10 text-[#1a2a6c] dark:text-[#c9a028]"
                            : o.status === "cancelled"  ? "bg-red-50 dark:bg-red-500/10 text-red-500"
                            : "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400"}`}>
                            {o.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5 flex-wrap">
                            {o.status === "pending" && (<>
                              <button disabled={o._loading} onClick={() => handleOrderStatus(o.id, "confirmed")}
                                className="px-2 py-1 rounded-lg bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-100 transition text-[11px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
                                {o._loading ? "..." : "✅ Confirm"}
                              </button>
                              <button disabled={o._loading} onClick={() => handleOrderStatus(o.id, "cancelled")}
                                className="px-2 py-1 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 transition text-[11px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
                                {o._loading ? "..." : "❌ Cancel"}
                              </button>
                            </>)}
                            {o.status === "confirmed" && (<>
                              <button disabled={o._loading} onClick={() => handleOrderStatus(o.id, "processing")}
                                className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-500 hover:bg-blue-100 transition text-[11px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
                                {o._loading ? "..." : "📦 Process"}
                              </button>
                              <button disabled={o._loading} onClick={() => handleOrderStatus(o.id, "cancelled")}
                                className="px-2 py-1 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 transition text-[11px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
                                {o._loading ? "..." : "❌ Cancel"}
                              </button>
                            </>)}
                            {o.status === "processing" && (
                              <button disabled={o._loading} onClick={() => handleOrderStatus(o.id, "shipped")}
                                className="px-2 py-1 rounded-lg bg-[#e8edf8] dark:bg-[#c9a028]/10 text-[#1a2a6c] dark:text-[#c9a028] hover:bg-[#dbe3f6] transition text-[11px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
                                {o._loading ? "..." : "🚚 Ship"}
                              </button>
                            )}
                            {(o.status === "shipped" || o.status === "completed" || o.status === "cancelled") && (
                              <span className="text-[11px] text-[#0e1a3d]/30 dark:text-[#e8edf8]/30 italic">
                                {o.status === "shipped" ? "Awaiting buyer confirmation" : o.status === "completed" ? "Order complete" : "Cancelled"}
                              </span>
                            )}
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