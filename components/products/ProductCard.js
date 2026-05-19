"use client";
import { useState } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useSentiment } from '@/app/hooks/useSentiment';
import LoadingModal from "@/components/ui/LoadingModal";

export default function ProductCard({ product, hideActions = false, onClick, onAddToCart, onBuyNow }) {
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();

  const { analyze, result: sentiment, loading: sentimentLoading } = useSentiment();

  const isOutOfStock = product.stock === 0;

  async function handleAddToCart(e) {
    e.stopPropagation();
    if (!session) { setShowModal(true); return; }
    setLoading(true);
    try {
      await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: product.id, quantity: 1 }),
      });
      router.push("/cart");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleBuyNow(e) {
    e.stopPropagation();
    if (!session) { setShowModal(true); return; }
    router.push(`/checkout?productId=${product.id}`);
  }

  function handleSellerClick(e) {
    e.stopPropagation();
    if (product.seller_id) router.push(`/seller/${product.seller_id}`);
  }

  return (
    <>
      {/* CARD */}
      <div
        onClick={() => {
          if (onClick) return onClick();
          return router.push(`/products/${product.id}`);
        }}
        className="group flex flex-col cursor-pointer rounded-xl sm:rounded-[14px] border border-[#eee] bg-white overflow-hidden transition-transform duration-200 hover:-translate-y-[3px]"
        style={{ opacity: isOutOfStock ? 0.8 : 1 }}
      >
        {/* IMAGE */}
        <div className="aspect-square sm:aspect-[4/3] overflow-hidden relative">
          <Image
            src={product.image_url?.trim() ? product.image_url : "https://via.placeholder.com/400x300?text=No+Image"}
            alt={product.name}
            width={400}
            height={400}
            unoptimized
            className="w-full h-full object-cover"
            style={{ filter: isOutOfStock ? "grayscale(40%)" : "none" }}
          />

          {/* OUT OF STOCK OVERLAY */}
          {isOutOfStock && (
            <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
              <span className="bg-[#e94560] text-white text-[10px] sm:text-[12px] font-bold px-3 py-1 rounded-full tracking-wide">
                Out of Stock
              </span>
            </div>
          )}
        </div>

        {/* CONTENT */}
        <div className="flex flex-col flex-1 p-2.5 sm:p-[14px]">

          {/* NAME */}
          <h2 className="text-[12px] sm:text-[16px] font-semibold leading-tight line-clamp-2 text-[#1a1a2e] mb-1">
            {product.name}
          </h2>

          {/* DESCRIPTION — hidden on mobile like Shopee */}
          <p className="hidden sm:block text-[12px] text-[#777] h-8 overflow-hidden mb-1">
            {product.description}
          </p>

          {/* PRICE — prominent, Shopee-style */}
          <p className="text-[13px] sm:text-[16px] font-bold text-[#e94560] mt-auto pt-1">
            ₱{Number(product.price).toLocaleString()}
          </p>

          {/* RATING & SOLD — compact on mobile */}
          <div className="flex items-center gap-2 mt-1 text-[10px] sm:text-[11px] text-[#666] flex-wrap">
            {product.average_rating > 0 && (
              <div className="flex items-center gap-0.5">
                <span className="text-[#FFB800]">⭐</span>
                <span className="font-semibold text-[#FFB800]">
                  {Number(product.average_rating).toFixed(1)}
                </span>
              </div>
            )}
            <span className="text-[#bbb] hidden sm:inline">·</span>
            <span className={`font-medium ${product.sold_count > 0 ? "text-[#16a34a]" : "text-[#999]"}`}>
              {product.sold_count || 0} sold
            </span>
          </div>

          {/* SELLER — hidden on mobile */}
          <div className="hidden sm:block mt-1.5">
            <p className="text-[11px] text-[#999]">
              Sold by:{" "}
              <button
                type="button"
                onClick={handleSellerClick}
                className="text-[#1f3c88] underline cursor-pointer bg-transparent border-none p-0 text-[11px]"
                style={{ all: "unset", cursor: product.seller_id ? "pointer" : "default", color: product.seller_id ? "#1f3c88" : "#999", textDecoration: product.seller_id ? "underline" : "none", fontSize: "11px" }}
              >
                {product.seller_name || "Unknown"}
              </button>
            </p>
            <p className={`text-[11px] mt-0.5 font-medium ${isOutOfStock ? "text-[#e94560]" : "text-[#16a34a]"}`}>
              {isOutOfStock ? "Unavailable" : `${product.stock} in stock`}
            </p>
          </div>

          {/* SENTIMENT — hidden on mobile */}
          <div className="hidden sm:flex mt-2 items-center gap-1.5 flex-wrap">
            <button
              onClick={(e) => {
                e.stopPropagation();
                analyze({
                  productId: product.id,
                  rating: product.average_rating,
                  totalReviews: product.total_ratings,
                  text: product.description,
                });
              }}
              disabled={sentimentLoading}
              className="text-[10px] px-2 py-0.5 rounded-full border border-[#ddd] bg-[#f9f9f9] text-[#555] cursor-pointer"
            >
              {sentimentLoading ? "..." : "Review insight"}
            </button>
            {sentiment && (
              <span className="text-[10px] font-semibold" style={{
                color: sentiment.tone === "negative" ? "#e94560" : sentiment.tone === "mixed" ? "#c9a028" : "#16a34a",
              }}>
                {sentiment.label === "NO_REVIEWS" ? "No reviews" : sentiment.tone === "negative" ? "Low rated" : sentiment.tone === "mixed" ? "Mixed" : "Good"}
                {sentiment.averageRating ? ` ${Number(sentiment.averageRating).toFixed(1)}` : ""}
              </span>
            )}
          </div>

          {/* BUTTONS */}
          {!hideActions && (
            <div className="flex gap-1.5 sm:gap-2 mt-2 sm:mt-3">
              <button
                onClick={(e) => { e.stopPropagation(); if (onAddToCart) return onAddToCart(e); return handleAddToCart(e); }}
                disabled={loading || isOutOfStock}
                className="flex-1 py-1.5 sm:py-2 rounded-lg text-[11px] sm:text-[12px] font-medium text-white transition-opacity"
                style={{ background: isOutOfStock ? "#ccc" : "#1a1a2e", cursor: isOutOfStock ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
              >
                {loading ? "..." : "Add"}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); if (onBuyNow) return onBuyNow(e); return handleBuyNow(e); }}
                disabled={loading || isOutOfStock}
                className="flex-1 py-1.5 sm:py-2 rounded-lg text-[11px] sm:text-[12px] font-medium bg-white transition-opacity"
                style={{ border: `1px solid ${isOutOfStock ? "#ccc" : "#1a1a2e"}`, color: isOutOfStock ? "#ccc" : "#1a1a2e", cursor: isOutOfStock ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
              >
                {loading ? "..." : "Buy Now"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODAL */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white p-6 rounded-xl w-[300px] text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[16px] font-semibold mb-2">Sign in required</h2>
            <p className="text-[13px] text-[#777] mb-4">You need to login first.</p>
            <button
              onClick={() => router.push("/login")}
              className="w-full py-2.5 bg-[#1a1a2e] text-white rounded-lg mb-2 text-sm"
            >
              Sign in
            </button>
            <button
              onClick={() => setShowModal(false)}
              className="w-full py-2.5 border border-[#ddd] rounded-lg text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <LoadingModal
        open={loading}
        title="Adding to cart"
        description="Saving this product to your cart."
      />
    </>
  );
}