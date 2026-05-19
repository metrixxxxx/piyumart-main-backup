"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import ConfirmModal from "@/components/ui/ConfirmModal";
import OrderItemReviewBtn from "@/components/orders/OrderItemReviewBtn";

const STATUS_CONFIG = {
  pending:    { label: "Pending",    bg: "bg-amber-50 dark:bg-amber-500/10",    text: "text-amber-600 dark:text-amber-400",    dot: "bg-amber-400",  pulse: true  },
  confirmed:  { label: "Confirmed",  bg: "bg-[#e8edf8] dark:bg-[#c9a028]/10",   text: "text-[#1a2a6c] dark:text-[#c9a028]",   dot: "bg-[#1a2a6c] dark:bg-[#c9a028]", pulse: false },
  processing: { label: "Processing", bg: "bg-blue-50 dark:bg-blue-500/10",       text: "text-blue-600 dark:text-blue-400",       dot: "bg-blue-500",   pulse: true  },
  shipped:    { label: "Shipped",    bg: "bg-[#e8edf8] dark:bg-[#c9a028]/10",   text: "text-[#1a2a6c] dark:text-[#c9a028]",   dot: "bg-[#c9a028]", pulse: false },
  completed:  { label: "Completed",  bg: "bg-green-50 dark:bg-green-500/10",     text: "text-green-600 dark:text-green-400",     dot: "bg-green-500",  pulse: false },
  cancelled:  { label: "Cancelled",  bg: "bg-red-50 dark:bg-red-500/10",         text: "text-red-500",                           dot: "bg-red-400",    pulse: false },
};

const ORDER_STEPS = ["pending", "confirmed", "processing", "shipped", "completed"];

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, bg: "bg-[#e8edf8] dark:bg-white/[0.04]", text: "text-[#0e1a3d]/50 dark:text-[#e8edf8]/40", dot: "bg-gray-400", pulse: false };
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
      <p className="text-[10px] font-semibold text-[#0e1a3d]/40 dark:text-[#e8edf8]/30 uppercase tracking-wider mb-2">Order Progress</p>
      <div className="flex items-center gap-0">
        {ORDER_STEPS.map((step, i) => (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors ${
              i < current    ? "bg-[#1a2a6c] dark:bg-[#c9a028] text-white dark:text-[#070b14]"
              : i === current ? "bg-[#1a2a6c] dark:bg-[#c9a028] text-white dark:text-[#070b14] ring-4 ring-[#1a2a6c]/20 dark:ring-[#c9a028]/20"
              : "bg-[#e8edf8] dark:bg-white/[0.07] text-[#0e1a3d]/30 dark:text-[#e8edf8]/30"
            }`}>
              {i < current ? "✓" : i + 1}
            </div>
            {i < ORDER_STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-0.5 transition-colors ${i < current ? "bg-[#1a2a6c] dark:bg-[#c9a028]" : "bg-[#e8edf8] dark:bg-white/[0.07]"}`} />
            )}
          </div>
        ))}
      </div>
      <div className="flex mt-1">
        {ORDER_STEPS.map((step, i) => (
          <div key={step} className="flex-1 text-center last:flex-none">
            <p className={`text-[9px] capitalize ${i <= current ? "text-[#0e1a3d] dark:text-[#e8edf8] font-semibold" : "text-[#0e1a3d]/30 dark:text-[#e8edf8]/30"}`}>
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
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

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
    <div className="bg-white dark:bg-[#0e1520] rounded-2xl border border-[#c5cfe8] dark:border-white/[0.07] overflow-hidden">
      <div
        className={`px-4 sm:px-5 py-4 flex flex-col gap-3 cursor-pointer hover:bg-[#f0f4ff] dark:hover:bg-white/[0.02] transition sm:flex-row sm:items-center sm:justify-between ${expanded ? "border-b border-[#c5cfe8] dark:border-white/[0.07]" : ""}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {items[0]?.image_url ? (
            <img src={items[0].image_url} alt={items[0].name} className="w-10 h-10 rounded-xl object-cover shrink-0 border border-[#c5cfe8] dark:border-white/[0.07]" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-[#f0f4ff] dark:bg-white/[0.04] flex items-center justify-center text-lg shrink-0">🛍️</div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-[#0e1a3d] dark:text-[#e8edf8]">Order #{order.id}</span>
              <StatusBadge status={order.status} />
            </div>
            {date && <p className="text-[11px] text-[#0e1a3d]/40 dark:text-[#e8edf8]/30 mt-0.5">{date}</p>}
          </div>
        </div>
        <div className="flex w-full items-center justify-between gap-3 shrink-0 sm:w-auto sm:justify-start">
          <span className="font-bold text-sm text-[#0e1a3d] dark:text-[#e8edf8]">₱{Number(order.total).toLocaleString()}</span>
          <span className={`text-[#0e1a3d]/30 dark:text-[#e8edf8]/30 text-xs transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>▼</span>
        </div>
      </div>

      {expanded && (
        <div className="px-4 sm:px-5 py-4 flex flex-col gap-4">
          <OrderProgress status={order.status} />

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { label: "Recipient", value: order.name },
              { label: "Email", value: order.email },
              { label: "Payment", value: order.payment_method === "cod" ? "💵 Cash on Delivery" : order.payment_method },
              { label: "Address", value: order.address },
             { label: "Seller", value: [...new Set(items.map(i => i.seller_name))].join(", ") },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[#f0f4ff] dark:bg-white/[0.04] rounded-xl p-3">
                <p className="text-[10px] font-semibold text-[#0e1a3d]/40 dark:text-[#e8edf8]/30 uppercase tracking-wider mb-1">{label}</p>
                <p className="text-xs font-semibold text-[#0e1a3d] dark:text-[#e8edf8] break-words">{value || "—"}</p>
              </div>
            ))}
          </div>

          {order.tracking_number && (
            <div className="bg-[#e8edf8] dark:bg-[#c9a028]/10 rounded-xl p-3">
              <p className="text-[10px] font-semibold text-[#1a2a6c] dark:text-[#c9a028] uppercase tracking-wider mb-1">📦 Shipping Info</p>
              <p className="text-xs font-semibold text-[#0e1a3d] dark:text-[#e8edf8]">
                {order.courier && <span>{order.courier} · </span>}
                {order.tracking_number}
              </p>
            </div>
          )}

          {items.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-[#0e1a3d]/40 dark:text-[#e8edf8]/30 uppercase tracking-wider mb-2">Items Ordered</p>
              <div className="flex flex-col gap-2">
                {items.map((item, idx) => (
                  <div key={idx} className="flex flex-col gap-3 bg-[#f0f4ff] dark:bg-white/[0.04] rounded-xl p-3 justify-between sm:flex-row sm:items-center">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <img
                        src={item.image_url || "/placeholder.png"}
                        alt={item.name || "Product"}
                        onError={(e) => { e.target.src = "https://placehold.co/52x52?text=?"; }}
                        className="w-12 h-12 rounded-xl object-cover shrink-0 border border-[#c5cfe8] dark:border-white/[0.07]"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#0e1a3d] dark:text-[#e8edf8] truncate">{item.name || `Product #${item.product_id}`}</p>
                        <p className="text-[11px] text-[#0e1a3d]/40 dark:text-[#e8edf8]/30">Qty: {item.quantity} × ₱{Number(item.price).toLocaleString()}</p>
                      </div>
                      <p className="font-bold text-xs text-[#0e1a3d] dark:text-[#e8edf8] shrink-0">₱{(item.quantity * item.price).toLocaleString()}</p>
                    </div>
                    {order.status === "completed" && (
                      <OrderItemReviewBtn
                        productId={item.product_id}
                        productName={item.name || `Product #${item.product_id}`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center border-t border-[#c5cfe8] dark:border-white/[0.07] pt-3">
            <span className="text-xs font-semibold text-[#0e1a3d]/50 dark:text-[#e8edf8]/40">Order Total</span>
            <span className="text-base font-bold text-[#1a2a6c] dark:text-[#c9a028]">₱{Number(order.total).toLocaleString()}</span>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {order.status === "shipped" && (
              <button disabled={actionLoading} onClick={() => handleAction("confirm_delivery")}
                className="flex-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-xs font-bold transition disabled:opacity-50">
                {actionLoading ? "..." : "✅ I Received My Order"}
              </button>
            )}
            {order.status === "pending" && (
              <>
                <button disabled={actionLoading}
                  onClick={() => setConfirmCancelOpen(true)}
                  className="flex-1 py-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 border border-red-200 dark:border-red-500/20 text-xs font-bold hover:bg-red-100 dark:hover:bg-red-500/20 transition disabled:opacity-50">
                  {actionLoading ? "..." : "Cancel Order"}
                </button>
                <ConfirmModal
                  open={confirmCancelOpen}
                  title="Cancel this order?"
                  description="This will cancel the order and restore stock for the items."
                  confirmText="Yes, cancel order"
                  cancelText="Keep order"
                  loading={actionLoading}
                  onCancel={() => setConfirmCancelOpen(false)}
                  onConfirm={() => {
                    setConfirmCancelOpen(false);
                    handleAction("cancel");
                  }}
                />
              </>
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
    <div className="min-h-screen bg-[#eef2f7] dark:bg-[#070b14] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-[3px] border-[#c5cfe8] dark:border-white/10 border-t-[#1a2a6c] dark:border-t-[#c9a028] rounded-full mx-auto mb-4 animate-spin" />
        <p className="text-sm text-[#0e1a3d]/50 dark:text-[#e8edf8]/40">Loading orders...</p>
      </div>
    </div>
  );

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);
  const statusCounts = orders.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {});

  return (
    <main className="min-h-screen bg-[#eef2f7] dark:bg-[#070b14] transition-colors duration-300">
      <section className="bg-[#1a2a6c] dark:bg-[#0a0e1f] px-4 sm:px-5 py-10 sm:py-12 text-center">
        <div className="inline-flex items-center gap-2 bg-white/10 text-[#c9a028] text-[11px] font-bold px-4 py-1.5 rounded-full mb-4 uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-[#c9a028]" />
          Order History
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">My Orders</h1>
        <p className="mt-2 text-sm text-white/60">
          {orders.length === 0 ? "No orders yet" : `${orders.length} order${orders.length > 1 ? "s" : ""} total`}
        </p>
      </section>

      <section className="max-w-[900px] mx-auto px-4 sm:px-5 py-8">
        {orders.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-[#0e1520] rounded-2xl border border-[#c5cfe8] dark:border-white/[0.07]">
            <div className="text-5xl mb-4">📦</div>
            <h2 className="text-lg font-bold text-[#0e1a3d] dark:text-[#e8edf8] mb-2">No orders yet</h2>
            <p className="text-sm text-[#0e1a3d]/50 dark:text-[#e8edf8]/40 mb-6">Your completed purchases will appear here</p>
            <button onClick={() => router.push("/products")}
              className="bg-[#1a2a6c] text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-[#142060] transition">
              Browse Products
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2 flex-wrap mb-5">
              <button onClick={() => setFilter("all")}
                className={`px-4 py-1.5 rounded-full border text-xs font-semibold transition
                  ${filter === "all" ? "bg-[#1a2a6c] border-[#1a2a6c] text-white" : "bg-white dark:bg-white/[0.04] border-[#c5cfe8] dark:border-white/[0.07] text-[#0e1a3d]/60 dark:text-[#e8edf8]/50 hover:border-[#1a2a6c] dark:hover:border-[#c9a028]"}`}>
                All ({orders.length})
              </button>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                const count = statusCounts[key] || 0;
                const isActive = filter === key;
                return (
                  <button key={key} onClick={() => setFilter(key)} disabled={count === 0}
                    className={`px-4 py-1.5 rounded-full border text-xs font-semibold transition
                      ${isActive ? `${cfg.bg} ${cfg.text} border-transparent` : "bg-white dark:bg-white/[0.04] border-[#c5cfe8] dark:border-white/[0.07] text-[#0e1a3d]/60 dark:text-[#e8edf8]/50"}
                      ${count === 0 ? "opacity-40 cursor-default" : "hover:border-[#1a2a6c] dark:hover:border-[#c9a028] cursor-pointer"}`}>
                    {cfg.label}{count > 0 && ` (${count})`}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-3">
              {filtered.length === 0
                ? <p className="text-sm text-[#0e1a3d]/50 dark:text-[#e8edf8]/40 text-center py-10">No {filter} orders.</p>
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
