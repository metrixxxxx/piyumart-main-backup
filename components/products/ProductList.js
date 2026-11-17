"use client";
import ActionFeedback from "@/components/ui/ActionFeedback";
import LoginRequiredModal from "@/components/ui/LoginRequiredModal";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useSentiment } from "@/app/hooks/useSentiment";

export default function ProductCard({ product }) {
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();

  const { analyze, result: sentiment, loading: sentimentLoading } = useSentiment();
  const isOutOfStock = product.stock === 0;

  async function handleAddToCart(e) {
    e.stopPropagation();
    if (loading) return;
    if (!session) { setShowModal(true); return; }
    setLoading(true); setActionError("");
    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: product.id, quantity: 1 }),
      });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Unable to add this item to your cart."); }
      router.push("/cart");
    } catch (err) {
      console.error(err);
      setActionError(err.message || "Unable to update your cart. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleBuyNow(e) {
    e.stopPropagation();
    if (!session) { setShowModal(true); return; }
    router.push(`/checkout?productId=${product.id}`);
  }

  return (
    <>
      {/* ── CARD ── */}
      <div
        onClick={() => router.push(`/products/${product.id}`)}
        className={`flex flex-col justify-between rounded-[14px] overflow-hidden border cursor-pointer transition-all duration-200 hover:-translate-y-1
          bg-white dark:bg-white/[0.04]
          border-[#e8e5f0] dark:border-white/[0.07]
          ${isOutOfStock ? "opacity-80" : "opacity-100"}
        `}
      >
        {/* IMAGE */}
        <div className="h-[180px] overflow-hidden relative">
          <img
            src={product.image_url?.trim() ? product.image_url : "https://via.placeholder.com/400x300?text=No+Image"}
            alt={product.name}
            className={`w-full h-full object-cover ${isOutOfStock ? "grayscale-[40%]" : ""}`}
          />

          {/* OUT OF STOCK OVERLAY */}
          {isOutOfStock && (
            <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
              <span className="bg-[#e94560] text-white text-[12px] font-bold tracking-wide px-4 py-1 rounded-full">
                Out of Stock
              </span>
            </div>
          )}
        </div>

        {/* CONTENT */}
        <div className="p-[14px] flex flex-col flex-1">

          {/* Name */}
          <h2 className="text-base font-semibold mb-1.5 text-[#1a1060] dark:text-[#f0ede8]">
            {product.name}
          </h2>

          {/* Description */}
          <p className="text-xs text-[#1a1060]/50 dark:text-[#f0ede8]/45 h-8 overflow-hidden">
            {product.description}
          </p>

          {/* VIBE CHECK */}
          <div className="mt-1.5 flex items-center gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); analyze(product.description); }}
              disabled={sentimentLoading || !product.description}
              className="text-[10px] px-2 py-0.5 rounded-full border border-[#e8e5f0] dark:border-white/10 bg-[#f9f9f9] dark:bg-white/[0.04] text-[#555] dark:text-[#f0ede8]/50 cursor-pointer transition-colors hover:border-[#6d4aff] dark:hover:border-[#c9a96e]"
            >
              {sentimentLoading ? "..." : "🔍 Vibe check"}
            </button>

            {sentiment && (
              <span className={`text-[10px] font-semibold ${sentiment.label === "POSITIVE" ? "text-[#16a34a]" : "text-[#e94560]"}`}>
                {sentiment.label === "POSITIVE" ? "😊 Good" : "😞 Poor"} {(sentiment.score * 100).toFixed(0)}%
              </span>
            )}
          </div>

          {/* Price + Seller + Stock */}
          <div className="mt-2.5">
            <p className="text-base font-bold text-[#6d4aff] dark:text-[#c9a96e] text-left">
              ₱{Number(product.price).toLocaleString()}
            </p>
            <p className="text-[11px] text-[#1a1060]/40 dark:text-[#f0ede8]/35">
              Sold by: {product.seller_name || "Unknown"}
            </p>
            <p className={`text-[11px] mt-0.5 font-medium ${isOutOfStock ? "text-[#e94560]" : "text-[#16a34a]"}`}>
              {isOutOfStock ? "Unavailable" : `${product.stock} in stock`}
            </p>
          </div>

          {/* BUTTONS */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleAddToCart}
              disabled={loading || isOutOfStock}
              className={`flex-1 py-2 rounded-lg text-xs text-white font-medium transition-opacity
                ${isOutOfStock ? "bg-[#ccc] cursor-not-allowed" : "bg-[#1a1060] dark:bg-[#c9a96e] dark:text-[#0a0a0f] cursor-pointer hover:opacity-90"}
                ${loading ? "opacity-60" : ""}
              `}
            >
              {loading ? "..." : "Add"}
            </button>

            <button
              onClick={handleBuyNow}
              disabled={loading || isOutOfStock}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-opacity border
                ${isOutOfStock
                  ? "border-[#ccc] text-[#ccc] bg-white dark:bg-transparent cursor-not-allowed"
                  : "border-[#1a1060] dark:border-[#c9a96e] text-[#1a1060] dark:text-[#c9a96e] bg-white dark:bg-transparent cursor-pointer hover:opacity-80"
                }
                ${loading ? "opacity-60" : ""}
              `}
            >
              {loading ? "..." : "Buy Now"}
            </button>
          </div>
        </div>
      </div>

      {/* ── MODAL ── */}
      <LoginRequiredModal open={showModal} onClose={() => setShowModal(false)} />
    <ActionFeedback pending={loading} error={actionError} pendingTitle="Adding to your cart" />
    </>
  );
}
