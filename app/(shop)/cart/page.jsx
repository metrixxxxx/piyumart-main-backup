// app/(shop)/cart/page.jsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ui/ConfirmModal";

export default function CartPage() {
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState([]);
  const [updatingId, setUpdatingId] = useState(null);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function fetchCart() {
      try {
        const res = await fetch("/api/cart");
        if (res.status === 401) { router.push("/login"); return; }
        const data = await res.json();
        setCart(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching cart:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCart();
  }, [router]);

  async function handleUpdateQuantity(cartItemId, newQty) {
    if (newQty < 1) return;
    setUpdatingId(cartItemId);
    try {
      await fetch("/api/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cart_item_id: cartItemId, quantity: newQty }),
      });
      setCart((prev) => prev.map((item) => item.id === cartItemId ? { ...item, quantity: newQty } : item));
    } catch (err) {
      console.error("Failed to update quantity:", err);
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleRemove(cartItemId) {
    await fetch("/api/cart", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cart_item_id: cartItemId }),
    });
    setCart((prev) => prev.filter((item) => item.id !== cartItemId));
    setSelectedItems((prev) => prev.filter((id) => id !== cartItemId));
  }

  async function confirmBulkRemove() {
    setShowRemoveModal(false);
    await Promise.all(selectedItems.map((id) =>
      fetch("/api/cart", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cart_item_id: id }),
      })
    ));
    setCart((prev) => prev.filter((item) => !selectedItems.includes(item.id)));
    setSelectedItems([]);
  }

  function toggleSelectItem(id) {
    setSelectedItems((prev) => prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]);
  }

  function toggleSelectAll() {
    setSelectedItems(selectedItems.length === cart.length ? [] : cart.map((item) => item.id));
  }

  function toggleSelectSeller(sellerItems) {
    const ids = sellerItems.map((i) => i.id);
    const allSelected = ids.every((id) => selectedItems.includes(id));
    if (allSelected) {
      setSelectedItems((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedItems((prev) => [...new Set([...prev, ...ids])]);
    }
  }

  function handleCheckoutSelected() {
    const selected = cart.filter((item) => selectedItems.includes(item.id));
    sessionStorage.setItem("selectedCartItems", JSON.stringify(selected));
    router.push("/checkout?source=selected");
  }

  function handleCheckoutAll() {
    sessionStorage.removeItem("selectedCartItems");
    router.push("/checkout");
  }

  function handleBuyNow(item) {
    router.push(`/checkout?productId=${item.product_id}&quantity=${item.quantity}${item.variant ? `&variant=${encodeURIComponent(item.variant)}` : ""}`);
  }

  if (loading) return (
    <div className="min-h-screen bg-[#eef2f7] dark:bg-[#070b14] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-[3px] border-[#c5cfe8] dark:border-white/10 border-t-[#1a2a6c] dark:border-t-[#c9a028] rounded-full mx-auto mb-4 animate-spin" />
        <p className="text-sm text-[#0e1a3d]/50 dark:text-[#e8edf8]/40">Loading cart...</p>
      </div>
    </div>
  );

  // Group by seller_id (reliable) — display seller_name as label
  const sellerGroups = cart.reduce((groups, item) => {
    const key = item.seller_id || "unknown";
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {});

  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const selectedTotal = cart
    .filter((item) => selectedItems.includes(item.id))
    .reduce((sum, item) => sum + item.price * item.quantity, 0);
  const allSelected = selectedItems.length === cart.length && cart.length > 0;
  const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
  const selectedQty = cart
    .filter((i) => selectedItems.includes(i.id))
    .reduce((s, i) => s + i.quantity, 0);
  const sellerCount = Object.keys(sellerGroups).length;

  return (
    <main className="min-h-screen bg-[#f0eeff] dark:bg-[#070b14] transition-colors duration-300">

      {/* Hero */}
      <section className="bg-[#1a2a6c] dark:bg-[#0a0e1f] px-4 sm:px-5 py-10 text-center">
        <div className="inline-flex items-center gap-2 bg-white/10 text-[#c9a028] text-[11px] font-bold px-4 py-1.5 rounded-full mb-4 uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-[#c9a028]" />
          Shopping Cart
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">My Cart</h1>
        <p className="mt-2 text-sm text-white/60">
          {totalQty} item{totalQty !== 1 ? "s" : ""} from {sellerCount} seller{sellerCount !== 1 ? "s" : ""}
        </p>
      </section>

      <section className="max-w-[960px] mx-auto px-4 py-5">
        {cart.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-[#0e1520] border border-[#c5cfe8] dark:border-white/[0.07] rounded-sm">
            <div className="text-5xl mb-4">🛒</div>
            <h2 className="text-base font-bold text-[#0e1a3d] dark:text-[#e8edf8] mb-2">Your cart is empty</h2>
            <p className="text-sm text-[#0e1a3d]/50 dark:text-[#e8edf8]/40 mb-6">Browse products and add items to get started</p>
            <button onClick={() => router.push("/products")}
              className="bg-[#1a2a6c] text-white px-6 py-2.5 rounded-sm text-sm font-bold hover:bg-[#142060] transition">
              Browse Products
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 items-start">

            {/* LEFT */}
            <div className="flex flex-col gap-2">

              {/* Select all bar */}
              <div className="bg-white dark:bg-[#0e1520] border border-[#c5cfe8] dark:border-white/[0.07] px-4 py-3 flex items-center justify-between rounded-sm">
                <label className="flex items-center gap-2.5 cursor-pointer select-none" onClick={toggleSelectAll}>
                  <div className={`w-4 h-4 rounded-sm flex items-center justify-center transition-all border-2
                    ${allSelected
                      ? "bg-[#1a2a6c] border-[#1a2a6c]"
                      : "border-[#c5cfe8] dark:border-white/20 bg-white dark:bg-white/5"}`}>
                    {allSelected && <span className="text-white text-[9px] font-bold">✓</span>}
                  </div>
                  <span className="text-xs font-semibold text-[#0e1a3d] dark:text-[#e8edf8]">Select All ({cart.length})</span>
                </label>
                {selectedItems.length > 0 && (
                  <button onClick={() => setShowRemoveModal(true)}
                    className="text-xs text-red-500 hover:text-red-600 font-semibold transition">
                    Remove ({selectedItems.length})
                  </button>
                )}
              </div>

              {/* Seller groups */}
              {Object.entries(sellerGroups).map(([sellerId, sellerItems]) => {
                const sellerIds = sellerItems.map((i) => i.id);
                const allSellerSelected = sellerIds.every((id) => selectedItems.includes(id));
                const someSellerSelected = sellerIds.some((id) => selectedItems.includes(id));
                const sellerSubtotal = sellerItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
                const sellerQty = sellerItems.reduce((sum, i) => sum + i.quantity, 0);
                const sellerDisplayName = sellerItems[0]?.seller_name || "Unknown Seller";

                return (
                  <div key={sellerId} className="rounded-sm overflow-hidden border border-[#c5cfe8] dark:border-white/[0.07] shadow-sm">

                    {/* Seller Header Banner */}
                    <div className="bg-[#1a2a6c] dark:bg-[#0d1633] px-4 py-3 flex items-center gap-3">
                      <div
                        onClick={() => toggleSelectSeller(sellerItems)}
                        className={`w-4 h-4 rounded-sm flex items-center justify-center cursor-pointer transition-all border-2 shrink-0
                          ${allSellerSelected
                            ? "bg-[#c9a028] border-[#c9a028]"
                            : someSellerSelected
                              ? "bg-[#c9a028]/40 border-[#c9a028]"
                              : "border-white/30 bg-white/10"}`}>
                        {allSellerSelected && <span className="text-[#1a2a6c] text-[9px] font-bold">✓</span>}
                        {!allSellerSelected && someSellerSelected && <span className="text-white text-[9px] font-bold">−</span>}
                      </div>

                      <div className="w-6 h-6 rounded-sm bg-[#c9a028] flex items-center justify-center shrink-0">
                        <svg className="w-3.5 h-3.5 text-[#1a2a6c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white leading-tight truncate">{sellerDisplayName}</p>
                        <p className="text-[10px] text-white/50 mt-0.5">
                          {sellerItems.length} product{sellerItems.length !== 1 ? "s" : ""} · {sellerQty} item{sellerQty !== 1 ? "s" : ""}
                        </p>
                      </div>

                      {/* Visit Shop — uses seller_id */}
                      {sellerId !== "unknown" && (
                        <button
                          onClick={() => router.push(`/shop/${sellerId}`)}
                          className="flex items-center gap-1 text-[10px] font-semibold text-white/70 border border-white/20 px-2 py-0.5 rounded-sm hover:bg-white/10 transition shrink-0"
                        >
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                          Visit Shop
                        </button>
                      )}

                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-white/50 mb-0.5">Subtotal</p>
                        <p className="text-sm font-bold text-[#c9a028]">₱{sellerSubtotal.toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="bg-white dark:bg-[#0e1520] divide-y divide-[#f0f4ff] dark:divide-white/[0.04]">
                      {sellerItems.map((item) => {
                        const isSelected = selectedItems.includes(item.id);
                        const isUpdating = updatingId === item.id;
                        return (
                          <div key={item.id}
                            className={`flex gap-3 p-4 items-start transition-colors
                              ${isSelected ? "bg-[#f0f4ff] dark:bg-[#1a2a6c]/10" : ""}
                              ${isUpdating ? "opacity-60" : ""}`}>
                            <div
                              onClick={() => toggleSelectItem(item.id)}
                              className={`w-4 h-4 mt-1 rounded-sm flex items-center justify-center cursor-pointer transition-all shrink-0 border-2
                                ${isSelected
                                  ? "bg-[#1a2a6c] border-[#1a2a6c]"
                                  : "border-[#c5cfe8] dark:border-white/20 bg-white dark:bg-white/5"}`}>
                              {isSelected && <span className="text-white text-[9px] font-bold">✓</span>}
                            </div>
                            <img
                              src={item.image_url || "/placeholder.png"}
                              onError={(e) => { e.target.src = "/placeholder.png"; }}
                              className="w-20 h-20 object-cover rounded-sm border border-[#c5cfe8] dark:border-white/[0.07] shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <h3 className="text-xs font-semibold text-[#0e1a3d] dark:text-[#e8edf8] line-clamp-2 leading-snug mb-1">{item.name}</h3>
                              {item.variant && (
                                <span className="inline-block text-[10px] bg-[#f0f4ff] dark:bg-white/[0.06] text-[#1a2a6c] dark:text-[#c9a028] px-2 py-0.5 rounded-sm mb-2">
                                  {item.variant}
                                </span>
                              )}
                              <p className="text-sm font-bold text-[#1a2a6c] dark:text-[#c9a028] mb-2">
                                ₱{(item.price * item.quantity).toLocaleString()}
                                <span className="text-[#0e1a3d]/35 dark:text-[#e8edf8]/30 font-normal text-[10px] ml-1.5">
                                  ₱{Number(item.price).toLocaleString()} each
                                </span>
                              </p>
                              <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex items-center">
                                  <button
                                    onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                                    disabled={isUpdating || item.quantity <= 1}
                                    className={`w-7 h-7 border border-[#c5cfe8] dark:border-white/10 flex items-center justify-center text-sm font-bold transition rounded-l-sm
                                      ${item.quantity <= 1
                                        ? "text-[#c5cfe8] dark:text-white/20 bg-[#f8f9ff] dark:bg-white/[0.02] cursor-not-allowed"
                                        : "text-[#0e1a3d] dark:text-[#e8edf8] bg-white dark:bg-white/[0.04] hover:bg-[#e8edf8]"}`}>−</button>
                                  <div className="w-9 h-7 border-y border-[#c5cfe8] dark:border-white/10 flex items-center justify-center text-xs font-bold text-[#0e1a3d] dark:text-[#e8edf8] bg-white dark:bg-white/[0.04]">
                                    {isUpdating ? "..." : item.quantity}
                                  </div>
                                  <button
                                    onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                                    disabled={isUpdating}
                                    className="w-7 h-7 border border-[#c5cfe8] dark:border-white/10 flex items-center justify-center text-sm font-bold text-[#0e1a3d] dark:text-[#e8edf8] bg-white dark:bg-white/[0.04] hover:bg-[#e8edf8] transition rounded-r-sm">+</button>
                                </div>
                                <button onClick={() => handleBuyNow(item)}
                                  className="text-[11px] font-semibold text-[#1a2a6c] dark:text-[#c9a028] hover:underline transition">
                                  Buy Now
                                </button>
                                <button onClick={() => handleRemove(item.id)}
                                  className="text-[11px] font-semibold text-[#0e1a3d]/40 dark:text-[#e8edf8]/30 hover:text-red-500 transition">
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Seller footer */}
                    <div className="bg-[#f8f9ff] dark:bg-white/[0.02] border-t border-[#e8edf8] dark:border-white/[0.05] px-4 py-2.5 flex items-center justify-between">
                      <span className="text-[10px] text-[#0e1a3d]/40 dark:text-[#e8edf8]/30">
                        {allSellerSelected
                          ? "All items selected"
                          : someSellerSelected
                            ? `${sellerIds.filter((id) => selectedItems.includes(id)).length} of ${sellerItems.length} selected`
                            : "No items selected"}
                      </span>
                      <button
                        onClick={() => toggleSelectSeller(sellerItems)}
                        className="text-[10px] font-semibold text-[#1a2a6c] dark:text-[#c9a028] hover:underline transition">
                        {allSellerSelected ? "Deselect all from this shop" : "Select all from this shop"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* RIGHT — sticky summary */}
            <div className="lg:sticky lg:top-4 flex flex-col gap-3">
              <div className="bg-white dark:bg-[#0e1520] border border-[#c5cfe8] dark:border-white/[0.07] p-4 rounded-sm">
                <h3 className="text-xs font-bold text-[#0e1a3d] dark:text-[#e8edf8] mb-3 uppercase tracking-wider">Order Summary</h3>
                <div className="flex flex-col gap-2 mb-3 pb-3 border-b border-[#e8edf8] dark:border-white/[0.07]">
                  <div className="flex justify-between text-xs text-[#0e1a3d]/50 dark:text-[#e8edf8]/40">
                    <span>Subtotal ({totalQty} items)</span>
                    <span>₱{totalPrice.toLocaleString()}</span>
                  </div>
                  {selectedItems.length > 0 && (
                    <div className="flex justify-between text-xs font-semibold text-[#1a2a6c] dark:text-[#c9a028]">
                      <span>Selected ({selectedQty} items)</span>
                      <span>₱{selectedTotal.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-[#0e1a3d]/40 dark:text-[#e8edf8]/30">
                    <span>Shipping</span>
                    <span className="text-green-500 font-semibold">Free</span>
                  </div>
                </div>

                {/* Per-seller breakdown */}
                {sellerCount > 1 && (
                  <div className="mb-3 pb-3 border-b border-[#e8edf8] dark:border-white/[0.07]">
                    <p className="text-[10px] font-bold text-[#0e1a3d]/40 dark:text-[#e8edf8]/30 uppercase tracking-wider mb-2">By Seller</p>
                    {Object.entries(sellerGroups).map(([sid, items]) => (
                      <div key={sid} className="flex justify-between text-[11px] text-[#0e1a3d]/60 dark:text-[#e8edf8]/40 mb-1">
                        <span className="truncate max-w-[140px]">{items[0]?.seller_name || "Unknown"}</span>
                        <span>₱{items.reduce((s, i) => s + i.price * i.quantity, 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between items-center mb-4">
                  <span className="text-xs font-semibold text-[#0e1a3d]/60 dark:text-[#e8edf8]/50">Total</span>
                  <span className="text-base font-bold text-[#1a2a6c] dark:text-[#c9a028]">
                    ₱{(selectedItems.length > 0 ? selectedTotal : totalPrice).toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {selectedItems.length > 0 && (
                    <button onClick={handleCheckoutSelected}
                      className="w-full bg-[#1a2a6c] text-white rounded-sm py-3 text-sm font-bold hover:bg-[#142060] transition">
                      Checkout Selected ({selectedItems.length})
                    </button>
                  )}
                  <button onClick={handleCheckoutAll}
                    className={`w-full rounded-sm py-3 text-sm font-bold transition
                      ${selectedItems.length > 0
                        ? "bg-white dark:bg-white/[0.04] text-[#0e1a3d] dark:text-[#e8edf8] border border-[#c5cfe8] dark:border-white/[0.07] hover:border-[#1a2a6c]"
                        : "bg-[#1a2a6c] text-white hover:bg-[#142060]"}`}>
                    Checkout All
                  </button>
                </div>
              </div>
              <button onClick={() => router.push("/")}
                className="text-xs text-[#0e1a3d]/40 dark:text-[#e8edf8]/30 hover:text-[#1a2a6c] dark:hover:text-[#c9a028] transition text-center">
                ← Continue Shopping
              </button>
            </div>
          </div>
        )}
      </section>

      <ConfirmModal
        open={showRemoveModal}
        title="Remove selected items?"
        description={`This will remove ${selectedItems.length} item${selectedItems.length !== 1 ? "s" : ""} from your cart.`}
        confirmText="Remove items"
        cancelText="Keep items"
        onCancel={() => setShowRemoveModal(false)}
        onConfirm={confirmBulkRemove}
      />
    </main>
  );
}