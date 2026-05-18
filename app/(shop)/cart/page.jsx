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
    <div className="min-h-screen bg-[#eef2f7] dark:bg-[#070b14] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-[3px] border-[#c5cfe8] dark:border-white/10 border-t-[#1a2a6c] dark:border-t-[#c9a028] rounded-full mx-auto mb-4 animate-spin" />
        <p className="text-sm text-[#0e1a3d]/50 dark:text-[#e8edf8]/40">Loading cart...</p>
      </div>
    </div>
  );

  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const selectedTotal = cart.filter((item) => selectedItems.includes(item.id)).reduce((sum, item) => sum + item.price * item.quantity, 0);
  const allSelected = selectedItems.length === cart.length && cart.length > 0;
  const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <main className="min-h-screen bg-[#eef2f7] dark:bg-[#070b14] transition-colors duration-300">

      {/* HERO */}
      <section className="bg-[#1a2a6c] dark:bg-[#0a0e1f] px-5 py-10 text-center">
        <div className="inline-flex items-center gap-2 bg-white/10 text-[#c9a028] text-[11px] font-bold px-4 py-1.5 rounded-full mb-4 uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-[#c9a028]" />
          Shopping Cart
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Your Cart</h1>
        <p className="mt-2 text-sm text-white/60">
          {totalQty} item{totalQty !== 1 ? "s" : ""} in your cart
        </p>
      </section>

      <section className="max-w-[900px] mx-auto px-4 py-8">
        {cart.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-[#0e1520] rounded-2xl border border-[#c5cfe8] dark:border-white/[0.07]">
            <div className="text-5xl mb-4">🛒</div>
            <h2 className="text-lg font-bold text-[#0e1a3d] dark:text-[#e8edf8] mb-2">Your cart is empty</h2>
            <p className="text-sm text-[#0e1a3d]/50 dark:text-[#e8edf8]/40 mb-6">Browse products and add items to get started</p>
            <button onClick={() => router.push("/products")}
              className="bg-[#1a2a6c] text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-[#142060] transition">
              Browse Products
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">

            {/* LEFT */}
            <div className="flex flex-col gap-3">
              <div className="bg-white dark:bg-[#0e1520] rounded-xl border border-[#c5cfe8] dark:border-white/[0.07] px-4 py-3 flex items-center justify-between">
                <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-[#0e1a3d] dark:text-[#e8edf8]">
                  <div onClick={toggleSelectAll}
                    className={`w-5 h-5 rounded-md flex items-center justify-center cursor-pointer transition-all border-2
                      ${allSelected ? "bg-[#1a2a6c] border-[#1a2a6c]" : "border-[#c5cfe8] dark:border-white/20 bg-white dark:bg-white/5"}`}>
                    {allSelected && <span className="text-white text-xs font-bold">✓</span>}
                  </div>
                  Select All
                </label>
                {selectedItems.length > 0 && (
                  <button onClick={handleBulkRemove}
                    className="bg-red-50 dark:bg-red-500/10 text-red-500 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-red-100 transition">
                    Remove {selectedItems.length} selected
                  </button>
                )}
              </div>

              {cart.map((item) => {
                const isSelected = selectedItems.includes(item.id);
                const isUpdating = updatingId === item.id;
                return (
                  <div key={item.id}
                    className={`bg-white dark:bg-[#0e1520] rounded-2xl border p-4 flex gap-3 items-center transition-all duration-150
                      ${isSelected ? "border-[#1a2a6c] dark:border-[#c9a028] shadow-[0_0_0_3px_rgba(26,42,108,0.12)]" : "border-[#c5cfe8] dark:border-white/[0.07]"}
                      ${isUpdating ? "opacity-60" : ""}`}>
                    <div onClick={() => toggleSelectItem(item.id)}
                      className={`w-5 h-5 rounded-md flex items-center justify-center cursor-pointer transition-all shrink-0 border-2
                        ${isSelected ? "bg-[#1a2a6c] border-[#1a2a6c]" : "border-[#c5cfe8] dark:border-white/20 bg-white dark:bg-white/5"}`}>
                      {isSelected && <span className="text-white text-xs font-bold">✓</span>}
                    </div>

                    <img src={item.image_url || "/placeholder.png"} className="w-[72px] h-[72px] object-cover rounded-xl shrink-0 border border-[#c5cfe8] dark:border-white/[0.07]" />

                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-[#0e1a3d] dark:text-[#e8edf8] mb-1 truncate">{item.name}</h3>
                      {item.variant && (
                        <span className="text-[11px] bg-[#e8edf8] dark:bg-white/[0.06] text-[#1a2a6c] dark:text-[#c9a028] px-2 py-0.5 rounded-full inline-block mb-1.5">
                          {item.variant}
                        </span>
                      )}
                      <p className="text-[#1a2a6c] dark:text-[#c9a028] font-bold text-sm mb-2">
                        ₱{(item.price * item.quantity).toLocaleString()}
                        <span className="text-[#0e1a3d]/40 dark:text-[#e8edf8]/35 font-normal text-xs ml-1.5">₱{Number(item.price).toLocaleString()} each</span>
                      </p>
                      <div className="flex items-center">
                        <button onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)} disabled={isUpdating || item.quantity <= 1}
                          className={`w-8 h-8 rounded-l-lg border-[1.5px] border-r-0 border-[#c5cfe8] dark:border-white/10 flex items-center justify-center text-base font-bold transition
                            ${item.quantity <= 1 ? "text-[#c5cfe8] dark:text-white/20 bg-[#f0f4ff] dark:bg-white/[0.02] cursor-not-allowed" : "text-[#0e1a3d] dark:text-[#e8edf8] bg-white dark:bg-white/[0.04] hover:bg-[#e8edf8]"}`}>−</button>
                        <div className="w-10 h-8 border-[1.5px] border-[#c5cfe8] dark:border-white/10 flex items-center justify-center text-xs font-bold text-[#0e1a3d] dark:text-[#e8edf8] bg-white dark:bg-white/[0.04]">
                          {isUpdating ? "..." : item.quantity}
                        </div>
                        <button onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)} disabled={isUpdating}
                          className="w-8 h-8 rounded-r-lg border-[1.5px] border-l-0 border-[#c5cfe8] dark:border-white/10 flex items-center justify-center text-base font-bold text-[#0e1a3d] dark:text-[#e8edf8] bg-white dark:bg-white/[0.04] hover:bg-[#e8edf8] transition">+</button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button onClick={() => handleBuyNow(item)}
                        className="bg-[#1a2a6c] text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-[#142060] transition">
                        Buy Now
                      </button>
                      <button onClick={() => handleRemove(item.id)}
                        className="bg-red-50 dark:bg-red-500/10 text-red-500 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-100 transition">
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* RIGHT — Summary */}
            <div className="sticky top-20 flex flex-col gap-3">
              <div className="bg-white dark:bg-[#0e1520] rounded-2xl border border-[#c5cfe8] dark:border-white/[0.07] p-5">
                <h3 className="text-sm font-bold text-[#0e1a3d] dark:text-[#e8edf8] mb-4">Order Summary</h3>
                <div className="flex flex-col gap-2.5 mb-4">
                  <div className="flex justify-between text-xs text-[#0e1a3d]/50 dark:text-[#e8edf8]/40">
                    <span>Subtotal ({totalQty} items)</span>
                    <span>₱{totalPrice.toLocaleString()}</span>
                  </div>
                  {selectedItems.length > 0 && (
                    <div className="flex justify-between text-xs text-[#1a2a6c] dark:text-[#c9a028] font-semibold">
                      <span>Selected ({selectedItems.length} items)</span>
                      <span>₱{selectedTotal.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="border-t border-[#c5cfe8] dark:border-white/[0.07] pt-2.5 flex justify-between text-sm font-bold text-[#0e1a3d] dark:text-[#e8edf8]">
                    <span>Total</span>
                    <span>₱{(selectedItems.length > 0 ? selectedTotal : totalPrice).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {selectedItems.length > 0 && (
                    <button onClick={handleCheckoutSelected}
                      className="w-full bg-[#1a2a6c] text-white rounded-xl py-3 text-sm font-bold hover:bg-[#142060] transition">
                      Checkout Selected ({selectedItems.length})
                    </button>
                  )}
                  <button onClick={handleCheckoutAll}
                    className={`w-full rounded-xl py-3 text-sm font-bold transition
                      ${selectedItems.length > 0
                        ? "bg-[#e8edf8] dark:bg-white/[0.04] text-[#0e1a3d] dark:text-[#e8edf8] border border-[#c5cfe8] dark:border-white/[0.07] hover:border-[#1a2a6c]"
                        : "bg-[#1a2a6c] text-white hover:bg-[#142060]"}`}>
                    Checkout All
                  </button>
                </div>
              </div>
              <button onClick={() => router.push("/")}
                className="text-xs text-[#0e1a3d]/50 dark:text-[#e8edf8]/40 hover:text-[#1a2a6c] dark:hover:text-[#c9a028] transition text-center">
                ← Continue Shopping
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}