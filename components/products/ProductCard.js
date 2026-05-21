"use client";
import { useState } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useSentiment } from '@/app/hooks/useSentiment';
import LoadingModal from "@/components/ui/LoadingModal";

export default function ProductCard({
  product,
  hideActions = false,
  onClick,
  onAddToCart,
  onBuyNow,
  priority = false,
}) {
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

  const sentimentUI = () => {
  if (!sentiment) return null;

  const isNoReviews = sentiment.label === "NO_REVIEWS";

  const config = {
    positive: {
      icon: "😊",
      text: "Good",
      bg: "bg-green-50",
      textColor: "text-green-600",
      border: "border-green-200",
    },
    negative: {
      icon: "😡",
      text: "Low rated",
      bg: "bg-red-50",
      textColor: "text-red-600",
      border: "border-red-200",
      extra: "animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.65)]",
    },
    mixed: {
      icon: "😐",
      text: "Mixed",
      bg: "bg-yellow-50",
      textColor: "text-yellow-600",
      border: "border-yellow-200",
    },
    noreviews: {
      icon: "📭",
      text: "No reviews",
      bg: "bg-red-50",
      textColor: "text-red-600",
      border: "border-red-200",
      extra: "animate-pulse",
    },
  };

  const type = isNoReviews ? "noreviews" : sentiment.tone;
  const c = config[type];

  return (
    <span
      className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${c.bg} ${c.textColor} ${c.border} ${c.extra || ""}`}
    >
      <span>{c.icon}</span>
      <span>
        {c.text}
        {sentiment.averageRating
          ? ` ${Number(sentiment.averageRating).toFixed(1)}`
          : ""}
      </span>
    </span>
  );
};

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
            src={
              product.image_url?.trim()
                ? product.image_url
                : "https://via.placeholder.com/400x300?text=No+Image"
            }
            alt={product.name}
            width={400}
            height={400}
            priority={priority}
            loading={priority ? "eager" : "lazy"}
            unoptimized
            className="w-full h-full object-cover"
            style={{
              filter: isOutOfStock ? "grayscale(40%)" : "none",
            }}
          />

          {isOutOfStock && (
            <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
              <span className="bg-[#e94560] text-white text-[10px] sm:text-[12px] font-bold px-3 py-1 rounded-full tracking-wide">
                Out of Stock
              </span>
            </div>
          )}
        </div>

        {/* CONTENT */}
        <div className="flex flex-col flex-1 p-2.5 sm:p-[14px] overflow-hidden">

          <h2 className="text-[12px] sm:text-[16px] font-semibold leading-tight line-clamp-2 text-[#1a1a2e] mb-1 overflow-hidden trim whitespace-nowrap">
            {product.name}
          </h2>

          <p className="hidden sm:block text-[12px] text-[#777] h-8 overflow-hidden mb-1">
            {product.description}
          </p>

          <p className="text-[13px] sm:text-[16px] font-bold text-[#e94560] mt-auto pt-1">
            ₱{Number(product.price).toLocaleString()}
          </p>

          {/* SENTIMENT */}
          <div className="flex flex-col sm:flex-row mt-2 gap-1.5">
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

            {sentimentUI()}
          </div>

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