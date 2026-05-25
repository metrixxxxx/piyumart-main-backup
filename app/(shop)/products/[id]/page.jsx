"use client";
import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import ProductCard from "@/components/products/ProductCard";
import { getSocket } from "@/lib/socket";
import ReviewsSection from "@/components/products/ReviewsSection";

function StarRating({ value }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} width="14" height="14" viewBox="0 0 20 20" fill={i <= Math.round(value) ? "#c9a96e" : "#d1d5db"}>
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
}

export default function ProductDetailPage() {
  const [product, setProduct] = useState(null);
  const [flyItem, setFlyItem] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const { data: session } = useSession();
  const router = useRouter();
  const { id } = useParams();

  useEffect(() => {
    async function fetchData() {
      try {
        const productRes = await fetch(`/api/products/${id}`);
        const productData = await productRes.json();
        setProduct(productData);
        setSelectedImageIndex(0);
        setSelectedVariant(null);

        const relRes = await fetch(
          `/api/products/related?id=${id}&category_id=${productData.category_id || ""}&seller_id=${productData.seller_id || ""}`
        );
        const relData = await relRes.json();
        setRelatedProducts(Array.isArray(relData) ? relData : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();

    const socket = getSocket();
    socket.on("products:updated", (updated) => {
      if (String(updated.id) === String(id)) setProduct((prev) => ({ ...prev, ...updated }));
      setRelatedProducts((prev) =>
        prev.map((p) => String(p.id) === String(updated.id) ? { ...p, ...updated } : p)
      );
    });
    socket.on("products:deleted", ({ id: deletedId }) => {
      if (String(deletedId) === String(id)) router.push("/products");
      setRelatedProducts((prev) => prev.filter((p) => String(p.id) !== String(deletedId)));
    });
    socket.on("products:new", (newProduct) => {
      setRelatedProducts((prev) => [newProduct, ...prev]);
    });
    return () => {
      socket.off("products:updated");
      socket.off("products:deleted");
      socket.off("products:new");
    };
  }, [id, router]);

  async function handleAddToCart() {
    if (!session) { setShowModal(true); return; }

    const img = document.querySelector(`img[alt='${product.name}']`);
    if (img) {
      const rect = img.getBoundingClientRect();
      setFlyItem({
        src: activeImage,
        start: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      });
    }

    setAddingToCart(true);
    const res = await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: product.id, quantity, variant: selectedVariant?.label || null }),
    });
    const data = await res.json();
    setAddingToCart(false);
    setTimeout(() => setFlyItem(null), 900);
    if (data.success) router.push("/cart");
  }

  async function handleBuyNow() {
    if (!session) { setShowModal(true); return; }
    router.push(
      `/checkout?productId=${product.id}&quantity=${quantity}${selectedVariant ? `&variant=${encodeURIComponent(selectedVariant.label)}` : ""}`
    );
  }

  async function handleChat() {
    if (!session) { setShowModal(true); return; }
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seller_id: product.seller_id, product_id: product.id }),
    });
    const data = await res.json();
    if (data.id) router.push(`/messages/${data.id}`);
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-[#f0eeff] dark:bg-[#0a0a0f]">
      <div className="text-center">
        <div className="w-10 h-10 border-[3px] border-[#e5e7eb] border-t-[#6d4aff] dark:border-t-[#c9a96e] rounded-full mx-auto mb-4 animate-spin" />
        <p className="text-[#1a1060]/50 dark:text-[#f0ede8]/40 text-sm">Loading product...</p>
      </div>
    </div>
  );

  if (!product) return (
    <div className="flex items-center justify-center min-h-screen bg-[#f0eeff] dark:bg-[#0a0a0f]">
      <p className="text-[#1a1060]/50 dark:text-[#f0ede8]/40 text-lg">Product not found.</p>
    </div>
  );

  const isOutOfStock = product.stock === 0;
  const allImages = product.images?.length > 0
    ? product.images
    : product.image_url ? [product.image_url] : ["/placeholder.png"];
  const activeImage = selectedVariant?.image_url || allImages[selectedImageIndex] || "/placeholder.png";
  const hasVariants = product.variants?.length > 0;

  // CORRECT — matches your schema
const rating = product.average_rating || 0;
const ratingCount = product.total_ratings || 0;
const soldCount = product.sold_count || 0;



  return (
    <div className="min-h-screen bg-[#f0eeff] dark:bg-[#0a0a0f] transition-colors duration-300">
      <div className="max-w-[1000px] mx-auto px-4 sm:px-5 py-6 sm:py-8 flex flex-col gap-3">

        {/* ── MAIN PRODUCT CARD ── */}
        <div className="bg-white dark:bg-[#12121a] rounded-2xl border border-[#e8e5f0] dark:border-white/[0.07] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.07)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
          <div className="grid grid-cols-1 md:grid-cols-[420px_1fr]">

            {/* LEFT — Image Gallery */}
            <div className="flex flex-col bg-[#fafafa] dark:bg-white/[0.02] border-b md:border-b-0 md:border-r border-[#f0f0f0] dark:border-white/[0.05]">
              <div className="relative aspect-square overflow-hidden">
                <img
                  key={activeImage}
                  src={activeImage}
                  alt={product.name}
                  className="w-full h-full object-cover block transition-opacity duration-200"
                />
                {allImages.length > 1 && (
                  <div className="absolute top-3 right-3 bg-black/50 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm font-medium">
                    {selectedVariant ? "variant" : `${selectedImageIndex + 1} / ${allImages.length}`}
                  </div>
                )}
                {isOutOfStock && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="bg-[#e94560] text-white px-6 py-2 rounded-full text-sm font-bold tracking-wide">Out of Stock</span>
                  </div>
                )}
              </div>

              {/* Thumbnails */}
              {allImages.length > 1 && (
                <div className="flex gap-2 p-3 overflow-x-auto border-t border-[#f0f0f0] dark:border-white/[0.05]">
                  {allImages.map((img, i) => {
                    const isActive = !selectedVariant && selectedImageIndex === i;
                    return (
                      <div
                        key={i}
                        onClick={() => { setSelectedImageIndex(i); setSelectedVariant(null); }}
                        className={`w-[60px] h-[60px] shrink-0 rounded-xl overflow-hidden cursor-pointer transition-all duration-150
                          ${isActive
                            ? "ring-2 ring-[#6d4aff] dark:ring-[#c9a96e] opacity-100"
                            : "ring-1 ring-transparent opacity-50 hover:opacity-75"
                          }`}
                      >
                        <img src={img} className="w-full h-full object-cover block" />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Share row */}
              <div className="flex items-center gap-2 px-4 py-3 border-t border-[#f0f0f0] dark:border-white/[0.05]">
                <span className="text-[11px] text-[#1a1060]/40 dark:text-[#f0ede8]/35 font-medium">Share:</span>
                {["M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4", "M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"].map((path, i) => (
                  <button key={i} className="w-7 h-7 rounded-full bg-[#f0eeff] dark:bg-white/[0.05] flex items-center justify-center hover:bg-[#ede9ff] dark:hover:bg-white/10 transition-colors">
                    <svg className="w-3.5 h-3.5 text-[#6d4aff] dark:text-[#c9a96e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
                    </svg>
                  </button>
                ))}
              </div>
            </div>

            {/* RIGHT — Product Info */}
            <div className="flex flex-col">

              {/* Top info section */}
              <div className="p-5 sm:p-6 flex flex-col gap-3 border-b border-[#f3f4f6] dark:border-white/[0.06]">

                {/* Preferred badge + category */}
                <div className="flex items-center gap-2 flex-wrap">
                  {product.category_name && (
                    <span className="inline-block bg-[#ede9ff] dark:bg-[#c9a96e]/10 text-[#6d4aff] dark:text-[#c9a96e] text-[10px] font-bold px-2.5 py-1 rounded-sm tracking-wide uppercase">
                      {product.category_name}
                    </span>
                  )}
                  {product.is_featured && (
                    <span className="inline-flex items-center gap-1 bg-[#1a1060] dark:bg-[#c9a96e] text-white dark:text-[#0a0a0f] text-[10px] font-bold px-2.5 py-1 rounded-sm tracking-wide uppercase">
                      ★ Featured
                    </span>
                  )}
                </div>

                <h1 className="text-[18px] sm:text-[20px] font-bold text-[#1a1060] dark:text-[#f0ede8] leading-snug m-0">
                  {product.name}
                </h1>
{/* Rating + Sold row — always show */}
<div className="flex items-center gap-3 flex-wrap">
  {ratingCount > 0 ? (
    <>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-bold text-[#c9a96e] underline decoration-dotted">{Number(rating).toFixed(1)}</span>
        <StarRating value={rating} />
      </div>
      <span className="w-px h-3.5 bg-[#e5e7eb] dark:bg-white/10" />
      <span className="text-[13px] text-[#1a1060]/50 dark:text-[#f0ede8]/40">
        <span className="font-semibold text-[#1a1060] dark:text-[#f0ede8]">{ratingCount.toLocaleString()}</span> Ratings
      </span>
    </>
  ) : (
    <>
      <StarRating value={0} />
      <span className="text-[13px] text-[#1a1060]/30 dark:text-[#f0ede8]/25">No ratings yet</span>
    </>
  )}
  {soldCount > 0 && (
    <>
      <span className="w-px h-3.5 bg-[#e5e7eb] dark:bg-white/10" />
      <span className="text-[13px] text-[#1a1060]/50 dark:text-[#f0ede8]/40">
        <span className="font-semibold text-[#1a1060] dark:text-[#f0ede8]">
          {soldCount >= 1000 ? `${(soldCount/1000).toFixed(1)}K+` : soldCount}
        </span> Sold
      </span>
    </>
  )}
</div>
              </div>

              {/* Price section — highlighted bg like Shopee */}
              <div className="px-5 sm:px-6 py-4 bg-[#faf9ff] dark:bg-white/[0.02] border-b border-[#f3f4f6] dark:border-white/[0.06] flex items-end gap-3">
                <span className="text-[28px] sm:text-[32px] font-extrabold text-[#A24857] dark:text-[#c9a96e] leading-none">
                  ₱{Number(product.price).toLocaleString()}
                </span>
                {product.original_price && Number(product.original_price) > Number(product.price) && (
                  <>
                    <span className="text-[16px] text-[#1a1060]/30 dark:text-[#f0ede8]/25 line-through font-medium mb-0.5">
                      ₱{Number(product.original_price).toLocaleString()}
                    </span>
                    <span className="bg-[#e94560] text-white text-xs font-bold px-2 py-0.5 rounded mb-0.5">
                      -{Math.round((1 - product.price / product.original_price) * 100)}%
                    </span>
                  </>
                )}
              </div>

              {/* Details section */}
              <div className="px-5 sm:px-6 py-4 flex flex-col gap-4 border-b border-[#f3f4f6] dark:border-white/[0.06]">

                {/* Shipping row */}
                <div className="flex items-start gap-4">
                  <span className="text-[13px] text-[#1a1060]/40 dark:text-[#f0ede8]/35 min-w-[80px] pt-0.5 font-medium">Shipping</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <svg className="w-4 h-4 text-[#6d4aff] dark:text-[#c9a96e] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <span className="text-[13px] text-[#1a1060]/70 dark:text-[#f0ede8]/60 font-medium">Standard Delivery</span>
                    <span className="text-[11px] text-[#1a1060]/40 dark:text-[#f0ede8]/30">· Ships within 1-3 days</span>
                  </div>
                </div>

                {/* Stock row */}
                <div className="flex items-center gap-4">
                  <span className="text-[13px] text-[#1a1060]/40 dark:text-[#f0ede8]/35 min-w-[80px] font-medium">Stock</span>
                  <span className={`text-[13px] font-semibold ${isOutOfStock ? "text-[#e94560]" : "text-[#16a34a]"}`}>
                    {isOutOfStock ? "Out of Stock" : `${product.stock} available`}
                  </span>
                </div>

                {/* Variants — Color style like Shopee */}
                {hasVariants && (
                  <div className="flex items-start gap-4">
                    <span className="text-[13px] text-[#1a1060]/40 dark:text-[#f0ede8]/35 min-w-[80px] pt-1 font-medium">
                      {product.variants[0]?.type || "Variant"}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {product.variants.map((variant, i) => {
                        const isSelected = selectedVariant?.label === variant.label;
                        return (
                          <button
                            key={i}
                            onClick={() => setSelectedVariant(isSelected ? null : variant)}
                            className={`flex items-center gap-1.5 rounded-md text-[13px] font-medium transition-all duration-150 border
                              ${variant.image_url ? "pl-1.5 pr-3 py-1" : "px-3.5 py-2"}
                              ${isSelected
                                ? "border-[#6d4aff] dark:border-[#c9a96e] bg-[#ede9ff] dark:bg-[#c9a96e]/10 text-[#6d4aff] dark:text-[#c9a96e] shadow-[0_0_0_1px_#6d4aff] dark:shadow-[0_0_0_1px_#c9a96e]"
                                : "border-[#e5e7eb] dark:border-white/10 bg-white dark:bg-white/[0.04] text-[#1a1060]/70 dark:text-[#f0ede8]/60 hover:border-[#6d4aff]/50 dark:hover:border-[#c9a96e]/50"
                              }`}
                          >
                            {variant.image_url && (
                              <img src={variant.image_url} className="w-6 h-6 object-cover rounded shrink-0" />
                            )}
                            {variant.label}
                            {isSelected && (
                              <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Attributes */}
                {product.attributes?.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-bold text-[#1a1060]/40 dark:text-[#f0ede8]/35 uppercase tracking-wider">Specifications</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {product.attributes.map((attr) => (
                        <div key={attr.name} className="flex gap-2 text-[13px]">
                          <span className="text-[#1a1060]/40 dark:text-[#f0ede8]/35 min-w-[90px]">{attr.label}</span>
                          <span className="font-semibold text-[#1a1060] dark:text-[#f0ede8]">{attr.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                {product.description && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold text-[#1a1060]/40 dark:text-[#f0ede8]/35 uppercase tracking-wider">Description</span>
                    <p className="text-[13px] text-[#1a1060]/55 dark:text-[#f0ede8]/45 leading-relaxed m-0">
                      {product.description}
                    </p>
                  </div>
                )}

                {/* Quantity row */}
                {!isOutOfStock && (
                  <div className="flex items-center gap-4">
                    <span className="text-[13px] text-[#1a1060]/40 dark:text-[#f0ede8]/35 min-w-[80px] font-medium">Quantity</span>
                    <div className="flex items-center border border-[#e5e7eb] dark:border-white/10 rounded-md overflow-hidden">
                      <button
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="w-9 h-9 flex items-center justify-center text-lg font-semibold text-[#1a1060] dark:text-[#f0ede8] hover:bg-[#f5f3ff] dark:hover:bg-white/[0.04] transition-colors border-none bg-transparent cursor-pointer"
                      >−</button>
                      <span className="w-10 h-9 flex items-center justify-center font-bold text-sm border-x border-[#e5e7eb] dark:border-white/10 text-[#1a1060] dark:text-[#f0ede8]">
                        {quantity}
                      </span>
                      <button
                        onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                        className="w-9 h-9 flex items-center justify-center text-lg font-semibold text-[#1a1060] dark:text-[#f0ede8] hover:bg-[#f5f3ff] dark:hover:bg-white/[0.04] transition-colors border-none bg-transparent cursor-pointer"
                      >+</button>
                    </div>
                    <span className="text-xs text-[#1a1060]/30 dark:text-[#f0ede8]/25">{product.stock} pieces available</span>
                  </div>
                )}
              </div>

              {/* Action Buttons — Shopee style side by side */}
              <div className="px-5 sm:px-6 py-4 flex flex-col gap-2.5">
                <div className="flex gap-2.5">
                  <button
                    onClick={handleAddToCart}
                    disabled={addingToCart || isOutOfStock}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-150 flex items-center justify-center gap-2 border
                      ${isOutOfStock
                        ? "border-[#e5e7eb] dark:border-white/[0.06] bg-[#f3f4f6] dark:bg-white/[0.04] text-[#9ca3af] cursor-not-allowed"
                        : "border-[navy] dark:border-[#c9a96e] bg-[#ede9ff] dark:bg-[#c9a96e]/10 text-[navy] dark:text-[#c9a96e] cursor-pointer hover:bg-[#ede9ff] dark:hover:bg-[#c9a96e]/20"
                      } ${addingToCart ? "opacity-70" : ""}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    {addingToCart ? "Adding..." : "Add to Cart"}
                  </button>

                  <button
                    onClick={handleBuyNow}
                    disabled={isOutOfStock}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-150 border-none
                      ${isOutOfStock
                        ? "bg-[#f3f4f6] dark:bg-white/[0.04] text-[#9ca3af] cursor-not-allowed"
                        : "bg-[navy] dark:bg-[#c9a96e] text-white dark:text-[#0a0a0f] cursor-pointer hover:opacity-90"
                      }`}
                  >
                    Buy Now
                  </button>
                </div>

                {session && String(session.user.id) !== String(product.seller_id) && (
                  <button
                    onClick={handleChat}
                    className="w-full py-2.5 rounded-xl border border-[#e5e7eb] dark:border-white/10 text-[13px] font-semibold text-[#1a1060]/60 dark:text-[#f0ede8]/50 hover:bg-[#f5f3ff] dark:hover:bg-white/[0.04] transition-all duration-150 cursor-pointer flex items-center justify-center gap-2 bg-transparent"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Chat with Seller
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── SELLER CARD — Shopee style below main card ── */}
        {product.seller_id && (
          <div className="bg-white dark:bg-[#12121a] rounded-2xl border border-[#e8e5f0] dark:border-white/[0.07] overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.2)] px-5 sm:px-7 py-5">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Avatar placeholder */}
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#6d4aff] to-[#1a1060] dark:from-[#c9a96e] dark:to-[#8a6d3b] flex items-center justify-center text-white text-lg font-bold shrink-0">
                {(product.seller_name || "S")[0].toUpperCase()}
              </div>

              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <span className="font-bold text-[15px] text-[#1a1060] dark:text-[#f0ede8] truncate">{product.seller_name || "Unknown Seller"}</span>
                <span className="text-[12px] text-[#1a1060]/40 dark:text-[#f0ede8]/35">Active recently</span>
              </div>

              <div className="flex gap-2 shrink-0">
                <button
                  onClick={handleChat}
                  className="px-4 py-2 rounded-xl border border-[navy] dark:border-[#c9a96e] text-[13px] font-semibold text-[navy] dark:text-[#c9a96e] hover:bg-[#ede9ff] dark:hover:bg-[#c9a96e]/10 transition-colors flex items-center gap-1.5 cursor-pointer bg-transparent"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Chat
                </button>
                <button
                  onClick={() => router.push(`/shop/${product.seller_id}`)}
                  className="px-4 py-2 rounded-xl border border-[#navy] dark:border-white/10 text-[13px] font-semibold text-[#1a1060]/70 dark:text-[#f0ede8]/60 hover:bg-[#f5f3ff] dark:hover:bg-white/[0.04] transition-colors flex items-center gap-1.5 cursor-pointer bg-transparent"
                >
                  View Shop
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Seller stats row */}
            <div className="mt-4 pt-4 border-t border-[#f3f4f6] dark:border-white/[0.06] grid grid-cols-3 sm:grid-cols-3 gap-3">
              {[
                { label: "Products", value: product.seller_product_count ?? "—" },
                { label: "Avg Rating", value: product.average_rating > 0 ? `⭐ ${Number(product.average_rating).toFixed(1)}` : "—" },
                { label: "Joined", value: product.seller_joined ?? "—" },
              ].map(({ label, value }) => (
                <div key={label} className="text-center">
                  <div className="text-[14px] font-bold text-[navy] dark:text-[#c9a96e]">{value}</div>
                  <div className="text-[11px] text-[#1a1060]/40 dark:text-[#f0ede8]/35 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── REVIEWS ── */}
        <ReviewsSection productId={id} product={product} />

        {/* ── RELATED PRODUCTS ── */}
        {relatedProducts.length > 0 && (() => {
          const fromSeller = relatedProducts.filter(p => String(p.seller_id) === String(product.seller_id)).slice(0, 5);
          const fromCategory = relatedProducts.filter(p => String(p.seller_id) !== String(product.seller_id)).slice(0, 5);

          return (
            <div className="flex flex-col gap-8">
              {fromSeller.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-[17px] font-bold text-[#1a1060] dark:text-[#f0ede8] m-0 whitespace-nowrap">More from {product.seller_name}</h2>
                    <div className="flex-1 h-px bg-[#e5e7eb] dark:bg-white/[0.07]" />
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,170px),1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
                    {fromSeller.map((p) => (
                      <div key={p.id} className="bg-white dark:bg-white/[0.04] rounded-[14px] border border-[#e8e5f0] dark:border-white/[0.07] overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(109,74,255,0.12)] dark:hover:shadow-[0_8px_24px_rgba(201,169,110,0.1)]">
                        <ProductCard product={p} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-center">
                    <button
                     onClick={() => router.push(`/shop/${product.seller_id}`)}
                      className="px-5 py-2.5 rounded-xl border border-[#e8e5f0] dark:border-white/10 text-sm font-semibold text-[#6d4aff] dark:text-[#c9a96e] hover:bg-[#ede9ff] dark:hover:bg-[#c9a96e]/10 transition cursor-pointer bg-transparent"
                    >
                      View {product.seller_name} Shop →
                    </button>
                  </div>
                </div>
              )}

              {fromCategory.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-[17px] font-bold text-[#1a1060] dark:text-[#f0ede8] m-0 whitespace-nowrap">More in {product.category_name || "this category"}</h2>
                    <div className="flex-1 h-px bg-[#e5e7eb] dark:bg-white/[0.07]" />
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,170px),1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
                    {fromCategory.map((p) => (
                      <div key={p.id} className="bg-white dark:bg-white/[0.04] rounded-[14px] border border-[#e8e5f0] dark:border-white/[0.07] overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(109,74,255,0.12)] dark:hover:shadow-[0_8px_24px_rgba(201,169,110,0.1)]">
                        <ProductCard product={p} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-center">
                    <button
                      onClick={() => router.push(`/products?category=${product.category_id}`)}
                      className="px-5 py-2.5 rounded-xl border border-[#e8e5f0] dark:border-white/10 text-sm font-semibold text-[#6d4aff] dark:text-[#c9a96e] hover:bg-[#ede9ff] dark:hover:bg-[#c9a96e]/10 transition cursor-pointer bg-transparent"
                    >
                      Browse {product.category_name || "this category"} →
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── LOGIN MODAL ── */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#12121a] rounded-2xl p-6 sm:p-9 w-full max-w-[320px] text-center border border-[#e8e5f0] dark:border-white/[0.07] shadow-[0_24px_60px_rgba(0,0,0,0.2)]"
          >
            <div className="text-4xl mb-3.5">🔒</div>
            <h2 className="text-lg font-bold mb-2 text-[#1a1060] dark:text-[#f0ede8]">Sign in to continue</h2>
            <p className="text-xs text-[#1a1060]/50 dark:text-[#f0ede8]/45 mb-6 leading-relaxed">
              You need to be logged in to add items or buy.
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => router.push("/login")}
                className="w-full py-3 rounded-xl bg-[#6d4aff] dark:bg-[#c9a96e] text-white dark:text-[#0a0a0f] font-bold text-sm cursor-pointer hover:opacity-90 transition border-none"
              >
                Sign in
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="w-full py-3 rounded-xl border border-[#e5e7eb] dark:border-white/10 text-sm text-[#1a1060]/60 dark:text-[#f0ede8]/50 cursor-pointer hover:bg-[#f5f3ff] dark:hover:bg-white/[0.04] transition bg-transparent"
              >
                Continue browsing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FLY TO CART ANIMATION ── */}
      {flyItem && (
        <img
          src={flyItem.src}
          className="fixed z-[9999] rounded-xl pointer-events-none"
          style={{
            left: flyItem.start.x,
            top: flyItem.start.y,
            width: flyItem.start.width,
            height: flyItem.start.height,
            transition: "all 800ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          ref={(el) => {
            if (!el) return;
            requestAnimationFrame(() => {
              el.style.left = `${window.innerWidth - 60}px`;
              el.style.top = `40px`;
              el.style.transform = "scale(0.1) rotate(720deg)";
              el.style.opacity = "0";
              el.style.filter = "blur(6px)";
            });
          }}
        />
      )}
    </div>
  );
}