"use client";
import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import ProductCard from "@/components/products/ProductCard";

import HeroSection from "@/components/HeroSection";
import Footer from "@/components/Footer";

const PRODUCTS_PER_PAGE = 25;

const CATEGORY_ICONS = {
  "Beauty": "💄",
  "Books": "📚",
  "Clothing": "👕",
  "Electronics": "💻",
  "Food & Drinks": "🍔",
  "Home & Living": "🏠",
  "Sports": "⚽",
  "Toys": "🧸",
};

function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden animate-pulse" style={{ backgroundColor: "#ffffff", border: "1px solid #e5e9f2" }}>
      <div className="aspect-square sm:aspect-[4/3] bg-gray-200" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
        <div className="h-4 bg-gray-200 rounded w-1/3 mt-2" />
      </div>
    </div>
  );
}

function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function shuffleArray(arr, seed) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(seed + i) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function HomePage() {
  const [products, setProducts]         = useState([]);
  const [categories, setCategories]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [category, setCategory]         = useState("all");
  const [sortBy, setSortBy]             = useState("newest");
  const [visibleCount, setVisibleCount] = useState(PRODUCTS_PER_PAGE);

  const [shuffleSeed] = useState(() => {
    if (typeof window === "undefined") return Math.random();
    const existing = sessionStorage.getItem("pm_shuffle_seed");
    if (existing) return parseFloat(existing);
    const seed = Math.random();
    sessionStorage.setItem("pm_shuffle_seed", seed);
    return seed;
  });

  const { data: session } = useSession();

  useEffect(() => {
    async function fetchProducts() {
      try {
        const url = new URL("/api/products", window.location.origin);
        url.searchParams.append("sortBy", sortBy);
        const res = await fetch(url.toString());
        const data = await res.json();
        const allProducts = Array.isArray(data) ? data : [];
        const filtered = session?.user?.id
          ? allProducts.filter((p) => String(p.seller_id) !== String(session.user.id))
          : allProducts;
        setProducts(filtered);
        setVisibleCount(PRODUCTS_PER_PAGE);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, [session, sortBy]);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch("/api/categories");
        const data = await res.json();
        setCategories(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
      }
    }
    fetchCategories();
  }, []);

  const randomizedProducts = useMemo(() => {
    if (sortBy !== "newest") return products;
    return shuffleArray(products, shuffleSeed);
  }, [products, shuffleSeed]);

  const displayed = randomizedProducts.filter((p) => {
    const matchesSearch =
      !search.trim() ||
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      category === "all" || String(p.category_id) === String(category);
    return matchesSearch && matchesCategory;
  });

  const visibleProducts = displayed.slice(0, visibleCount);
  const hasMore         = visibleCount < displayed.length;
  const remainingCount  = displayed.length - visibleCount;

  const categoryLabel =
    category === "all"
      ? "All Products"
      : categories.find((c) => String(c.id) === category)?.name || "Products";

  return (
    <main className="min-h-screen bg-[#f0eeff] dark:bg-[#070b14] transition-colors duration-300 scroll-smooth">

      {/* ── HERO ── */}
      <section className="px-3 sm:px-5 pt-4 sm:pt-6 pb-6 sm:pb-8 max-w-7xl mx-auto">
        <HeroSection />
      </section>

      {/* ── CONTENT ── */}
      <section className="max-w-7xl mx-auto px-3 sm:px-5 pb-10">

        {/* category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-2 scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap">
          <button
            onClick={() => { setCategory("all"); setVisibleCount(PRODUCTS_PER_PAGE); }}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full border text-xs font-medium transition-all duration-150
              ${category === "all"
                ? "bg-[#1a2a6c] dark:bg-[#d4aa40] border-[#1a2a6c] dark:border-[#d4aa40] text-white dark:text-[#0e1a3d] font-bold"
                : "bg-white dark:bg-white/4 border-[#c5cfe8] dark:border-white/10 text-[#4a5a7a] dark:text-[#e8edf8]/55 hover:border-[#1a2a6c] dark:hover:border-[#d4aa40] hover:text-[#1a2a6c] dark:hover:text-[#d4aa40]"
              }`}
          >
            🛍️ All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => { setCategory(String(cat.id)); setVisibleCount(PRODUCTS_PER_PAGE); }}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full border text-xs font-medium transition-all duration-150
                ${category === String(cat.id)
                  ? "bg-[#1a2a6c] dark:bg-[#d4aa40] border-[#1a2a6c] dark:border-[#d4aa40] text-white dark:text-[#0e1a3d] font-bold"
                  : "bg-white dark:bg-white/4 border-[#c5cfe8] dark:border-white/10 text-[#4a5a7a] dark:text-[#e8edf8]/55 hover:border-[#1a2a6c] dark:hover:border-[#d4aa40] hover:text-[#1a2a6c] dark:hover:text-[#d4aa40]"
                }`}
            >
              {CATEGORY_ICONS[cat.name] || "🏷️"} {cat.name}
            </button>
          ))}
        </div>

        {/* header row */}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center mt-5 sm:mt-6 mb-4 sm:mb-5">
          <h2 className="text-base font-bold tracking-tight text-[#0e1a3d] dark:text-[#e8edf8]">
            {categoryLabel}
          </h2>
          <div className="flex items-center gap-2 sm:gap-3">
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setVisibleCount(PRODUCTS_PER_PAGE); }}
              className="flex-1 sm:flex-none text-xs font-semibold px-3 py-1.5 rounded-full bg-white dark:bg-[#0e1520] border border-[#c5cfe8] dark:border-white/10 text-[#0e1a3d] dark:text-white cursor-pointer hover:border-[#1a2a6c] dark:hover:border-[#d4aa40] transition-colors"
            >
              <option value="newest">Newest First</option>
              <option value="best_rated">Best Rated</option>
              <option value="most_sold">Most Sold</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
            </select>
            <span className="flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-full bg-[#e8edf8] dark:bg-[#d4aa40]/10 text-[#1a2a6c] dark:text-[#d4aa40]">
              {displayed.length} item{displayed.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* product grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
          {loading
            ? Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)
            : displayed.length === 0
            ? (
              <div className="col-span-full py-16 flex flex-col items-center gap-3 text-center">
                <span className="text-4xl">🔍</span>
                <p className="text-sm font-semibold text-[#0e1a3d] dark:text-[#e8edf8]">
                  {search ? `No results for "${search}"` : "No products available yet."}
                </p>
                <p className="text-xs text-[#0e1a3d]/40 dark:text-[#e8edf8]/40">
                  {search ? "Try a different keyword or category." : "Check back later!"}
                </p>
              </div>
            )
            : visibleProducts.map((product) => (
              <div
                key={product.id}
                className="rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_28px_rgba(26,42,108,0.15)] dark:hover:shadow-[0_8px_28px_rgba(212,170,64,0.1)]"
                style={{ backgroundColor: "#ffffff", border: "5px solid #e5e9f2" }}
              >
                <ProductCard product={product} hideActions />
              </div>
            ))
          }
        </div>

        {/* Show More */}
        {!loading && hasMore && (
          <div className="mt-8 flex flex-col items-center gap-2">
            <button
              onClick={() => setVisibleCount((prev) => prev + PRODUCTS_PER_PAGE)}
              className="px-8 py-2.5 rounded-full bg-[#1a2a6c] dark:bg-[#d4aa40] text-white dark:text-[#0e1a3d] text-sm font-bold tracking-wide hover:bg-[#142060] dark:hover:bg-[#c9922a] active:scale-95 transition-all duration-150"
            >
              Show More
            </button>
            <p className="text-xs text-[#0e1a3d]/40 dark:text-[#e8edf8]/40">
              Showing {visibleCount} of {displayed.length} products · {remainingCount} more to load
            </p>
          </div>
        )}

        {!loading && !hasMore && displayed.length > PRODUCTS_PER_PAGE && (
          <div className="mt-8 text-center text-xs text-[#0e1a3d]/40 dark:text-[#e8edf8]/40">
            You&lsquo;ve seen all {displayed.length} products 🎉
          </div>
        )}

      </section>

    </main>
  );
}