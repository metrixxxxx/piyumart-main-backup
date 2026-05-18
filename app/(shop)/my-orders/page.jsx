"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";

const STATUS_CONFIG = {
  pending:    { label: "Pending",    bg: "bg-amber-50 dark:bg-amber-500/10",    text: "text-amber-600 dark:text-amber-400",    dot: "bg-amber-400",  pulse: true  },
  confirmed:  { label: "Confirmed",  bg: "bg-[#ede9ff] dark:bg-[#6d4aff]/10",   text: "text-[#6d4aff] dark:text-[#c9a96e]",   dot: "bg-[#6d4aff] dark:bg-[#c9a96e]", pulse: false },
  processing: { label: "Processing", bg: "bg-blue-50 dark:bg-blue-500/10",       text: "text-blue-600 dark:text-blue-400",       dot: "bg-blue-500",   pulse: true  },
  shipped:    { label: "Shipped",    bg: "bg-purple-50 dark:bg-purple-500/10",   text: "text-purple-600 dark:text-purple-400",   dot: "bg-purple-500", pulse: false },
  completed:  { label: "Completed",  bg: "bg-green-50 dark:bg-green-500/10",     text: "text-green-600 dark:text-green-400",     dot: "bg-green-500",  pulse: false },
  cancelled:  { label: "Cancelled",  bg: "bg-red-50 dark:bg-red-500/10",         text: "text-red-500",                           dot: "bg-red-400",    pulse: false },
};

const ORDER_STEPS = ["pending", "confirmed", "processing", "shipped", "completed"];

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, bg: "bg-[#f5f3ff] dark:bg-white/[0.04]", text: "text-[#1a1060]/50 dark:text-[#f0ede8]/40", dot: "bg-gray-400", pulse: false };
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        {cfg.pulse && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${cfg.dot}`} />}
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${cfg.dot}`} />
      </span>
      {cfg.label}
    </span>
  );
}

function OrderProgress({ status }) {
  if (status === "cancelled") return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-500/10">
      <span className="text-xs text-red-500 font-semibold">❌ This order was cancelled</span>
    </div>
  );
  const current = ORDER_STEPS.indexOf(status);
  return (
    <div>
      <p className="text-[10px] font-semibold text-[#1a1060]/40 dark:text-[#f0ede8]/30 uppercase tracking-wider mb-2">Order Progress</p>
      <div className="flex items-center gap-0">
        {ORDER_STEPS.map((step, i) => (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors ${
              i < current    ? "bg-[#6d4aff] dark:bg-[#c9a96e] text-white dark:text-[#0a0a0f]"
              : i === current ? "bg-[#6d4aff] dark:bg-[#c9a96e] text-white dark:text-[#0a0a0f] ring-4 ring-[#6d4aff]/20 dark:ring-[#c9a96e]/20"
              : "bg-[#e8e5f0] dark:bg-white/[0.07] text-[#1a1060]/30 dark:text-[#f0ede8]/30"
            }`}>
              {i < current ? "✓" : i + 1}
            </div>
            {i < ORDER_STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-0.5 transition-colors ${i < current ? "bg-[#6d4aff] dark:bg-[#c9a96e]" : "bg-[#e8e5f0] dark:bg-white/[0.07]"}`} />
            )}
          </div>
        ))}
      </div>
      <div className="flex mt-1">
        {ORDER_STEPS.map((step, i) => (
          <div key={step} className="flex-1 text-center last:flex-none">
            <p className={`text-[9px] capitalize ${i <= current ? "text-[#1a1060] dark:text-[#f0ede8] font-semibold" : "text-[#1a1060]/30 dark:text-[#f0ede8]/30"}`}>
              {step}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderCard({ order, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const items = (() => {
    try { return typeof order.items === "string" ? JSON.parse(order.items) : (order.items || []); }
    catch { return []; }
  })();

  const date = order.created_at
    ? new Date(order.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  async function handleAction(action) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // update handled by socket, but fallback just in case
      onUpdate(order.id, data.status);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="bg-white dark:bg-[#12121a] rounded-2xl border border-[#e8e5f0] dark:border-white/[0.07] overflow-hidden">
      <div
        className={`px-5 py-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-[#f5f3ff] dark:hover:bg-white/[0.02] transition ${expanded ? "border-b border-[#e8e5f0] dark:border-white/[0.07]" : ""}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {items[0]?.image_url ? (
            <img src={items[0].image_url} alt={items[0].name} className="w-10 h-10 rounded-xl object-cover shrink-0 border border-[#e8e5f0] dark:border-white/[0.07]" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-[#f5f3ff] dark:bg-white/[0.04] flex items-center justify-center text-lg shrink-0">🛍️</div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-[#1a1060] dark:text-[#f0ede8]">Order #{order.id}</span>
              <StatusBadge status={order.status} />
            </div>
            {date && <p className="text-[11px] text-[#1a1060]/40 dark:text-[#f0ede8]/30 mt-0.5">{date}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-bold text-sm text-[#1a1060] dark:text-[#f0ede8]">₱{Number(order.total).toLocaleString()}</span>
          <span className={`text-[#1a1060]/30 dark:text-[#f0ede8]/30 text-xs transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>▼</span>
        </div>
      </div>

      {expanded && (
        <div className="px-5 py-4 flex flex-col gap-4">
          <OrderProgress status={order.status} />

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Recipient", value: order.name },
              { label: "Email", value: order.email },
              { label: "Payment", value: order.payment_method === "cod" ? "💵 Cash on Delivery" : order.payment_method },
              { label: "Address", value: order.address },
             { label: "Seller", value: [...new Set(items.map(i => i.seller_name))].join(", ") },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[#f5f3ff] dark:bg-white/[0.04] rounded-xl p-3">
                <p className="text-[10px] font-semibold text-[#1a1060]/40 dark:text-[#f0ede8]/30 uppercase tracking-wider mb-1">{label}</p>
                <p className="text-xs font-semibold text-[#1a1060] dark:text-[#f0ede8] break-words">{value || "—"}</p>
              </div>
            ))}
          </div>

          {order.tracking_number && (
            <div className="bg-purple-50 dark:bg-purple-500/10 rounded-xl p-3">
              <p className="text-[10px] font-semibold text-purple-500 uppercase tracking-wider mb-1">📦 Shipping Info</p>
              <p className="text-xs font-semibold text-[#1a1060] dark:text-[#f0ede8]">
                {order.courier && <span>{order.courier} · </span>}
                {order.tracking_number}
              </p>
            </div>
          )}

          {items.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-[#1a1060]/40 dark:text-[#f0ede8]/30 uppercase tracking-wider mb-2">Items Ordered</p>
              <div className="flex flex-col gap-2">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-[#f5f3ff] dark:bg-white/[0.04] rounded-xl p-3">
                    <img
                      src={item.image_url || "/placeholder.png"}
                      alt={item.name || "Product"}
                      onError={(e) => { e.target.src = "https://placehold.co/52x52?text=?"; }}
                      className="w-12 h-12 rounded-xl object-cover shrink-0 border border-[#e8e5f0] dark:border-white/[0.07]"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#1a1060] dark:text-[#f0ede8] truncate">{item.name || `Product #${item.product_id}`}</p>
                      <p className="text-[11px] text-[#1a1060]/40 dark:text-[#f0ede8]/30">Qty: {item.quantity} × ₱{Number(item.price).toLocaleString()}</p>
                    </div>
                    <p className="font-bold text-xs text-[#1a1060] dark:text-[#f0ede8] shrink-0">₱{(item.quantity * item.price).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center border-t border-[#e8e5f0] dark:border-white/[0.07] pt-3">
            <span className="text-xs font-semibold text-[#1a1060]/50 dark:text-[#f0ede8]/40">Order Total</span>
            <span className="text-base font-bold text-[#6d4aff] dark:text-[#c9a96e]">₱{Number(order.total).toLocaleString()}</span>
          </div>

          <div className="flex gap-2">
            {order.status === "shipped" && (
              <button disabled={actionLoading} onClick={() => handleAction("confirm_delivery")}
                className="flex-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-xs font-bold transition disabled:opacity-50">
                {actionLoading ? "..." : "✅ I Received My Order"}
              </button>
            )}
            {order.status === "pending" && (
              <button disabled={actionLoading}
                onClick={() => { if (confirm("Cancel this order?")) handleAction("cancel"); }}
                className="flex-1 py-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 border border-red-200 dark:border-red-500/20 text-xs font-bold hover:bg-red-100 dark:hover:bg-red-500/20 transition disabled:opacity-50">
                {actionLoading ? "..." : "Cancel Order"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  function handleOrderUpdate(id, newStatus) {
    setOrders((prev) =>
      prev.map((o) => Number(o.id) === Number(id) ? { ...o, status: newStatus } : o)
    );
  }

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status !== "authenticated") return;

    fetch("/api/orders")
      .then((r) => r.json())
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));

    // ✅ FIX: pass userId para ma-join ang room
    const socket = getSocket(session.user.id);

    // ✅ FIX: Number() comparison + tracking_number/courier update
    socket.on("orders:updated", ({ id, status, tracking_number, courier }) => {
      setOrders((prev) =>
        prev.map((o) =>
          Number(o.id) === Number(id)
            ? { ...o, status, ...(tracking_number && { tracking_number }), ...(courier && { courier }) }
            : o
        )
      );
    });

    return () => socket.off("orders:updated");
  }, [status, session?.user?.id]);

  if (status === "loading" || loading) return (
    <div className="min-h-screen bg-[#f0eeff] dark:bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-[3px] border-[#e8e5f0] dark:border-white/10 border-t-[#6d4aff] dark:border-t-[#c9a96e] rounded-full mx-auto mb-4 animate-spin" />
        <p className="text-sm text-[#1a1060]/50 dark:text-[#f0ede8]/40">Loading orders...</p>
      </div>
    </div>
  );

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);
  const statusCounts = orders.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {});

  return (
    <main className="min-h-screen bg-[#f0eeff] dark:bg-[#0a0a0f] transition-colors duration-300">
      <section className="bg-white dark:bg-[#0a0a0f] border-b border-[#e8e5f0] dark:border-white/[0.07] px-5 py-12 text-center">
        <div className="inline-flex items-center gap-2 bg-[#ede9ff] dark:bg-[#c9a96e]/10 text-[#6d4aff] dark:text-[#c9a96e] text-[11px] font-bold px-4 py-1.5 rounded-full mb-4 uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-[#6d4aff] dark:bg-[#c9a96e]" />
          Order History
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#1a1060] dark:text-[#f0ede8]">My Orders</h1>
        <p className="mt-2 text-sm text-[#1a1060]/50 dark:text-[#f0ede8]/45">
          {orders.length === 0 ? "No orders yet" : `${orders.length} order${orders.length > 1 ? "s" : ""} total`}
        </p>
      </section>

      <section className="max-w-[900px] mx-auto px-5 py-8">
        {orders.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-[#12121a] rounded-2xl border border-[#e8e5f0] dark:border-white/[0.07]">
            <div className="text-5xl mb-4">📦</div>
            <h2 className="text-lg font-bold text-[#1a1060] dark:text-[#f0ede8] mb-2">No orders yet</h2>
            <p className="text-sm text-[#1a1060]/50 dark:text-[#f0ede8]/40 mb-6">Your completed purchases will appear here</p>
            <button onClick={() => router.push("/products")}
              className="bg-[#6d4aff] dark:bg-[#c9a96e] text-white dark:text-[#0a0a0f] px-6 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition">
              Browse Products
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2 flex-wrap mb-5">
              <button onClick={() => setFilter("all")}
                className={`px-4 py-1.5 rounded-full border text-xs font-semibold transition
                  ${filter === "all" ? "bg-[#6d4aff] dark:bg-[#c9a96e] border-[#6d4aff] dark:border-[#c9a96e] text-white dark:text-[#0a0a0f]" : "bg-white dark:bg-white/[0.04] border-[#e8e5f0] dark:border-white/[0.07] text-[#1a1060]/60 dark:text-[#f0ede8]/50 hover:border-[#6d4aff] dark:hover:border-[#c9a96e]"}`}>
                All ({orders.length})
              </button>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                const count = statusCounts[key] || 0;
                const isActive = filter === key;
                return (
                  <button key={key} onClick={() => setFilter(key)} disabled={count === 0}
                    className={`px-4 py-1.5 rounded-full border text-xs font-semibold transition
                      ${isActive ? `${cfg.bg} ${cfg.text} border-transparent` : "bg-white dark:bg-white/[0.04] border-[#e8e5f0] dark:border-white/[0.07] text-[#1a1060]/60 dark:text-[#f0ede8]/50"}
                      ${count === 0 ? "opacity-40 cursor-default" : "hover:border-[#6d4aff] dark:hover:border-[#c9a96e] cursor-pointer"}`}>
                    {cfg.label}{count > 0 && ` (${count})`}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-3">
              {filtered.length === 0
                ? <p className="text-sm text-[#1a1060]/50 dark:text-[#f0ede8]/40 text-center py-10">No {filter} orders.</p>
                : filtered.map((order) => (
                    <OrderCard key={order.id} order={order} onUpdate={handleOrderUpdate} />
                  ))
              }
            </div>
          </>
        )}
      </section>
    </main>
  );
}