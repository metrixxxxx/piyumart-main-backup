"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function CartPage() {
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState([]);
  const [updatingId, setUpdatingId] = useState(null);
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
    await fetch("/api/cart", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cart_item_id: cartItemId }) });
    setCart((prev) => prev.filter((item) => item.id !== cartItemId));
    setSelectedItems((prev) => prev.filter((id) => id !== cartItemId));
  }

  async function handleBulkRemove() {
    if (selectedItems.length === 0) return;
    if (!confirm(`Remove ${selectedItems.length} item(s)?`)) return;
    await Promise.all(selectedItems.map((id) => fetch("/api/cart", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cart_item_id: id }) })));
    setCart((prev) => prev.filter((item) => !selectedItems.includes(item.id)));
    setSelectedItems([]);
  }

  function toggleSelectItem(id) {
    setSelectedItems((prev) => prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]);
  }

  function toggleSelectAll() {
    setSelectedItems(selectedItems.length === cart.length ? [] : cart.map((item) => item.id));
  }

  function handleCheckoutAll() {
    sessionStorage.removeItem("selectedCartItems");
    router.push("/checkout");
  }

  function handleCheckoutSelected() {
    const selected = cart.filter((item) => selectedItems.includes(item.id));
    sessionStorage.setItem("selectedCartItems", JSON.stringify(selected));
    router.push("/checkout?source=selected");
  }

  function handleBuyNow(item) {
    router.push(`/checkout?productId=${item.product_id}&quantity=${item.quantity}`);
  }

  if (loading) return (
    <div className="min-h-screen bg-[#f0eeff] dark:bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-[3px] border-[#e8e5f0] dark:border-white/10 border-t-[#6d4aff] dark:border-t-[#c9a96e] rounded-full mx-auto mb-4 animate-spin" />
        <p className="text-sm text-[#1a1060]/50 dark:text-[#f0ede8]/40">Loading cart...</p>
      </div>
    </div>
  );

  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const selectedTotal = cart.filter((item) => selectedItems.includes(item.id)).reduce((sum, item) => sum + item.price * item.quantity, 0);
  const allSelected = selectedItems.length === cart.length && cart.length > 0;

  return (
    <main className="min-h-screen bg-[#f0eeff] dark:bg-[#0a0a0f] transition-colors duration-300">

      {/* HERO */}
      <section className="bg-white dark:bg-[#0a0a0f] border-b border-[#e8e5f0] dark:border-white/[0.07] px-5 py-12 text-center">
        <div className="inline-flex items-center gap-2 bg-[#ede9ff] dark:bg-[#c9a96e]/10 text-[#6d4aff] dark:text-[#c9a96e] text-[11px] font-bold px-4 py-1.5 rounded-full mb-4 uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-[#6d4aff] dark:bg-[#c9a96e]" />
          Shopping Cart
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#1a1060] dark:text-[#f0ede8]">Your Cart</h1>
        <p className="mt-2 text-sm text-[#1a1060]/50 dark:text-[#f0ede8]/45">
          {cart.length === 0 ? "Nothing here yet" : `${cart.length} item${cart.length > 1 ? "s" : ""} in your cart`}
        </p>
      </section>

      <section className="max-w-[900px] mx-auto px-5 py-8">
        {cart.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-[#12121a] rounded-2xl border border-[#e8e5f0] dark:border-white/[0.07]">
            <div className="text-5xl mb-4">🛒</div>
            <h2 className="text-lg font-bold text-[#1a1060] dark:text-[#f0ede8] mb-2">Your cart is empty</h2>
            <p className="text-sm text-[#1a1060]/50 dark:text-[#f0ede8]/40 mb-6">Browse products and add items to get started</p>
            <button
              onClick={() => router.push("/products")}
              className="bg-[#6d4aff] dark:bg-[#c9a96e] text-white dark:text-[#0a0a0f] px-6 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition"
            >
              Browse Products
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">

            {/* LEFT — Items */}
            <div className="flex flex-col gap-3">

              {/* Toolbar */}
              <div className="bg-white dark:bg-[#12121a] rounded-xl border border-[#e8e5f0] dark:border-white/[0.07] px-4 py-3 flex items-center justify-between">
                <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-[#1a1060] dark:text-[#f0ede8]">
                  <div
                    onClick={toggleSelectAll}
                    className={`w-5 h-5 rounded-md flex items-center justify-center cursor-pointer transition-all border-2
                      ${allSelected ? "bg-[#6d4aff] dark:bg-[#c9a96e] border-[#6d4aff] dark:border-[#c9a96e]" : "border-[#d1d5db] dark:border-white/20 bg-white dark:bg-white/5"}`}
                  >
                    {allSelected && <span className="text-white dark:text-[#0a0a0f] text-xs font-bold">✓</span>}
                  </div>
                  Select All
                </label>
                {selectedItems.length > 0 && (
                  <button
                    onClick={handleBulkRemove}
                    className="bg-red-50 dark:bg-red-500/10 text-red-500 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20 transition"
                  >
                    Remove {selectedItems.length} selected
                  </button>
                )}
              </div>

              {/* Cart Items */}
              {cart.map((item) => {
                const isSelected = selectedItems.includes(item.id);
                const isUpdating = updatingId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`bg-white dark:bg-[#12121a] rounded-2xl border p-4 flex gap-3 items-center transition-all duration-150
                      ${isSelected
                        ? "border-[#6d4aff] dark:border-[#c9a96e] shadow-[0_0_0_3px_rgba(109,74,255,0.12)] dark:shadow-[0_0_0_3px_rgba(201,169,110,0.1)]"
                        : "border-[#e8e5f0] dark:border-white/[0.07]"}
                      ${isUpdating ? "opacity-60" : ""}`}
                  >
                    {/* Checkbox */}
                    <div
                      onClick={() => toggleSelectItem(item.id)}
                      className={`w-5 h-5 rounded-md flex items-center justify-center cursor-pointer transition-all shrink-0 border-2
                        ${isSelected ? "bg-[#6d4aff] dark:bg-[#c9a96e] border-[#6d4aff] dark:border-[#c9a96e]" : "border-[#d1d5db] dark:border-white/20 bg-white dark:bg-white/5"}`}
                    >
                      {isSelected && <span className="text-white dark:text-[#0a0a0f] text-xs font-bold">✓</span>}
                    </div>

                    {/* Image */}
                    <img
                      src={item.image_url || "/placeholder.png"}
                      className="w-[72px] h-[72px] object-cover rounded-xl shrink-0 border border-[#f0f0f0] dark:border-white/[0.07]"
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-[#1a1060] dark:text-[#f0ede8] mb-1 truncate">{item.name}</h3>
                      {item.variant && (
                        <span className="text-[11px] bg-[#f5f3ff] dark:bg-white/[0.06] text-[#6d4aff] dark:text-[#c9a96e] px-2 py-0.5 rounded-full inline-block mb-1.5">
                          {item.variant}
                        </span>
                      )}
                      <p className="text-[#6d4aff] dark:text-[#c9a96e] font-bold text-sm mb-2">
                        ₱{(item.price * item.quantity).toLocaleString()}
                        <span className="text-[#1a1060]/40 dark:text-[#f0ede8]/35 font-normal text-xs ml-1.5">₱{Number(item.price).toLocaleString()} each</span>
                      </p>

                      {/* Quantity Controls */}
                      <div className="flex items-center">
                        <button
                          onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                          disabled={isUpdating || item.quantity <= 1}
                          className={`w-8 h-8 rounded-l-lg border-[1.5px] border-r-0 border-[#e8e5f0] dark:border-white/10 flex items-center justify-center text-base font-bold transition
                            ${item.quantity <= 1 ? "text-[#d1d5db] dark:text-white/20 bg-[#fafafa] dark:bg-white/[0.02] cursor-not-allowed" : "text-[#1a1060] dark:text-[#f0ede8] bg-white dark:bg-white/[0.04] hover:bg-[#f5f3ff] dark:hover:bg-white/[0.08]"}`}
                        >−</button>
                        <div className="w-10 h-8 border-[1.5px] border-[#e8e5f0] dark:border-white/10 flex items-center justify-center text-xs font-bold text-[#1a1060] dark:text-[#f0ede8] bg-white dark:bg-white/[0.04]">
                          {isUpdating ? "..." : item.quantity}
                        </div>
                        <button
                          onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                          disabled={isUpdating}
                          className="w-8 h-8 rounded-r-lg border-[1.5px] border-l-0 border-[#e8e5f0] dark:border-white/10 flex items-center justify-center text-base font-bold text-[#1a1060] dark:text-[#f0ede8] bg-white dark:bg-white/[0.04] hover:bg-[#f5f3ff] dark:hover:bg-white/[0.08] transition"
                        >+</button>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        onClick={() => handleBuyNow(item)}
                        className="bg-[#6d4aff] dark:bg-[#c9a96e] text-white dark:text-[#0a0a0f] text-xs font-bold px-3 py-1.5 rounded-lg hover:opacity-90 transition"
                      >
                        Buy Now
                      </button>
                      <button
                        onClick={() => handleRemove(item.id)}
                        className="bg-red-50 dark:bg-red-500/10 text-red-500 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20 transition"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* RIGHT — Summary */}
            <div className="sticky top-6 flex flex-col gap-3">
              <div className="bg-white dark:bg-[#12121a] rounded-2xl border border-[#e8e5f0] dark:border-white/[0.07] p-5">
                <h3 className="text-sm font-bold text-[#1a1060] dark:text-[#f0ede8] mb-4">Order Summary</h3>
                <div className="flex flex-col gap-2.5 mb-4">
                  <div className="flex justify-between text-xs text-[#1a1060]/50 dark:text-[#f0ede8]/40">
                    <span>Subtotal ({cart.length} items)</span>
                    <span>₱{totalPrice.toLocaleString()}</span>
                  </div>
                  {selectedItems.length > 0 && (
                    <div className="flex justify-between text-xs text-[#6d4aff] dark:text-[#c9a96e] font-semibold">
                      <span>Selected ({selectedItems.length} items)</span>
                      <span>₱{selectedTotal.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="border-t border-[#e8e5f0] dark:border-white/[0.07] pt-2.5 flex justify-between text-sm font-bold text-[#1a1060] dark:text-[#f0ede8]">
                    <span>Total</span>
                    <span>₱{(selectedItems.length > 0 ? selectedTotal : totalPrice).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {selectedItems.length > 0 && (
                    <button
                      onClick={handleCheckoutSelected}
                      className="w-full bg-[#6d4aff] dark:bg-[#c9a96e] text-white dark:text-[#0a0a0f] rounded-xl py-3 text-sm font-bold hover:opacity-90 transition"
                    >
                      Checkout Selected ({selectedItems.length})
                    </button>
                  )}
                  <button
                    onClick={handleCheckoutAll}
                    className={`w-full rounded-xl py-3 text-sm font-bold transition
                      ${selectedItems.length > 0
                        ? "bg-[#f5f3ff] dark:bg-white/[0.04] text-[#1a1060] dark:text-[#f0ede8] border border-[#e8e5f0] dark:border-white/[0.07] hover:border-[#6d4aff] dark:hover:border-[#c9a96e]"
                        : "bg-[#6d4aff] dark:bg-[#c9a96e] text-white dark:text-[#0a0a0f] hover:opacity-90"}`}
                  >
                    Checkout All
                  </button>
                </div>
              </div>
              <button
                onClick={() => router.push("/products")}
                className="text-xs text-[#1a1060]/50 dark:text-[#f0ede8]/40 hover:text-[#6d4aff] dark:hover:text-[#c9a96e] transition text-center"
              >
                ← Continue Shopping
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}