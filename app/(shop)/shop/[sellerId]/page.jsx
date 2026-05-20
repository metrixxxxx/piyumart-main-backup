// app/(shop)/shop/[sellerId]/page.jsx
"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import ProductCard from "@/components/products/ProductCard";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "best_rated", label: "Top Rated" },
  { value: "most_sold", label: "Most Sold" },
  { value: "price_low", label: "Price ↑" },
  { value: "price_high", label: "Price ↓" },
];

export default function ShopPage() {
  const { sellerId } = useParams();
  const router = useRouter();
  const { data: session } = useSession();

  const [products, setProducts] = useState([]);
  const [sellerInfo, setSellerInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("newest");

  useEffect(() => {
    async function fetchSellerInfo() {
      try {
        const res = await fetch(`/api/seller/${sellerId}`);
        if (res.ok) setSellerInfo(await res.json());
      } catch (err) {
        console.error("Seller info error:", err);
      }
    }

    fetchSellerInfo();
  }, [sellerId]);

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true);

      try {
        const url = new URL("/api/products", window.location.origin);

        url.searchParams.append("sortBy", sortBy);
        url.searchParams.append("seller_id", sellerId);

        const res = await fetch(url.toString());
        const data = await res.json();

        setProducts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, [sortBy, sellerId]);

  const handleChat = () => {
    router.push(`/messages?seller=${sellerId}`);
  };

  const displayed = session?.user?.id
    ? products.filter(
        (p) => String(p.seller_id) !== String(session.user.id)
      )
    : products;

  const displayName = sellerInfo?.seller_name || "Shop";

  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const memberSince = sellerInfo?.member_since
    ? new Date(sellerInfo.member_since).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
      })
    : null;

  return (
    <main className="min-h-screen bg-[#eef2f7] dark:bg-[#070b14] transition-colors duration-300">
      {/* Seller Header */}
      <section className="bg-[#1a2a6c] dark:bg-[#0a0e1f] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-10 -right-10 w-52 h-52 rounded-full bg-white/[0.04]" />
          <div className="absolute bottom-0 left-1/4 w-32 h-32 rounded-full bg-[#c9a028]/10" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-white/50 hover:text-white text-xs font-semibold mb-6 transition-colors group"
          >
            <svg
              className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </button>

          <div className="flex items-start gap-4 sm:gap-6">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-[#c9a028] to-[#e8b830] flex items-center justify-center text-[#1a2a6c] font-extrabold text-xl sm:text-2xl shadow-lg shadow-black/30 ring-2 ring-white/20">
                {initials}
              </div>

              <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-[#1a2a6c]" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                {displayName}
              </h1>

              {memberSince && (
                <p className="text-white/40 text-[11px] mt-0.5">
                  Member since {memberSince}
                </p>
              )}

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mt-4 max-w-xs sm:max-w-sm">
                <div className="text-center">
                  <p className="text-white font-extrabold text-base leading-tight">
                    {sellerInfo
                      ? Number(sellerInfo.avg_rating) > 0
                        ? sellerInfo.avg_rating
                        : "—"
                      : "—"}
                  </p>

                  <p className="text-white/40 text-[10px] mt-0.5 flex items-center justify-center gap-0.5">
                    <svg
                      className="w-2.5 h-2.5 text-[#c9a028]"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    Rating
                  </p>
                </div>

                <div className="text-center border-x border-white/10">
                  <p className="text-white font-extrabold text-base leading-tight">
                    {sellerInfo
                      ? Number(sellerInfo.total_sold).toLocaleString()
                      : "—"}
                  </p>

                  <p className="text-white/40 text-[10px] mt-0.5">Sold</p>
                </div>

                <div className="text-center">
                  <p className="text-white font-extrabold text-base leading-tight">
                    {sellerInfo
                      ? Number(sellerInfo.total_products).toLocaleString()
                      : "—"}
                  </p>

                  <p className="text-white/40 text-[10px] mt-0.5">
                    Products
                  </p>
                </div>
              </div>
            </div>

            {session &&
              String(session.user.id) !== String(sellerId) && (
                <button
                  onClick={handleChat}
                  className="hidden sm:flex shrink-0 items-center gap-2 border border-white/30 text-white text-xs font-bold px-4 py-2 rounded-sm hover:bg-white/10 transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  Chat
                </button>
              )}
          </div>
        </div>
      </section>

      {/* Sort Bar */}
      <div className="bg-white dark:bg-[#0e1520] border-b border-[#c5cfe8] dark:border-white/[0.07] sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
            <span className="text-[10px] font-bold text-[#0e1a3d]/40 dark:text-[#e8edf8]/30 uppercase tracking-wider pr-3 shrink-0">
              Sort:
            </span>

            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSortBy(opt.value)}
                className={`shrink-0 px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors
                  ${
                    sortBy === opt.value
                      ? "border-[#1a2a6c] dark:border-[#c9a028] text-[#1a2a6c] dark:text-[#c9a028]"
                      : "border-transparent text-[#0e1a3d]/50 dark:text-[#e8edf8]/40 hover:text-[#0e1a3d] dark:hover:text-[#e8edf8]"
                  }`}
              >
                {opt.label}
              </button>
            ))}

            <div className="ml-auto shrink-0 pl-4">
              <span className="text-[11px] font-semibold text-[#0e1a3d]/40 dark:text-[#e8edf8]/30">
                {displayed.length} result
                {displayed.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Products */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="w-10 h-10 border-[3px] border-[#c5cfe8] dark:border-white/10 border-t-[#1a2a6c] dark:border-t-[#c9a028] rounded-full mx-auto mb-4 animate-spin" />

              <p className="text-sm text-[#0e1a3d]/50 dark:text-[#e8edf8]/40">
                Loading products...
              </p>
            </div>
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-24 bg-white dark:bg-[#0e1520] border border-[#c5cfe8] dark:border-white/[0.07] rounded-sm">
            <div className="text-5xl mb-4">🛍️</div>

            <h2 className="text-base font-bold text-[#0e1a3d] dark:text-[#e8edf8] mb-2">
              No products yet
            </h2>

            <p className="text-sm text-[#0e1a3d]/50 dark:text-[#e8edf8]/40 mb-6">
              This seller has no active listings.
            </p>

            <button
              onClick={() => router.push("/")}
              className="bg-[#1a2a6c] text-white px-6 py-2.5 rounded-sm text-sm font-bold hover:bg-[#142060] transition"
            >
              Browse All Products
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(210px,1fr))]">
            {displayed.map((product) => (
              <div
                key={product.id}
                className="bg-white dark:bg-white/[0.04] rounded-sm border border-[#c5cfe8] dark:border-white/[0.07] overflow-hidden transition-all duration-200 hover:shadow-[0_4px_20px_rgba(26,42,108,0.12)] dark:hover:shadow-[0_4px_20px_rgba(201,160,40,0.08)] hover:border-[#1a2a6c]/40 dark:hover:border-[#c9a028]/40"
              >
                <ProductCard product={product} hideActions />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}