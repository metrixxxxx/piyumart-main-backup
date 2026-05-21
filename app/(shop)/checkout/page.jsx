"use client";
import { useState, useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

function CheckoutContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const productId = searchParams.get("productId");
  const isBuyNow = Boolean(productId);
  const quantity = parseInt(searchParams.get("quantity") || "1");
  const variantParam = searchParams.get("variant") || null;

  const [product, setProduct] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orderDone, setOrderDone] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cod");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const load = async () => {
      setLoading(true);
      try {
        if (isBuyNow) {
          const res = await fetch(`/api/products/${productId}`);
          const data = await res.json();

          // Use variant image if available
          if (variantParam && data.variants?.length > 0) {
            const matchedVariant = data.variants.find((v) => v.label === variantParam);
            if (matchedVariant?.image_url) {
              data.image_url = matchedVariant.image_url;
            }
          }

          setProduct(data);
        } else {
          const source = searchParams.get("source");
          if (source === "selected") {
            const stored = sessionStorage.getItem("selectedCartItems");
            if (stored) setCartItems(JSON.parse(stored));
          } else {
            const res = await fetch("/api/cart");
            const data = await res.json();
            setCartItems(Array.isArray(data) ? data : []);
          }
        }
        setName(session?.user?.name || "");
        setEmail(session?.user?.email || "");
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [status, isBuyNow, productId, session, searchParams]);

  // BUG FIX: normalize items so both buy-now and cart share the same shape
  const items = isBuyNow && product
    ? [{
        product_id: product.id,
        id: product.id,
        name: product.name,
        image_url: product.image_url || null,
        price: product.price,
        quantity,
        variant: variantParam,
        seller_name: product.seller_name || null,
      }]
    : cartItems.map((item) => ({
        product_id: item.product_id ?? item.id,
        id: item.id,
        name: item.name,
        image_url: item.image_url || null,
        price: item.price,
        quantity: item.quantity,
        variant: item.variant || null,
        seller_name: item.seller_name || null,
      }));

  // BUG FIX: validate each item has a valid product_id
  const invalidItems = items.filter((item) => !item.product_id);

  const total = items.reduce(
    (sum, item) => sum + parseFloat(item.price) * item.quantity,
    0
  );

  // Group items by seller for Shopee-style display
  const sellerGroups = items.reduce((groups, item) => {
    const seller = item.seller_name || "Unknown Seller";
    if (!groups[seller]) groups[seller] = [];
    groups[seller].push(item);
    return groups;
  }, {});

  async function handleSubmit() {
    if (!name || !email || !address) return alert("Please fill in all fields!");
    if (!email.endsWith("@lspu.edu.ph")) return alert("Please use your LSPU email!");
    if (items.length === 0) return alert("No items to checkout!");
    if (invalidItems.length > 0)
      return alert("Some items in your cart are invalid. Please remove them and try again.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          address,
          payment_method: paymentMethod,
          total,
          // BUG FIX: include name, image_url, seller_name so my-orders can display them
          items: items.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            price: parseFloat(item.price),
            variant: item.variant || null,
            name: item.name,
            image_url: item.image_url || null,
            seller_name: item.seller_name || null,
          })),
        }),
      });

     if (!res.ok) {
  const err = await res.json();
  alert(err.error || "Something went wrong.");
  setSubmitting(false);
  return;
}

setOrderDone(true);
setTimeout(() => router.push("/my-orders"), 2500);
    } catch (err) {
      console.error(err);
      alert("Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full py-2.5 px-3.5 rounded-xl border-[1.5px] border-[#e8e5f0] dark:border-white/10 bg-[#f5f3ff] dark:bg-white/[0.06] text-[#1a1060] dark:text-[#f0ede8] placeholder:text-[#1a1060]/30 dark:placeholder:text-[#f0ede8]/30 text-sm outline-none focus:border-[#6d4aff] dark:focus:border-[#c9a96e] transition-colors";

  if (status === "loading" || loading)
    return (
      <div className="min-h-screen bg-[#f0eeff] dark:bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-[3px] border-[#e8e5f0] dark:border-white/10 border-t-[#6d4aff] dark:border-t-[#c9a96e] rounded-full mx-auto mb-4 animate-spin" />
          <p className="text-sm text-[#1a1060]/50 dark:text-[#f0ede8]/40">Loading checkout...</p>
        </div>
      </div>
    );

  if (orderDone)
    return (
      <div className="min-h-screen bg-[#f0eeff] dark:bg-[#0a0a0f] flex items-center justify-center p-4">
        <div className="text-center px-6 sm:px-12 py-10 sm:py-14 bg-white dark:bg-[#12121a] rounded-2xl border border-[#e8e5f0] dark:border-white/[0.07]">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-xl font-bold text-[#1a1060] dark:text-[#f0ede8] mb-2">Order Placed! Thank you for your purchase Ka PIYU</h2>
          <p className="text-sm text-[#1a1060]/50 dark:text-[#f0ede8]/40">
            Redirecting to your orders...
          </p>
        </div>
      </div>
    );

  return (
    <main className="min-h-screen bg-[#f0eeff] dark:bg-[#0a0a0f] transition-colors duration-300">
      {/* HERO */}
      <section className="bg-white dark:bg-[#0a0a0f] border-b border-[#e8e5f0] dark:border-white/[0.07] px-4 sm:px-5 py-10 sm:py-12 text-center">
        <div className="inline-flex items-center gap-2 bg-[#ede9ff] dark:bg-[#c9a96e]/10 text-[#6d4aff] dark:text-[#c9a96e] text-[11px] font-bold px-4 py-1.5 rounded-full mb-4 uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-[#6d4aff] dark:bg-[#c9a96e]" />
          Secure Checkout
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#1a1060] dark:text-[#f0ede8]">
          Checkout
        </h1>
        <p className="mt-2 text-sm text-[#1a1060]/50 dark:text-[#f0ede8]/45">
          {items.length} item{items.length !== 1 ? "s" : ""} · ₱{total.toLocaleString()} total
        </p>
      </section>

      <section className="max-w-[960px] mx-auto px-4 sm:px-5 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">

          {/* LEFT — Delivery Details */}
          <div className="flex flex-col gap-4">

            {/* Invalid items warning */}
            {invalidItems.length > 0 && (
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl p-4">
                <p className="text-xs font-semibold text-red-500">
                  ⚠️ {invalidItems.length} item{invalidItems.length > 1 ? "s" : ""} in your cart {invalidItems.length > 1 ? "are" : "is"} invalid and will be skipped. Please remove them from your cart.
                </p>
              </div>
            )}

            {/* Contact */}
            <div className="bg-white dark:bg-[#12121a] rounded-2xl border border-[#e8e5f0] dark:border-white/[0.07] p-5 sm:p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-7 h-7 rounded-lg bg-[#6d4aff] dark:bg-[#c9a96e] flex items-center justify-center text-xs font-bold text-white dark:text-[#0a0a0f]">
                  1
                </div>
                <h2 className="text-sm font-bold text-[#1a1060] dark:text-[#f0ede8]">Contact Information</h2>
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#1a1060]/50 dark:text-[#f0ede8]/40 uppercase tracking-wider block mb-1.5">
                    Full Name
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Juan dela Cruz"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#1a1060]/50 dark:text-[#f0ede8]/40 uppercase tracking-wider block mb-1.5">
                    LSPU Email
                  </label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="yourname@lspu.edu.ph"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* Delivery */}
            <div className="bg-white dark:bg-[#12121a] rounded-2xl border border-[#e8e5f0] dark:border-white/[0.07] p-5 sm:p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-7 h-7 rounded-lg bg-[#6d4aff] dark:bg-[#c9a96e] flex items-center justify-center text-xs font-bold text-white dark:text-[#0a0a0f]">
                  2
                </div>
                <h2 className="text-sm font-bold text-[#1a1060] dark:text-[#f0ede8]">Delivery Address</h2>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#1a1060]/50 dark:text-[#f0ede8]/40 uppercase tracking-wider block mb-1.5">
                  Full Address
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Building, Street, Barangay, City, Province"
                  rows={3}
                  className={`${inputClass} resize-y font-[inherit]`}
                />
              </div>
            </div>

            {/* Payment */}
            <div className="bg-white dark:bg-[#12121a] rounded-2xl border border-[#e8e5f0] dark:border-white/[0.07] p-5 sm:p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-7 h-7 rounded-lg bg-[#6d4aff] dark:bg-[#c9a96e] flex items-center justify-center text-xs font-bold text-white dark:text-[#0a0a0f]">
                  3
                </div>
                <h2 className="text-sm font-bold text-[#1a1060] dark:text-[#f0ede8]">Payment Method</h2>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-xl border-[1.5px] border-[#6d4aff] dark:border-[#c9a96e] bg-[#f5f3ff] dark:bg-[#c9a96e]/5 cursor-pointer">
                <div className="w-9 h-9 rounded-lg bg-[#6d4aff] dark:bg-[#c9a96e] flex items-center justify-center text-lg shrink-0">
                  💵
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1a1060] dark:text-[#f0ede8]">Cash on Delivery</p>
                  <p className="text-xs text-[#1a1060]/50 dark:text-[#f0ede8]/40">Pay when your order arrives</p>
                </div>
                <div className="ml-auto w-4 h-4 rounded-full bg-[#6d4aff] dark:bg-[#c9a96e] flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-[#0a0a0f]" />
                </div>
              </div>
            </div>

            {/* Shopee-style: Items grouped by seller */}
            <div className="bg-white dark:bg-[#12121a] rounded-2xl border border-[#e8e5f0] dark:border-white/[0.07] p-5 sm:p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-7 h-7 rounded-lg bg-[#6d4aff] dark:bg-[#c9a96e] flex items-center justify-center text-xs font-bold text-white dark:text-[#0a0a0f]">
                  4
                </div>
                <h2 className="text-sm font-bold text-[#1a1060] dark:text-[#f0ede8]">Order Items</h2>
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-[#1a1060]/50 dark:text-[#f0ede8]/40">No items to checkout.</p>
              ) : (
                <div className="flex flex-col gap-5">
                  {Object.entries(sellerGroups).map(([seller, sellerItems]) => {
                    const sellerTotal = sellerItems.reduce(
                      (sum, i) => sum + parseFloat(i.price) * i.quantity,
                      0
                    );
                    return (
                      <div key={seller} className="flex flex-col gap-3">
                        {/* Seller header */}
                        <div className="flex items-center gap-2 pb-2 border-b border-[#e8e5f0] dark:border-white/[0.07]">
                          <span className="text-[11px]">🏪</span>
                          <span className="text-xs font-bold text-[#6d4aff] dark:text-[#c9a96e]">
                            {seller}
                          </span>
                        </div>

                        {/* Seller items */}
                        {sellerItems.map((item, idx) => (
                          <div key={idx} className="flex gap-3 items-start">
                            <img
                              src={item.image_url || "/placeholder.png"}
                              alt={item.name}
                              onError={(e) => { e.target.src = "/placeholder.png"; }}
                              className="w-14 h-14 object-cover rounded-xl shrink-0 border border-[#e8e5f0] dark:border-white/[0.07]"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-[#1a1060] dark:text-[#f0ede8] truncate">
                                {item.name}
                              </p>
                              {item.variant && (
                                <span className="inline-block mt-0.5 text-[10px] bg-[#ede9ff] dark:bg-white/[0.06] text-[#6d4aff] dark:text-[#c9a96e] px-2 py-0.5 rounded-full">
                                  {item.variant}
                                </span>
                              )}
                              <p className="text-[11px] text-[#1a1060]/50 dark:text-[#f0ede8]/40 mt-0.5">
                                Qty: {item.quantity} × ₱{Number(item.price).toLocaleString()}
                              </p>
                            </div>
                            <p className="text-xs font-bold text-[#1a1060] dark:text-[#f0ede8] shrink-0">
                              ₱{(item.price * item.quantity).toLocaleString()}
                            </p>
                          </div>
                        ))}

                        {/* Seller subtotal */}
                        <div className="flex justify-between items-center pt-2 border-t border-dashed border-[#e8e5f0] dark:border-white/[0.07]">
                          <span className="text-[11px] text-[#1a1060]/40 dark:text-[#f0ede8]/30">
                            Subtotal ({sellerItems.length} item{sellerItems.length > 1 ? "s" : ""})
                          </span>
                          <span className="text-xs font-bold text-[#6d4aff] dark:text-[#c9a96e]">
                            ₱{sellerTotal.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — Order Summary sticky */}
          <div className="lg:sticky lg:top-6 flex flex-col gap-3">
            <div className="bg-white dark:bg-[#12121a] rounded-2xl border border-[#e8e5f0] dark:border-white/[0.07] p-5">
              <h3 className="text-sm font-bold text-[#1a1060] dark:text-[#f0ede8] mb-4">
                Order Summary
              </h3>

              {/* Compact items list */}
              {items.length === 0 ? (
                <p className="text-sm text-[#1a1060]/50 dark:text-[#f0ede8]/40">No items to checkout.</p>
              ) : (
                <div className="flex flex-col gap-2.5 mb-4">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex gap-2.5 items-center">
                      <div className="relative shrink-0">
                        <img
                          src={item.image_url || "/placeholder.png"}
                          alt={item.name}
                          onError={(e) => { e.target.src = "/placeholder.png"; }}
                          className="w-10 h-10 object-cover rounded-lg border border-[#e8e5f0] dark:border-white/[0.07]"
                        />
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#6d4aff] dark:bg-[#c9a96e] text-white dark:text-[#0a0a0f] text-[9px] font-bold rounded-full flex items-center justify-center">
                          {item.quantity}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-[#1a1060] dark:text-[#f0ede8] truncate">
                          {item.name}
                        </p>
                        {item.variant && (
                          <p className="text-[10px] text-[#1a1060]/40 dark:text-[#f0ede8]/30">{item.variant}</p>
                        )}
                      </div>
                      <p className="text-[11px] font-bold text-[#1a1060] dark:text-[#f0ede8] shrink-0">
                        ₱{(item.price * item.quantity).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-[#e8e5f0] dark:border-white/[0.07] pt-3 flex flex-col gap-2">
                <div className="flex justify-between text-xs text-[#1a1060]/50 dark:text-[#f0ede8]/40">
                  <span>Subtotal ({items.length} item{items.length !== 1 ? "s" : ""})</span>
                  <span>₱{total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#1a1060]/50 dark:text-[#f0ede8]/40">Shipping</span>
                  <span className="text-green-500 font-semibold">Free</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-[#1a1060] dark:text-[#f0ede8] mt-1">
                  <span>Total</span>
                  <span>₱{total.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting || items.length === 0 || invalidItems.length === items.length}
                className={`w-full mt-4 rounded-xl py-3.5 text-sm font-bold transition
                  ${submitting || items.length === 0 || invalidItems.length === items.length
                    ? "bg-[#e8e5f0] dark:bg-white/10 text-[#1a1060]/30 dark:text-[#f0ede8]/30 cursor-not-allowed"
                    : "bg-[#6d4aff] dark:bg-[#c9a96e] text-white dark:text-[#0a0a0f] hover:opacity-90"}`}
              >
                {submitting ? "Placing Order..." : `Place Order · ₱${total.toLocaleString()}`}
              </button>

              <p className="text-[11px] text-[#1a1060]/40 dark:text-[#f0ede8]/30 text-center mt-3 leading-relaxed">
                🔒 Secured checkout · Cash on Delivery only
              </p>
            </div>

            <button
              onClick={() => router.back()}
              className="text-xs text-[#1a1060]/50 dark:text-[#f0ede8]/40 hover:text-[#6d4aff] dark:hover:text-[#c9a96e] transition text-center"
            >
              ← Back to Cart
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f0eeff] dark:bg-[#0a0a0f] flex items-center justify-center">
          <p className="text-sm text-[#1a1060]/50 dark:text-[#f0ede8]/40">Loading checkout...</p>
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}