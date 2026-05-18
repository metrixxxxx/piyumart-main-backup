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

  const items = isBuyNow && product ? [{ ...product, quantity }] : cartItems;
  const total = items.reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0);

  // ✅ FIXED: single POST with all items instead of one POST per item
  async function handleSubmit() {
    if (!name || !email || !address) return alert("Please fill in all fields!");
    if (!email.endsWith("@lspu.edu.ph")) return alert("Please use your LSPU email!");
    if (items.length === 0) return alert("No items to checkout!");
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
          items: items.map((item) => ({
            product_id: item.product_id ?? item.id,
            quantity: item.quantity || 1,
            price: parseFloat(item.price),
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

  const inputClass = "w-full py-2.5 px-3.5 rounded-xl border-[1.5px] border-[#e8e5f0] dark:border-white/10 bg-[#f5f3ff] dark:bg-white/[0.06] text-[#1a1060] dark:text-[#f0ede8] placeholder:text-[#1a1060]/30 dark:placeholder:text-[#f0ede8]/30 text-sm outline-none focus:border-[#6d4aff] dark:focus:border-[#c9a96e] transition-colors";

  if (status === "loading" || loading) return (
    <div className="min-h-screen bg-[#f0eeff] dark:bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-[3px] border-[#e8e5f0] dark:border-white/10 border-t-[#6d4aff] dark:border-t-[#c9a96e] rounded-full mx-auto mb-4 animate-spin" />
        <p className="text-sm text-[#1a1060]/50 dark:text-[#f0ede8]/40">Loading checkout...</p>
      </div>
    </div>
  );

  if (orderDone) return (
    <div className="min-h-screen bg-[#f0eeff] dark:bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-center px-12 py-14 bg-white dark:bg-[#12121a] rounded-2xl border border-[#e8e5f0] dark:border-white/[0.07]">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-xl font-bold text-[#1a1060] dark:text-[#f0ede8] mb-2">Order Placed!</h2>
        <p className="text-sm text-[#1a1060]/50 dark:text-[#f0ede8]/40">Redirecting to your orders...</p>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#f0eeff] dark:bg-[#0a0a0f] transition-colors duration-300">

      {/* HERO */}
      <section className="bg-white dark:bg-[#0a0a0f] border-b border-[#e8e5f0] dark:border-white/[0.07] px-5 py-12 text-center">
        <div className="inline-flex items-center gap-2 bg-[#ede9ff] dark:bg-[#c9a96e]/10 text-[#6d4aff] dark:text-[#c9a96e] text-[11px] font-bold px-4 py-1.5 rounded-full mb-4 uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-[#6d4aff] dark:bg-[#c9a96e]" />
          Secure Checkout
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#1a1060] dark:text-[#f0ede8]">Checkout</h1>
        <p className="mt-2 text-sm text-[#1a1060]/50 dark:text-[#f0ede8]/45">
          {items.length} item{items.length !== 1 ? "s" : ""} · ₱{total.toLocaleString()} total
        </p>
      </section>

      <section className="max-w-[960px] mx-auto px-5 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">

          {/* LEFT — Delivery Details */}
          <div className="flex flex-col gap-4">

            {/* Contact */}
            <div className="bg-white dark:bg-[#12121a] rounded-2xl border border-[#e8e5f0] dark:border-white/[0.07] p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-7 h-7 rounded-lg bg-[#6d4aff] dark:bg-[#c9a96e] flex items-center justify-center text-xs font-bold text-white dark:text-[#0a0a0f]">1</div>
                <h2 className="text-sm font-bold text-[#1a1060] dark:text-[#f0ede8]">Contact Information</h2>
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#1a1060]/50 dark:text-[#f0ede8]/40 uppercase tracking-wider block mb-1.5">Full Name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Juan dela Cruz" className={inputClass} />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#1a1060]/50 dark:text-[#f0ede8]/40 uppercase tracking-wider block mb-1.5">LSPU Email</label>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="yourname@lspu.edu.ph" className={inputClass} />
                </div>
              </div>
            </div>

            {/* Delivery */}
            <div className="bg-white dark:bg-[#12121a] rounded-2xl border border-[#e8e5f0] dark:border-white/[0.07] p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-7 h-7 rounded-lg bg-[#6d4aff] dark:bg-[#c9a96e] flex items-center justify-center text-xs font-bold text-white dark:text-[#0a0a0f]">2</div>
                <h2 className="text-sm font-bold text-[#1a1060] dark:text-[#f0ede8]">Delivery Address</h2>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#1a1060]/50 dark:text-[#f0ede8]/40 uppercase tracking-wider block mb-1.5">Full Address</label>
                <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Building, Street, Barangay, City, Province" rows={3} className={`${inputClass} resize-y font-[inherit]`} />
              </div>
            </div>

            {/* Payment */}
            <div className="bg-white dark:bg-[#12121a] rounded-2xl border border-[#e8e5f0] dark:border-white/[0.07] p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-7 h-7 rounded-lg bg-[#6d4aff] dark:bg-[#c9a96e] flex items-center justify-center text-xs font-bold text-white dark:text-[#0a0a0f]">3</div>
                <h2 className="text-sm font-bold text-[#1a1060] dark:text-[#f0ede8]">Payment Method</h2>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-xl border-[1.5px] border-[#6d4aff] dark:border-[#c9a96e] bg-[#f5f3ff] dark:bg-[#c9a96e]/5 cursor-pointer">
                <div className="w-9 h-9 rounded-lg bg-[#6d4aff] dark:bg-[#c9a96e] flex items-center justify-center text-lg shrink-0">💵</div>
                <div>
                  <p className="text-sm font-semibold text-[#1a1060] dark:text-[#f0ede8]">Cash on Delivery</p>
                  <p className="text-xs text-[#1a1060]/50 dark:text-[#f0ede8]/40">Pay when your order arrives</p>
                </div>
                <div className="ml-auto w-4 h-4 rounded-full bg-[#6d4aff] dark:bg-[#c9a96e] flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-[#0a0a0f]" />
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — Order Summary */}
          <div className="sticky top-6 flex flex-col gap-3">
            <div className="bg-white dark:bg-[#12121a] rounded-2xl border border-[#e8e5f0] dark:border-white/[0.07] p-5">
              <h3 className="text-sm font-bold text-[#1a1060] dark:text-[#f0ede8] mb-4">Order Summary</h3>

              {items.length === 0 ? (
                <p className="text-sm text-[#1a1060]/50 dark:text-[#f0ede8]/40">No items to checkout.</p>
              ) : (
                <div className="flex flex-col gap-3 mb-4">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex gap-3 items-center">
                      <img src={item.image_url || "/placeholder.png"} alt={item.name} className="w-12 h-12 object-cover rounded-xl shrink-0 border border-[#e8e5f0] dark:border-white/[0.07]" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#1a1060] dark:text-[#f0ede8] truncate">{item.name}</p>
                        <p className="text-[11px] text-[#1a1060]/50 dark:text-[#f0ede8]/40">Qty: {item.quantity}</p>
                      </div>
                      <p className="text-xs font-bold text-[#1a1060] dark:text-[#f0ede8] shrink-0">₱{(item.price * item.quantity).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-[#e8e5f0] dark:border-white/[0.07] pt-3 flex flex-col gap-2">
                <div className="flex justify-between text-xs text-[#1a1060]/50 dark:text-[#f0ede8]/40">
                  <span>Subtotal</span><span>₱{total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#1a1060]/50 dark:text-[#f0ede8]/40">Shipping</span>
                  <span className="text-green-500 font-semibold">Free</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-[#1a1060] dark:text-[#f0ede8] mt-1">
                  <span>Total</span><span>₱{total.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting || items.length === 0}
                className={`w-full mt-4 rounded-xl py-3.5 text-sm font-bold transition
                  ${submitting || items.length === 0
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
    <Suspense fallback={
      <div className="min-h-screen bg-[#f0eeff] dark:bg-[#0a0a0f] flex items-center justify-center">
        <p className="text-sm text-[#1a1060]/50 dark:text-[#f0ede8]/40">Loading checkout...</p>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}