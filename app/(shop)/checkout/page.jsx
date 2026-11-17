"use client";
import ActionFeedback from "@/components/ui/ActionFeedback";
import ConfirmModal from "@/components/ui/ConfirmModal";
import FeedbackModal from "@/components/ui/FeedbackModal";
import ListingLocation from "@/components/products/ListingLocation";
import PaymentMethodPicker from "@/components/payments/PaymentMethodPicker";
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
  const [actionError, setActionError] = useState("");
  const [confirmOrderOpen, setConfirmOrderOpen] = useState(false);
  const [orderDone, setOrderDone] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [onlinePayments, setOnlinePayments] = useState({enabled:false,methods:[]});

  useEffect(() => {
    fetch("/api/payments/config").then(response => response.json()).then(setOnlinePayments).catch(() => {});
  }, []);

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
        department: product.department,
        meetup_point: product.meetup_point,
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
        department: item.department,
        meetup_point: item.meetup_point,
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
    if (submitting) return;
    setActionError("");
    if (!name || !email || !address) return setActionError("Please fill in all fields!");
    if (!email.endsWith("@lspu.edu.ph")) return setActionError("Please use your LSPU email!");
    if (items.length === 0) return setActionError("No items to checkout!");
    if (invalidItems.length > 0)
      return setActionError("Some items in your cart are invalid. Please remove them and try again.");

    setSubmitting(true);
    try {
      const checkoutFingerprint = JSON.stringify({ method: paymentMethod, items: items.map(item => [item.product_id, item.quantity, item.variant]) });
      if (sessionStorage.getItem("piyumart-checkout-fingerprint") !== checkoutFingerprint || !sessionStorage.getItem("piyumart-checkout-key")) {
        sessionStorage.setItem("piyumart-checkout-fingerprint", checkoutFingerprint);
        sessionStorage.setItem("piyumart-checkout-key", crypto.randomUUID());
      }
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": sessionStorage.getItem("piyumart-checkout-key") },
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
  setActionError(err.error || "Unable to place your order. Please try again.");
  setSubmitting(false);
  return;
}

const result = await res.json();
if (result.paymentId) {
  if (result.checkoutUrl) window.location.assign(result.checkoutUrl);
  else router.push(`/payments/${result.paymentId}`);
  return;
}
sessionStorage.removeItem("piyumart-checkout-key");
sessionStorage.removeItem("piyumart-checkout-fingerprint");
setOrderDone(true);
    } catch (err) {
      console.error(err);
      setActionError("Unable to place your order. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full py-2.5 px-3.5 rounded-xl border-[1.5px] border-[#c5cfe8] dark:border-white/10 bg-[#f0f4ff] dark:bg-white/[0.06] text-[#0e1a3d] dark:text-[#e8edf8] placeholder:text-[#0e1a3d]/30 dark:placeholder:text-[#e8edf8]/30 text-sm outline-none focus:border-[#1a2a6c] dark:focus:border-[#c9a028] transition-colors";

  if (status === "loading" || loading)
    return (
      <div className="min-h-screen bg-[#f0eeff] dark:bg-[#070b14] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-[3px] border-[#c5cfe8] dark:border-white/10 border-t-[#1a2a6c] dark:border-t-[#c9a028] rounded-full mx-auto mb-4 animate-spin" />
          <p className="text-sm text-[#0e1a3d]/50 dark:text-[#e8edf8]/40">Loading checkout...</p>
        </div>
      </div>
    );

  if (orderDone)
    return (
      <main className="min-h-screen bg-[#f0eeff] dark:bg-[#070b14]"><FeedbackModal open type="success" title="Order placed!" description="Thank you for your purchase, Ka PIYU. Your order has been saved and is ready to view." actionText="View my orders" onClose={() => router.push("/my-orders")} /></main>
    );

  return (
    <main className="min-h-screen bg-[#f0eeff] dark:bg-[#070b14] transition-colors duration-300">
      {/* HERO */}
      <section className="bg-[#1a2a6c] dark:bg-[#0a0e1f] border-b border-[#c5cfe8] dark:border-white/[0.07] px-4 sm:px-5 py-10 sm:py-12 text-center">
        <div className="inline-flex items-center gap-2 bg-white/10 text-[#c9a028] text-[11px] font-bold px-4 py-1.5 rounded-full mb-4 uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-[#c9a028]" />
          Secure Checkout
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          Checkout
        </h1>
        <p className="mt-2 text-sm text-white/60">
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
            <div className="bg-white dark:bg-[#0e1520] rounded-2xl border border-[#c5cfe8] dark:border-white/[0.07] p-5 sm:p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-7 h-7 rounded-lg bg-[#1a2a6c] dark:bg-[#c9a028] flex items-center justify-center text-xs font-bold text-white dark:text-[#0a0e1f]">
                  1
                </div>
                <h2 className="text-sm font-bold text-[#0e1a3d] dark:text-[#e8edf8]">Contact Information</h2>
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#0e1a3d]/50 dark:text-[#e8edf8]/40 uppercase tracking-wider block mb-1.5">
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
                  <label className="text-[11px] font-semibold text-[#0e1a3d]/50 dark:text-[#e8edf8]/40 uppercase tracking-wider block mb-1.5">
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
            <div className="bg-white dark:bg-[#0e1520] rounded-2xl border border-[#c5cfe8] dark:border-white/[0.07] p-5 sm:p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-7 h-7 rounded-lg bg-[#1a2a6c] dark:bg-[#c9a028] flex items-center justify-center text-xs font-bold text-white dark:text-[#0a0e1f]">
                  2
                </div>
                <h2 className="text-sm font-bold text-[#0e1a3d] dark:text-[#e8edf8]">Pick-up point</h2>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#0e1a3d]/50 dark:text-[#e8edf8]/40 uppercase tracking-wider block mb-1.5">
                  fill up pick-up point
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Deprtment, Room, Canteen, etc."
                  rows={3}
                  className={`${inputClass} resize-y font-[inherit]`}
                />
              </div>
            </div>

            {/* Payment */}
            <div className="bg-white dark:bg-[#0e1520] rounded-2xl border border-[#c5cfe8] dark:border-white/[0.07] p-5 sm:p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-7 h-7 rounded-lg bg-[#1a2a6c] dark:bg-[#c9a028] flex items-center justify-center text-xs font-bold text-white dark:text-[#0a0e1f]">
                  3
                </div>
                <h2 className="text-sm font-bold text-[#0e1a3d] dark:text-[#e8edf8]">Payment Method</h2>
              </div>
              <PaymentMethodPicker value={paymentMethod} onChange={setPaymentMethod}
                onlineEnabled={onlinePayments.enabled} disabled={submitting} />
            </div>

            {/* Shopee-style: Items grouped by seller */}
            <div className="bg-white dark:bg-[#0e1520] rounded-2xl border border-[#c5cfe8] dark:border-white/[0.07] p-5 sm:p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-7 h-7 rounded-lg bg-[#1a2a6c] dark:bg-[#c9a028] flex items-center justify-center text-xs font-bold text-white dark:text-[#0a0e1f]">
                  4
                </div>
                <h2 className="text-sm font-bold text-[#0e1a3d] dark:text-[#e8edf8]">Order Items</h2>
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-[#0e1a3d]/50 dark:text-[#e8edf8]/40">No items to checkout.</p>
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
                        <div className="flex items-center gap-2 pb-2 border-b border-[#c5cfe8] dark:border-white/[0.07]">
                          <span className="text-[11px]">🏪</span>
                          <span className="text-xs font-bold text-[#1a2a6c] dark:text-[#c9a028]">
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
                              className="w-14 h-14 object-cover rounded-xl shrink-0 border border-[#c5cfe8] dark:border-white/[0.07]"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-[#0e1a3d] dark:text-[#e8edf8] truncate">
                                {item.name}
                              </p>
                              {item.variant && (
                                <span className="inline-block mt-0.5 text-[10px] bg-[#f0f4ff] dark:bg-white/[0.06] text-[#1a2a6c] dark:text-[#c9a028] px-2 py-0.5 rounded-full">
                                  {item.variant}
                                </span>
                              )}
                              <p className="text-[11px] text-[#0e1a3d]/50 dark:text-[#e8edf8]/40 mt-0.5">
                                Qty: {item.quantity} × ₱{Number(item.price).toLocaleString()}
                              </p>
                            </div>
                            <p className="text-xs font-bold text-[#0e1a3d] dark:text-[#e8edf8] shrink-0">
                              ₱{(item.price * item.quantity).toLocaleString()}
                            </p>
                          </div>
                        ))}

                        {/* Seller subtotal */}
                        <div className="flex justify-between items-center pt-2 border-t border-dashed border-[#c5cfe8] dark:border-white/[0.07]">
                          <span className="text-[11px] text-[#0e1a3d]/40 dark:text-[#e8edf8]/30">
                            Subtotal ({sellerItems.length} item{sellerItems.length > 1 ? "s" : ""})
                          </span>
                          <span className="text-xs font-bold text-[#1a2a6c] dark:text-[#c9a028]">
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
            <div className="bg-white dark:bg-[#0e1520] rounded-2xl border border-[#c5cfe8] dark:border-white/[0.07] p-5">
                <h3 className="text-sm font-bold text-[#0e1a3d] dark:text-[#e8edf8] mb-4">
                Order Summary
              </h3>

              {/* Compact items list */}
              {items.length === 0 ? (
                <p className="text-sm text-[#0e1a3d]/50 dark:text-[#e8edf8]/40">No items to checkout.</p>
              ) : (
                <div className="flex flex-col gap-2.5 mb-4">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex gap-2.5 items-center">
                      <div className="relative shrink-0">
                        <img
                          src={item.image_url || "/placeholder.png"}
                          alt={item.name}
                          onError={(e) => { e.target.src = "/placeholder.png"; }}
                          className="w-10 h-10 object-cover rounded-lg border border-[#c5cfe8] dark:border-white/[0.07]"
                        />
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#1a2a6c] dark:bg-[#c9a028] text-white dark:text-[#0a0e1f] text-[9px] font-bold rounded-full flex items-center justify-center">
                          {item.quantity}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-[#0e1a3d] dark:text-[#e8edf8] truncate">
                          {item.name}
                        </p>
                        <ListingLocation product={item} className="mt-1" />
                        {item.variant && (
                          <p className="text-[10px] text-[#0e1a3d]/40 dark:text-[#e8edf8]/30">{item.variant}</p>
                        )}
                      </div>
                      <p className="text-[11px] font-bold text-[#0e1a3d] dark:text-[#e8edf8] shrink-0">
                        ₱{(item.price * item.quantity).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-[#c5cfe8] dark:border-white/[0.07] pt-3 flex flex-col gap-2">
                <div className="flex justify-between text-xs text-[#0e1a3d]/50 dark:text-[#e8edf8]/40">
                  <span>Subtotal ({items.length} item{items.length !== 1 ? "s" : ""})</span>
                  <span>₱{total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#0e1a3d]/50 dark:text-[#e8edf8]/40">Shipping</span>
                  <span className="text-green-500 font-semibold">Free</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-[#0e1a3d] dark:text-[#e8edf8] mt-1">
                  <span>Total</span>
                  <span>₱{total.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={() => setConfirmOrderOpen(true)}
                disabled={submitting || items.length === 0 || invalidItems.length === items.length}
                className={`w-full mt-4 rounded-xl py-3.5 text-sm font-bold transition
                  ${submitting || items.length === 0 || invalidItems.length === items.length
                    ? "bg-[#e8edf8] dark:bg-white/10 text-[#0e1a3d]/30 dark:text-[#e8edf8]/30 cursor-not-allowed"
                    : "bg-[#1a2a6c] dark:bg-[#c9a028] text-white dark:text-[#0a0e1f] hover:opacity-90"}`}
              >
                {submitting ? "Placing Order..." : `Place Order · ₱${total.toLocaleString()}`}
              </button>

              <p className="text-[11px] text-[#0e1a3d]/40 dark:text-[#e8edf8]/30 text-center mt-3 leading-relaxed">
                🔒 Secured checkout · Cash on Pick-up only
              </p>
            </div>

            <button
              onClick={() => router.back()}
              className="text-xs text-[#0e1a3d]/50 dark:text-[#e8edf8]/40 hover:text-[#1a2a6c] dark:hover:text-[#c9a028] transition text-center"
            >
              ← Back to Cart
            </button>
          </div>
        </div>
      </section>
      <ConfirmModal open={confirmOrderOpen} title="Place this order?" description={`Confirm your order for ₱${total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}. ${paymentMethod === "paymongo" ? "You will continue to the secure payment step." : "Payment will be collected on pickup."}`} confirmText="Place order" cancelText="Review order" onCancel={() => setConfirmOrderOpen(false)} onConfirm={async () => { setConfirmOrderOpen(false); await handleSubmit(); }} loadingText="Placing your order" />
    <ActionFeedback pending={submitting} error={actionError} showLoading={false} pendingTitle="Placing your order" pendingDescription="Reserving your items and preparing the payment step. Please avoid submitting again." />
      </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f0eeff] dark:bg-[#070b14] flex items-center justify-center">
          <p className="text-sm text-[#0e1a3d]/50 dark:text-[#e8edf8]/40">Loading checkout...</p>
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
