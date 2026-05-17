"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { io } from "socket.io-client";

function StatCard({ label, value, accent }) {
  return (
    <div className="bg-white dark:bg-[#12121a] rounded-2xl border border-[#e8e5f0] dark:border-white/[0.07] p-4">
      <p className="text-[11px] font-semibold text-[#1a1060]/50 dark:text-[#f0ede8]/40 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-bold ${accent || "text-[#1a1060] dark:text-[#f0ede8]"}`}>{value}</p>
    </div>
  );
}

export default function MyListingsPage() {
  const { data: session } = useSession();
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderStats, setOrderStats] = useState({ totalOrders: 0, revenue: 0 });
  const [filter, setFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("listings");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    let mounted = true;
    const loadData = async () => {
      const [productsRes, statsRes, ordersRes] = await Promise.all([
        fetch("/api/sell"),
        fetch("/api/my-listings/stats"),
        fetch("/api/seller/orders"),
      ]);
      const productsData = await productsRes.json();
      const statsData = await statsRes.json();
      const ordersData = await ordersRes.json();
      if (mounted) {
        setProducts(Array.isArray(productsData) ? productsData : []);
        setOrderStats(statsData);
        setOrders(Array.isArray(ordersData) ? ordersData : []);
        setLoading(false);
      }
    };
    loadData();
    const socket = io();
    socket.on("products:new", (product) => {
      if (String(product.seller_id) === String(session.user.id)) setProducts((prev) => [product, ...prev]);
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
    return () => { mounted = false; socket.disconnect(); };
  }, [session?.user?.id]);

  async function handleOrderStatus(id, status) {
    await fetch(`/api/seller/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
  }

  async function handleDelete(id) {
    if (!confirm("Delete this listing?")) return;
    await fetch(`/api/my-listings/${id}`, { method: "DELETE" });
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  async function toggleVisibility(id, current) {
    await fetch(`/api/my-listings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_visible: current ? 0 : 1 }) });
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, is_visible: current ? 0 : 1 } : p)));
  }

  const stats = { total: products.length, active: products.filter((p) => p.is_visible === 1).length, totalOrders: orderStats.totalOrders, revenue: orderStats.revenue };
  const filtered = filter === "all" ? products : products.filter((p) => filter === "visible" ? p.is_visible === 1 : p.is_visible === 0);
  const pendingOrders = orders.filter((o) => o.status === "pending").length;

  if (!session) return <div className="min-h-screen bg-[#f0eeff] dark:bg-[#0a0a0f] flex items-center justify-center text-sm text-[#1a1060]/50 dark:text-[#f0ede8]/40">Please log in.</div>;
  if (loading) return (
    <div className="min-h-screen bg-[#f0eeff] dark:bg-[#0a0a0f] flex items-center justify-center">
      <div className="w-10 h-10 border-[3px] border-[#e8e5f0] dark:border-white/10 border-t-[#6d4aff] dark:border-t-[#c9a96e] rounded-full animate-spin" />
    </div>
  );

  return (
    <main className="min-h-screen bg-[#f0eeff] dark:bg-[#0a0a0f] transition-colors duration-300">

      {/* HERO */}
      <section className="bg-white dark:bg-[#0a0a0f] border-b border-[#e8e5f0] dark:border-white/[0.07] px-5 py-12 text-center">
        <div className="inline-flex items-center gap-2 bg-[#ede9ff] dark:bg-[#c9a96e]/10 text-[#6d4aff] dark:text-[#c9a96e] text-[11px] font-bold px-4 py-1.5 rounded-full mb-4 uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-[#6d4aff] dark:bg-[#c9a96e]" />
          Seller Dashboard
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#1a1060] dark:text-[#f0ede8]">My Listings</h1>
        <p className="mt-2 text-sm text-[#1a1060]/50 dark:text-[#f0ede8]/45">Manage your products and orders</p>
      </section>

      <div className="max-w-5xl mx-auto px-5 py-8">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard label="Total Listings" value={stats.total} />
          <StatCard label="Active" value={stats.active} accent="text-green-500" />
          <StatCard label="Total Orders" value={stats.totalOrders} />
          <StatCard label="Revenue" value={`₱${Number(stats.revenue).toLocaleString()}`} accent="text-[#6d4aff] dark:text-[#c9a96e]" />
        </div>

        {/* Add Product */}
        <div className="flex justify-end mb-5">
          <Link href="/sell" className="bg-[#6d4aff] dark:bg-[#c9a96e] text-white dark:text-[#0a0a0f] text-xs font-bold px-4 py-2 rounded-xl hover:opacity-90 transition">
            + Add Product
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-[#e8e5f0] dark:border-white/[0.07]">
          <button
            onClick={() => setActiveTab("listings")}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 -mb-px transition
              ${activeTab === "listings" ? "border-[#6d4aff] dark:border-[#c9a96e] text-[#6d4aff] dark:text-[#c9a96e]" : "border-transparent text-[#1a1060]/50 dark:text-[#f0ede8]/40 hover:text-[#1a1060] dark:hover:text-[#f0ede8]"}`}
          >
            Listings
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 -mb-px flex items-center gap-2 transition
              ${activeTab === "orders" ? "border-[#6d4aff] dark:border-[#c9a96e] text-[#6d4aff] dark:text-[#c9a96e]" : "border-transparent text-[#1a1060]/50 dark:text-[#f0ede8]/40 hover:text-[#1a1060] dark:hover:text-[#f0ede8]"}`}
          >
            Orders
            {pendingOrders > 0 && (
              <span className="text-[10px] bg-amber-400 text-black px-1.5 py-0.5 rounded-full font-bold">{pendingOrders}</span>
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
                    ${filter === f
                      ? "bg-[#6d4aff] dark:bg-[#c9a96e] text-white dark:text-[#0a0a0f] font-bold"
                      : "bg-white dark:bg-white/[0.04] border border-[#e8e5f0] dark:border-white/[0.07] text-[#1a1060]/60 dark:text-[#f0ede8]/50 hover:border-[#6d4aff] dark:hover:border-[#c9a96e]"}`}>
                  {f}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-16 text-sm text-[#1a1060]/50 dark:text-[#f0ede8]/40">
                No listings found.{" "}
                <Link href="/sell" className="text-[#6d4aff] dark:text-[#c9a96e] hover:underline">Sell something</Link>
              </div>
            ) : (
              <div className="bg-white dark:bg-[#12121a] rounded-2xl border border-[#e8e5f0] dark:border-white/[0.07] overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#e8e5f0] dark:border-white/[0.07] text-[#1a1060]/40 dark:text-[#f0ede8]/30 uppercase tracking-wider">
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
                      <tr key={p.id} className="border-b border-[#e8e5f0] dark:border-white/[0.07] hover:bg-[#f5f3ff] dark:hover:bg-white/[0.02] transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {p.image_url && <Image src={p.image_url} alt={p.name} width={36} height={36} className="rounded-lg object-cover w-9 h-9 border border-[#e8e5f0] dark:border-white/[0.07]" />}
                            <span className="font-semibold text-[#1a1060] dark:text-[#f0ede8]">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#1a1060]/70 dark:text-[#f0ede8]/60">₱{Number(p.price).toLocaleString()}</td>
                        <td className="px-4 py-3 text-[#1a1060]/70 dark:text-[#f0ede8]/60">{p.stock}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold
                            ${p.is_visible ? "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400" : "bg-[#f5f3ff] dark:bg-white/[0.04] text-[#1a1060]/40 dark:text-[#f0ede8]/30"}`}>
                            {p.is_visible ? "Visible" : "Hidden"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#1a1060]/40 dark:text-[#f0ede8]/30">{new Date(p.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => toggleVisibility(p.id, p.is_visible)}
                              className="px-2.5 py-1 rounded-lg bg-[#f5f3ff] dark:bg-white/[0.04] text-[#6d4aff] dark:text-[#c9a96e] hover:bg-[#ede9ff] dark:hover:bg-white/[0.08] transition text-[11px] font-semibold">
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
              <div className="text-center py-16 text-sm text-[#1a1060]/50 dark:text-[#f0ede8]/40">No orders yet.</div>
            ) : (
              <div className="bg-white dark:bg-[#12121a] rounded-2xl border border-[#e8e5f0] dark:border-white/[0.07] overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#e8e5f0] dark:border-white/[0.07] text-[#1a1060]/40 dark:text-[#f0ede8]/30 uppercase tracking-wider">
                      <th className="text-left px-4 py-3">Order ID</th>
                      <th className="text-left px-4 py-3">Product</th>
                      <th className="text-left px-4 py-3">Buyer</th>
                      <th className="text-left px-4 py-3">Qty</th>
                      <th className="text-left px-4 py-3">Total</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-left px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id} className="border-b border-[#e8e5f0] dark:border-white/[0.07] hover:bg-[#f5f3ff] dark:hover:bg-white/[0.02] transition">
                        <td className="px-4 py-3 font-mono text-[#1a1060]/40 dark:text-[#f0ede8]/30">#{o.id}</td>
                        <td className="px-4 py-3 font-semibold text-[#1a1060] dark:text-[#f0ede8]">{o.product_name}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[#1a1060] dark:text-[#f0ede8]">{o.buyer_name}</p>
                          <p className="text-[#1a1060]/40 dark:text-[#f0ede8]/30">{o.buyer_email}</p>
                        </td>
                        <td className="px-4 py-3 text-[#1a1060]/70 dark:text-[#f0ede8]/60">{o.quantity}</td>
                        <td className="px-4 py-3 font-bold text-[#1a1060] dark:text-[#f0ede8]">₱{Number(o.total).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold
                            ${o.status === "pending"   ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : o.status === "confirmed" ? "bg-[#ede9ff] dark:bg-[#6d4aff]/10 text-[#6d4aff] dark:text-[#c9a96e]"
                            : o.status === "rejected"  ? "bg-red-50 dark:bg-red-500/10 text-red-500"
                            : o.status === "shipped"   ? "bg-purple-50 dark:bg-purple-500/10 text-purple-500"
                            : "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400"}`}>
                            {o.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5 flex-wrap">
                            {o.status === "pending" && (<>
                              <button onClick={() => handleOrderStatus(o.id, "confirmed")} className="px-2 py-1 rounded-lg bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-100 transition text-[11px] font-semibold">✅ Confirm</button>
                              <button onClick={() => handleOrderStatus(o.id, "rejected")} className="px-2 py-1 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 transition text-[11px] font-semibold">❌ Reject</button>
                            </>)}
                            {o.status === "confirmed" && <button onClick={() => handleOrderStatus(o.id, "shipped")} className="px-2 py-1 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-500 hover:bg-purple-100 transition text-[11px] font-semibold">🚚 Ship</button>}
                            {o.status === "shipped" && <button onClick={() => handleOrderStatus(o.id, "completed")} className="px-2 py-1 rounded-lg bg-[#ede9ff] dark:bg-[#6d4aff]/10 text-[#6d4aff] dark:text-[#c9a96e] hover:bg-[#e0dbff] transition text-[11px] font-semibold">✔ Complete</button>}
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
      </div>
    </main>
  );
}