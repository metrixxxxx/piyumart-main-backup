"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ConfirmModal from "@/components/ui/ConfirmModal";
import OrderItemReviewBtn from "@/components/orders/OrderItemReviewBtn";

const STATUS_CONFIG = {
  pending:    { label: "Pending",    color: "text-amber-600 dark:text-amber-400",    bg: "bg-amber-50 dark:bg-amber-500/10",    dot: "bg-amber-400",                              pulse: true  },
  confirmed:  { label: "Confirmed",  color: "text-[#1a2a6c] dark:text-[#c9a028]",   bg: "bg-[#e8edf8] dark:bg-[#c9a028]/10",   dot: "bg-[#1a2a6c] dark:bg-[#c9a028]",           pulse: false },
  processing: { label: "Processing", color: "text-blue-600 dark:text-blue-400",      bg: "bg-blue-50 dark:bg-blue-500/10",       dot: "bg-blue-500",                               pulse: true  },
  shipped:    { label: "To Receive", color: "text-[#1a2a6c] dark:text-[#c9a028]",   bg: "bg-[#e8edf8] dark:bg-[#c9a028]/10",   dot: "bg-[#c9a028]",                              pulse: true  },
  completed:  { label: "Completed",  color: "text-green-600 dark:text-green-400",    bg: "bg-green-50 dark:bg-green-500/10",     dot: "bg-green-500",                              pulse: false },
  cancelled:  { label: "Cancelled",  color: "text-red-500",                          bg: "bg-red-50 dark:bg-red-500/10",         dot: "bg-red-400",                                pulse: false },
};

const ORDER_STEPS = ["pending", "confirmed", "processing", "shipped", "completed"];
const STEP_LABELS = ["Pending", "Confirmed", "Processing", "Shipped", "Completed"];

const DELETABLE_STATUSES = ["cancelled", "completed"];

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: "text-[#0e1a3d]/50 dark:text-[#e8edf8]/40", bg: "bg-[#e8edf8] dark:bg-white/[0.04]", dot: "bg-gray-400", pulse: false };
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-sm ${cfg.bg} ${cfg.color}`}>
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
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-sm bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20">
      <span className="text-xs text-red-500 font-semibold">This order was cancelled</span>
    </div>
  );
  const current = ORDER_STEPS.indexOf(status);
  return (
    <div className="py-1">
      <div className="flex items-center">
        {ORDER_STEPS.map((step, i) => (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors
                ${i < current  ? "bg-[#1a2a6c] dark:bg-[#c9a028] text-white dark:text-[#070b14]"
                : i === current ? "bg-[#1a2a6c] dark:bg-[#c9a028] text-white dark:text-[#070b14] ring-4 ring-[#1a2a6c]/15 dark:ring-[#c9a028]/20"
                : "bg-[#e8edf8] dark:bg-white/[0.07] text-[#0e1a3d]/30 dark:text-[#e8edf8]/30"}`}>
                {i < current ? "✓" : i + 1}
              </div>
            </div>
            {i < ORDER_STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 transition-colors ${i < current ? "bg-[#1a2a6c] dark:bg-[#c9a028]" : "bg-[#e8edf8] dark:bg-white/[0.07]"}`} />
            )}
          </div>
        ))}
      </div>
      <div className="flex mt-1.5">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex-1 text-center last:flex-none">
            <p className={`text-[9px] capitalize leading-tight ${i <= current ? "text-[#0e1a3d] dark:text-[#e8edf8] font-semibold" : "text-[#0e1a3d]/30 dark:text-[#e8edf8]/30"}`}>
              {label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderCard({ order, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();

  const items = (() => {
    try { return typeof order.items === "string" ? JSON.parse(order.items) : (order.items || []); }
    catch { return []; }
  })();
 

  const sellerName = items.length > 0
    ? [...new Set(items.map(i => i.seller_name).filter(Boolean))].join(", ") || "Unknown Seller"
    : "Unknown Seller";
    const sellerId = items.length > 0 ? items[0]?.seller_id : null;

    

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
      onUpdate(order.id, data.status);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  function handleBuyAgain(item) {
    if (!session) { router.push("/login"); return; }
    const variant = item.variant ? `&variant=${encodeURIComponent(item.variant)}` : "";
    router.push(`/products/${item.product_id}?quantity=${item.quantity}${variant}`);
  }

  async function handleDelete() {
  setDeleteLoading(true);
  try {
    const res = await fetch(`/api/orders/${order.id}`, { method: "DELETE" });

    // Guard against empty body before parsing
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};

    if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
    onDelete(order.id);
  } catch (err) {
    alert(err.message);
  } finally {
    setDeleteLoading(false);
    setConfirmDeleteOpen(false);
  }
}

  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const canDelete = DELETABLE_STATUSES.includes(order.status);

  return (
    <div className="bg-white dark:bg-[#0e1520] border border-[#c5cfe8] dark:border-white/[0.07] overflow-hidden rounded-sm">

      {/* Seller bar */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#e8edf8] dark:border-white/[0.05] bg-[#f8f9ff] dark:bg-white/[0.02]">
        <div className="w-5 h-5 rounded-sm bg-[#1a2a6c] dark:bg-[#c9a028] flex items-center justify-center shrink-0">
          <svg className="w-3 h-3 text-white dark:text-[#070b14]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <span className="text-xs font-bold text-[#0e1a3d] dark:text-[#e8edf8]">{sellerName}</span>
        <button
  onClick={() => {
    if (!sellerId) return;
    router.push(`/shop/${sellerId}`);
  }}
  disabled={!sellerId}
  className={`px-4 py-2 rounded-xl border text-[13px] font-semibold transition
    ${sellerId
      ? "hover:bg-[#f5f3ff] dark:hover:bg-white/[0.04]"
      : "opacity-40 cursor-not-allowed"
    }`}
>
  View Shop
</button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-[#0e1a3d]/40 dark:text-[#e8edf8]/30 font-mono">#{order.id}</span>
          <StatusBadge status={order.status} />
          {/* Delete button — only for completed/cancelled */}
          {canDelete && (
            <button
              onClick={() => setConfirmDeleteOpen(true)}
              className="p-1 rounded-sm text-[#0e1a3d]/30 dark:text-[#e8edf8]/25 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
              title="Delete order"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Items list */}
      <div className="divide-y divide-[#f0f4ff] dark:divide-white/[0.04]">
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-3 px-4 py-3.5 items-start">
            <img
              src={item.image_url || "/placeholder.png"}
              alt={item.name || "Product"}
              onError={(e) => { e.target.src = "/placeholder.png"; }}
              className="w-16 h-16 object-cover shrink-0 border border-[#e8edf8] dark:border-white/[0.07] rounded-sm"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#0e1a3d] dark:text-[#e8edf8] line-clamp-2 leading-snug">
                {item.name || `Product #${item.product_id}`}
              </p>
              {item.variant && (
                <span className="inline-block mt-1 text-[10px] bg-[#f0f4ff] dark:bg-white/[0.06] text-[#1a2a6c] dark:text-[#c9a028] px-2 py-0.5 rounded-sm">
                  Variation: {item.variant}
                </span>
              )}
              <p className="text-[11px] text-[#0e1a3d]/40 dark:text-[#e8edf8]/30 mt-1">x{item.quantity}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs font-bold text-[#0e1a3d] dark:text-[#e8edf8]">
                ₱{(item.quantity * item.price).toLocaleString()}
              </p>
              <p className="text-[10px] text-[#0e1a3d]/35 dark:text-[#e8edf8]/30 mt-0.5">
                ₱{Number(item.price).toLocaleString()} each
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Order footer */}
      <div className="px-4 py-3 border-t border-[#e8edf8] dark:border-white/[0.07] bg-[#fafbff] dark:bg-white/[0.01]">
        <div className="flex items-center justify-end gap-2 mb-2 pb-2 border-b border-dashed border-[#e8edf8] dark:border-white/[0.07]">
          <span className="text-[11px] text-[#0e1a3d]/40 dark:text-[#e8edf8]/30">Order Status:</span>
          <span className={`text-[11px] font-bold ${cfg.color}`}>{cfg.label}</span>
        </div>
        <div className="flex items-center justify-end gap-2 mb-3">
          <span className="text-xs text-[#0e1a3d]/50 dark:text-[#e8edf8]/40">
            {items.length} item{items.length !== 1 ? "s" : ""} · Order Total:
          </span>
          <span className="text-sm font-bold text-[#1a2a6c] dark:text-[#c9a028]">
            ₱{Number(order.total).toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] text-[#0e1a3d]/40 dark:text-[#e8edf8]/30 hover:text-[#1a2a6c] dark:hover:text-[#c9a028] transition flex items-center gap-1"
          >
            {expanded ? "Hide details ▲" : "View details ▼"}
          </button>
          <div className="flex gap-2">
            {order.status === "pending" && (
              <button
                disabled={actionLoading}
                onClick={() => setConfirmCancelOpen(true)}
                className="px-3 py-1.5 text-[11px] font-semibold border border-[#c5cfe8] dark:border-white/10 text-[#0e1a3d]/60 dark:text-[#e8edf8]/50 hover:border-red-300 hover:text-red-500 transition rounded-sm disabled:opacity-50"
              >
                {actionLoading ? "..." : "Cancel Order"}
              </button>
            )}
            {order.status === "shipped" && (
              <button
                disabled={actionLoading}
                onClick={() => handleAction("confirm_delivery")}
                className="px-4 py-1.5 text-[11px] font-bold bg-[#1a2a6c] dark:bg-[#c9a028] text-white dark:text-[#070b14] hover:opacity-90 transition rounded-sm disabled:opacity-50"
              >
                {actionLoading ? "..." : "Order Received"}
              </button>
            )}
            {order.status === "completed" && (
              <button
                onClick={() => setExpanded(true)}
                className="px-4 py-1.5 text-[11px] font-bold border border-[#1a2a6c] dark:border-[#c9a028] text-[#1a2a6c] dark:text-[#c9a028] hover:bg-[#e8edf8] dark:hover:bg-[#c9a028]/10 transition rounded-sm"
              >
                Rate
              </button>
            )}
            <button
              onClick={() => handleBuyAgain(items[0])}
              disabled={!items.length}
              className="px-4 py-1.5 text-[11px] font-bold bg-[#1a2a6c] dark:bg-[#c9a028] text-white dark:text-[#070b14] hover:opacity-90 transition rounded-sm disabled:opacity-50"
            >
              Buy again
            </button>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 py-4 border-t border-[#e8edf8] dark:border-white/[0.07] flex flex-col gap-4 bg-[#f8f9ff] dark:bg-white/[0.01]">
          <div>
            <p className="text-[10px] font-semibold text-[#0e1a3d]/40 dark:text-[#e8edf8]/30 uppercase tracking-wider mb-2">Order Progress</p>
            <OrderProgress status={order.status} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              { label: "Recipient", value: order.name },
              { label: "Email", value: order.email },
              { label: "Payment", value: order.payment_method === "cod" ? "Cash on Delivery" : order.payment_method },
              { label: "Address", value: order.address },
              { label: "Date", value: date },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white dark:bg-[#0e1520] border border-[#e8edf8] dark:border-white/[0.07] rounded-sm p-2.5">
                <p className="text-[9px] font-semibold text-[#0e1a3d]/40 dark:text-[#e8edf8]/30 uppercase tracking-wider mb-1">{label}</p>
                <p className="text-[11px] font-semibold text-[#0e1a3d] dark:text-[#e8edf8] break-words leading-snug">{value || "—"}</p>
              </div>
            ))}
          </div>
          {order.tracking_number && (
            <div className="bg-[#e8edf8] dark:bg-[#c9a028]/10 border border-[#c5cfe8] dark:border-[#c9a028]/20 rounded-sm p-3">
              <p className="text-[10px] font-semibold text-[#1a2a6c] dark:text-[#c9a028] uppercase tracking-wider mb-1">Shipping Info</p>
              <p className="text-xs font-semibold text-[#0e1a3d] dark:text-[#e8edf8]">
                {order.courier && <span>{order.courier} · </span>}
                {order.tracking_number}
              </p>
            </div>
          )}
          {order.status === "completed" && items.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-[#0e1a3d]/40 dark:text-[#e8edf8]/30 uppercase tracking-wider mb-2">Rate Items</p>
              <div className="flex flex-col gap-2">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-white dark:bg-[#0e1520] border border-[#e8edf8] dark:border-white/[0.07] rounded-sm p-2.5">
                    <img
                      src={item.image_url || "/placeholder.png"}
                      alt={item.name}
                      onError={(e) => { e.target.src = "/placeholder.png"; }}
                      className="w-10 h-10 object-cover rounded-sm border border-[#e8edf8] dark:border-white/[0.07] shrink-0"
                    />
                    <p className="flex-1 text-[11px] font-semibold text-[#0e1a3d] dark:text-[#e8edf8] truncate">
                      {item.name || `Product #${item.product_id}`}
                    </p>
                    <OrderItemReviewBtn
                      productId={item.product_id}
                      productName={item.name || `Product #${item.product_id}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cancel confirm modal */}
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

      {/* Delete confirm modal */}
      <ConfirmModal
        open={confirmDeleteOpen}
        title="Delete this order?"
        description="This will permanently remove the order from your history. This cannot be undone."
        confirmText={deleteLoading ? "Deleting..." : "Yes, delete it"}
        cancelText="Keep it"
        loading={deleteLoading}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
      />
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

  // Removes the deleted order from local state — no refetch needed
  function handleOrderDelete(id) {
    setOrders((prev) => prev.filter((o) => Number(o.id) !== Number(id)));
  }

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status !== "authenticated") return;

    fetch("/api/orders")
      .then((r) => r.json())
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));

    const channel = supabase
      .channel(`buyer:${session.user.id}`)
      .on("broadcast", { event: "orders:updated" }, (payload) => {
        const { id, status, tracking_number, courier } = payload.payload;
        setOrders((prev) =>
          prev.map((o) =>
            Number(o.id) === Number(id)
              ? { ...o, status, ...(tracking_number && { tracking_number }), ...(courier && { courier }) }
              : o
          )
        );
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
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

  const TABS = [
    { key: "all", label: "All" },
    { key: "pending", label: "To Pay" },
    { key: "confirmed", label: "Confirmed" },
    { key: "processing", label: "Processing" },
    { key: "shipped", label: "To Receive" },
    { key: "completed", label: "Completed" },
    { key: "cancelled", label: "Cancelled" },
  ];

  return (
    <main className="min-h-screen bg-[#f0eeff] dark:bg-[#070b14] transition-colors duration-300">
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

      <div className="bg-white dark:bg-[#0e1520] border-b border-[#c5cfe8] dark:border-white/[0.07] sticky top-0 z-10">
        <div className="max-w-[900px] mx-auto px-4 sm:px-5 overflow-x-auto">
          <div className="flex min-w-max">
            {TABS.map(({ key, label }) => {
              const count = key === "all" ? orders.length : (statusCounts[key] || 0);
              const isActive = filter === key;
              return (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-4 py-3.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors
                    ${isActive
                      ? "border-[#1a2a6c] dark:border-[#c9a028] text-[#1a2a6c] dark:text-[#c9a028]"
                      : "border-transparent text-[#0e1a3d]/50 dark:text-[#e8edf8]/40 hover:text-[#0e1a3d] dark:hover:text-[#e8edf8]"}`}
                >
                  {label}
                  {count > 0 && (
                    <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold
                      ${isActive
                        ? "bg-[#1a2a6c] dark:bg-[#c9a028] text-white dark:text-[#070b14]"
                        : "bg-[#e8edf8] dark:bg-white/[0.08] text-[#0e1a3d]/50 dark:text-[#e8edf8]/40"}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <section className="max-w-[900px] mx-auto px-4 sm:px-5 py-5">
        {orders.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-[#0e1520] border border-[#c5cfe8] dark:border-white/[0.07]">
            <div className="text-5xl mb-4">📦</div>
            <h2 className="text-base font-bold text-[#0e1a3d] dark:text-[#e8edf8] mb-2">No orders yet</h2>
            <p className="text-sm text-[#0e1a3d]/50 dark:text-[#e8edf8]/40 mb-6">Your purchases will appear here</p>
            <button
              onClick={() => router.push("/products")}
              className="bg-[#1a2a6c] text-white px-6 py-2.5 text-sm font-bold hover:bg-[#142060] transition rounded-sm"
            >
              Browse Products
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-[#0e1520] border border-[#c5cfe8] dark:border-white/[0.07] rounded-sm">
            <p className="text-sm text-[#0e1a3d]/40 dark:text-[#e8edf8]/30">No orders in this category.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onUpdate={handleOrderUpdate}
                onDelete={handleOrderDelete}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}