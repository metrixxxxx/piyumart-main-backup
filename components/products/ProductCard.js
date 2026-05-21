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

          {/* PRODUCT NAME */}
          <h2 className="text-[12px] sm:text-[16px] font-semibold leading-tight line-clamp-2 text-[#1a1a2e] mb-1 overflow-hidden">
            {product.name}
          </h2>

          {/* DESCRIPTION */}
          <p className="hidden sm:block text-[12px] text-[#777] h-8 overflow-hidden mb-1">
            {product.description}
          </p>

          {/* SELLER NAME */}
          {product.seller_name && (
            <button
              onClick={handleSellerClick}
              className="w-fit text-[10px] sm:text-[11px] text-[#1a1a2e]/60 hover:text-[#e94560] hover:underline transition-colors truncate mb-1 text-left"
            >
              🏪 {product.seller_name}
            </button>
          )}

          {/* RATING + SOLD */}
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            {product.average_rating > 0 && (
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => {
                  const filled = i < Math.floor(product.average_rating);
                  const half =
                    !filled &&
                    i < product.average_rating &&
                    product.average_rating % 1 >= 0.5;
                  return (
                    <svg
                      key={i}
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      className="w-[10px] h-[10px] sm:w-3 sm:h-3"
                      fill={filled ? "#f59e0b" : half ? "url(#half)" : "#e5e7eb"}
                    >
                      {half && (
                        <defs>
                          <linearGradient id="half">
                            <stop offset="50%" stopColor="#f59e0b" />
                            <stop offset="50%" stopColor="#e5e7eb" />
                          </linearGradient>
                        </defs>
                      )}
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  );
                })}
                <span className="text-[10px] sm:text-[11px] text-[#777] ml-0.5">
                  {Number(product.average_rating).toFixed(1)}
                </span>
                {product.total_ratings > 0 && (
                  <span className="text-[10px] sm:text-[11px] text-[#aaa]">
                    ({product.total_ratings})
                  </span>
                )}
              </div>
            )}

            {product.total_sold > 0 && (
              <span className="text-[10px] sm:text-[11px] text-[#aaa]">
                · {product.total_sold >= 1000
                  ? `${(product.total_sold / 1000).toFixed(1)}k`
                  : product.total_sold} sold
              </span>
            )}
          </div>

          {/* PRICE + STOCK */}
          <div className="flex items-end justify-between mt-auto pt-1 gap-1">
            <p className="text-[13px] sm:text-[16px] font-bold text-[#e94560]">
              ₱{Number(product.price).toLocaleString()}
            </p>
            {!isOutOfStock && product.stock > 0 && (
              <span
                className={`text-[9px] sm:text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
                  product.stock <= 5
                    ? "bg-orange-50 text-orange-500 border border-orange-200"
                    : "bg-green-50 text-green-600 border border-green-200"
                }`}
              >
                {product.stock <= 5 ? `⚠ ${product.stock} left` : `✓ ${product.stock} available`}
              </span>
            )}
          </div>

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