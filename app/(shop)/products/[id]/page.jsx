"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import ProductCard from "@/components/products/ProductCard";
import { getSocket } from "@/lib/socket";

export default function ProductDetailPage() {
  const [product, setProduct] = useState(null);
  const [allProducts, setAllProducts] = useState([]);
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
        const [productRes, allRes] = await Promise.all([
          fetch(`/api/products/${id}`),
          fetch("/api/products"),
        ]);
        const productData = await productRes.json();
        const allData = await allRes.json();
        setProduct(productData);
        setSelectedImageIndex(0);
        setSelectedVariant(null);
        setAllProducts(
          Array.isArray(allData)
            ? allData.filter((p) => String(p.id) !== String(id))
            : []
        );
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
      setAllProducts((prev) => prev.map((p) => String(p.id) === String(updated.id) ? { ...p, ...updated } : p));
    });
    socket.on("products:deleted", ({ id: deletedId }) => {
      if (String(deletedId) === String(id)) router.push("/products");
      setAllProducts((prev) => prev.filter((p) => String(p.id) !== String(deletedId)));
    });
    socket.on("products:new", (newProduct) => {
      setAllProducts((prev) => [newProduct, ...prev]);
    });
    return () => {
      socket.off("products:updated");
      socket.off("products:deleted");
      socket.off("products:new");
    };
  }, [id]);

  async function handleAddToCart() {
    if (!session) { setShowModal(true); return; }
    setAddingToCart(true);
    const res = await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: product.id,
        quantity,
        variant: selectedVariant?.label || null,
      }),
    });
    const data = await res.json();
    setAddingToCart(false);
    if (data.success) router.push("/cart");
  }

  async function handleBuyNow() {
    if (!session) { setShowModal(true); return; }
    router.push(
      `/checkout?productId=${product.id}&quantity=${quantity}${selectedVariant ? `&variant=${encodeURIComponent(selectedVariant.label)}` : ""}`
    );
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
    : product.image_url
    ? [product.image_url]
    : ["/placeholder.png"];

  const activeImage = selectedVariant?.image_url || allImages[selectedImageIndex] || "/placeholder.png";
  const hasVariants = product.variants?.length > 0;

  return (
    <div className="min-h-screen bg-[#f0eeff] dark:bg-[#0a0a0f] transition-colors duration-300">

      
      <div className="max-w-[960px] mx-auto px-5 py-8">

        {/* DETAIL CARD */}
        <div className="bg-white dark:bg-[#12121a] rounded-2xl border border-[#e8e5f0] dark:border-white/[0.07] overflow-hidden grid grid-cols-1 md:grid-cols-2 shadow-[0_4px_24px_rgba(0,0,0,0.07)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)]">

          {/* LEFT — Image Gallery */}
          <div className="flex flex-col bg-[#fafafa] dark:bg-white/[0.02]">

            {/* Main image */}
            <div className="relative aspect-square overflow-hidden">
              <img
                key={activeImage}
                src={activeImage}
                alt={product.name}
                className="w-full h-full object-cover block transition-opacity duration-200"
              />

              {allImages.length > 1 && (
                <div className="absolute top-3 right-3 bg-black/50 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm">
                  {selectedVariant ? "variant" : `${selectedImageIndex + 1} / ${allImages.length}`}
                </div>
              )}

              {isOutOfStock && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="bg-[#e94560] text-white px-6 py-2 rounded-full text-sm font-bold tracking-wide">
                    Out of Stock
                  </span>
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
                          ? "border-[2.5px] border-[#6d4aff] dark:border-[#c9a96e] opacity-100 shadow-[0_0_0_1px_#c4b5fd] dark:shadow-[0_0_0_1px_#c9a96e]"
                          : "border-[2.5px] border-transparent opacity-50"
                        }`}
                    >
                      <img src={img} className="w-full h-full object-cover block" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT — Info */}
          <div className="p-7 flex flex-col gap-4 overflow-y-auto">

            {/* Category badge */}
            {product.category_name && (
              <span className="inline-block w-fit bg-[#ede9ff] dark:bg-[#c9a96e]/10 text-[#6d4aff] dark:text-[#c9a96e] text-[11px] font-semibold px-3 py-1 rounded-full tracking-wide">
                {product.category_name}
              </span>
            )}

            <h1 className="text-[22px] font-bold text-[#1a1060] dark:text-[#f0ede8] leading-snug m-0">
              {product.name}
            </h1>

            <p className="text-[28px] font-extrabold text-[#6d4aff] dark:text-[#c9a96e] m-0">
              ₱{Number(product.price).toLocaleString()}
            </p>

            {/* Stock + Seller */}
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold px-3 py-1 rounded-full
                ${isOutOfStock
                  ? "bg-red-50 dark:bg-red-500/10 text-[#e94560]"
                  : "bg-green-50 dark:bg-green-500/10 text-[#16a34a]"
                }`}>
                {isOutOfStock ? "Out of Stock" : `${product.stock} in stock`}
              </span>
              <span className="text-xs text-[#1a1060]/40 dark:text-[#f0ede8]/35">
                by {
                  product.seller_id ? (
                    <button
                      type="button"
                      onClick={() => router.push(`/seller/${product.seller_id}`)}
                      className="font-semibold text-[#1a1060]/80 dark:text-[#f0ede8]/70 hover:text-[#6d4aff] dark:hover:text-[#c9a96e] transition-colors"
                    >
                      {product.seller_name || "Unknown"}
                    </button>
                  ) : (
                    <strong className="text-[#1a1060]/60 dark:text-[#f0ede8]/55">{product.seller_name || "Unknown"}</strong>
                  )
                }
              </span>
            </div>

            {/* Description */}
            {product.description && (
              <p className="text-sm text-[#1a1060]/55 dark:text-[#f0ede8]/45 leading-relaxed border-t border-[#f3f4f6] dark:border-white/[0.06] pt-3 m-0">
                {product.description}
              </p>
            )}

            {/* Attributes */}
            {product.attributes?.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-bold text-[#1a1060]/60 dark:text-[#f0ede8]/40 uppercase tracking-wider m-0">
                  Product Details
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {product.attributes.map((attr) => (
                    <div key={attr.name} className="bg-[#f9fafb] dark:bg-white/[0.04] rounded-xl px-3 py-2 border border-[#f0f0f0] dark:border-white/[0.06]">
                      <p className="text-[10px] text-[#1a1060]/40 dark:text-[#f0ede8]/35 uppercase tracking-wide m-0">{attr.label}</p>
                      <p className="text-[13px] font-semibold text-[#1a1060] dark:text-[#f0ede8] mt-0.5 m-0">{attr.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Variants */}
            {hasVariants && (
              <div className="flex flex-col gap-2.5">
                <p className="text-[11px] font-bold text-[#1a1060]/60 dark:text-[#f0ede8]/40 uppercase tracking-wider m-0">
                  Variants
                  {selectedVariant && (
                    <span className="font-medium text-[#6d4aff] dark:text-[#c9a96e] ml-2 normal-case tracking-normal">
                      — {selectedVariant.label}
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((variant, i) => {
                    const isSelected = selectedVariant?.label === variant.label;
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedVariant(isSelected ? null : variant)}
                        className={`flex items-center gap-1.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer
                          ${variant.image_url ? "pl-1.5 pr-3 py-1.5" : "px-3.5 py-2"}
                          ${isSelected
                            ? "border-2 border-[#6d4aff] dark:border-[#c9a96e] bg-[#ede9ff] dark:bg-[#c9a96e]/10 text-[#6d4aff] dark:text-[#c9a96e] shadow-[0_0_0_3px_#c4b5fd] dark:shadow-[0_0_0_3px_#c9a96e33]"
                            : "border border-[#e5e7eb] dark:border-white/10 bg-[#f9fafb] dark:bg-white/[0.04] text-[#1a1060]/70 dark:text-[#f0ede8]/60"
                          }`}
                      >
                        {variant.image_url && (
                          <img src={variant.image_url} className="w-7 h-7 object-cover rounded-md shrink-0" />
                        )}
                        {variant.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <hr className="border-none border-t border-[#f3f4f6] dark:border-white/[0.06] my-0" />

            {/* Quantity */}
            {!isOutOfStock && (
              <div className="flex items-center gap-3.5">
                <span className="text-sm text-[#1a1060]/60 dark:text-[#f0ede8]/50 font-semibold">Qty</span>
                <div className="flex items-center border border-[#e5e7eb] dark:border-white/10 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="px-4 py-2 bg-transparent border-none cursor-pointer text-lg font-semibold text-[#1a1060] dark:text-[#f0ede8] hover:bg-[#f5f3ff] dark:hover:bg-white/[0.04] transition-colors"
                  >−</button>
                  <span className="px-4 py-2 font-bold text-sm border-x border-[#e5e7eb] dark:border-white/10 min-w-[48px] text-center text-[#1a1060] dark:text-[#f0ede8]">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                    className="px-4 py-2 bg-transparent border-none cursor-pointer text-lg font-semibold text-[#1a1060] dark:text-[#f0ede8] hover:bg-[#f5f3ff] dark:hover:bg-white/[0.04] transition-colors"
                  >+</button>
                </div>
                <span className="text-xs text-[#1a1060]/35 dark:text-[#f0ede8]/30">max {product.stock}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-2.5 mt-1">
              <button
                onClick={handleAddToCart}
                disabled={addingToCart || isOutOfStock}
                className={`w-full py-3.5 rounded-xl border-none text-sm font-bold transition-all duration-150
                  ${isOutOfStock
                    ? "bg-[#e5e7eb] dark:bg-white/[0.06] text-[#9ca3af] cursor-not-allowed"
                    : "bg-[#6d4aff] dark:bg-[#c9a96e] text-white dark:text-[#0a0a0f] cursor-pointer hover:opacity-90"
                  } ${addingToCart ? "opacity-70" : ""}`}
              >
                {addingToCart ? "Adding to cart..." : "🛒 Add to Cart"}
              </button>

              <button
                onClick={handleBuyNow}
                disabled={isOutOfStock}
                className={`w-full py-3.5 rounded-xl border-none text-sm font-bold transition-all duration-150
                  ${isOutOfStock
                    ? "bg-[#f3f4f6] dark:bg-white/[0.04] text-[#9ca3af] cursor-not-allowed"
                    : "bg-[#1a1060] dark:bg-[#f0ede8] text-white dark:text-[#0a0a0f] cursor-pointer hover:opacity-90"
                  }`}
              >
                ⚡ Buy Now
              </button>
            </div>
          </div>
        </div>

        {/* MORE PRODUCTS */}
        {allProducts.length > 0 && (
          <div className="mt-14">
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-xl font-bold text-[#1a1060] dark:text-[#f0ede8] m-0">More Products</h2>
              <div className="flex-1 h-px bg-[#e5e7eb] dark:bg-white/[0.07]" />
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
              {allProducts.map((p) => (
                <div
                  key={p.id}
                  className="bg-white dark:bg-white/[0.04] rounded-[14px] border border-[#e8e5f0] dark:border-white/[0.07] overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(109,74,255,0.12)] dark:hover:shadow-[0_8px_24px_rgba(201,169,110,0.1)]"
                >
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* LOGIN MODAL */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#12121a] rounded-2xl p-9 w-[320px] text-center border border-[#e8e5f0] dark:border-white/[0.07] shadow-[0_24px_60px_rgba(0,0,0,0.2)]"
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
    </div>
  );
}