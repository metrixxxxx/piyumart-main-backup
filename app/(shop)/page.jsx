"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import ProductCard from "@/components/products/ProductCard";
import HeroSlider from "@/components/HeroSlider";
import SearchAutocomplete from "@/components/SearchAutocomplete";

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
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

  const displayed = products.filter((p) => {
    const matchesSearch =
      !search.trim() ||
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      category === "all" || String(p.category_id) === String(category);
    return matchesSearch && matchesCategory;
  });

  const categoryLabel =
    category === "all"
      ? "All Products"
      : categories.find((c) => String(c.id) === category)?.name || "Products";

  return (
    <main className="min-h-screen bg-[#eef2f7] dark:bg-[#070b14] transition-colors duration-300">

      {/* ── HERO ── */}
      <section className="px-3 sm:px-5 pt-4 sm:pt-6 pb-6 sm:pb-8 max-w-7xl mx-auto">
        <div className="bg-white dark:bg-[#0e1520] rounded-2xl border border-[#c5cfe8] dark:border-white/[0.07] grid grid-cols-1 lg:grid-cols-2">

          {/* LEFT — text + search */}
          <div className="flex flex-col justify-center px-5 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-12">

            {/* eyebrow */}
            <div className="inline-flex items-center gap-2 bg-[#e8edf8] dark:bg-[#c9a028]/10 text-[#1a2a6c] dark:text-[#d4aa40] text-[11px] font-semibold px-4 py-1.5 rounded-full mb-5 w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1a2a6c] dark:bg-[#d4aa40] animate-pulse" />
              {session ? `Welcome back, ${session.user.name}` : "Live on campus · LSPU"}
            </div>

            {/* heading */}
            <h1 className="text-2xl sm:text-3xl lg:text-[2.6rem] font-extrabold leading-[1.1] tracking-tight text-[#0e1a3d] dark:text-[#e8edf8] mb-3 sm:mb-4">
              {session ? (
                <>Your campus{" "}
                  <span className="text-[#1a6c2a] dark:text-[#d4aa40]">deals,</span>
                  <br />all in one place.
                </>
              ) : (
                <>Your campus{" "}
                  <span className="text-[#1a6c2a] dark:text-[#d4aa40]">marketplace,</span>
                  <br />reimagined.
                </>
              )}
            </h1>

            {/* sub */}
            <p className="text-sm text-[#0e1a3d]/50 dark:text-[#e8edf8]/45 leading-relaxed mb-6 sm:mb-8">
              {session
                ? "Discover student deals on campus."
                : "Buy and sell with fellow LSPU students. Deals on books, tech, food, and more."}
            </p>

            {/* search */}
            <SearchAutocomplete />
          </div>

          {/* RIGHT — hero slider */}
          {/* overflow-hidden removed; rounded only on right side on lg+ so corners still look clean */}
          <div
            className="relative flex items-center justify-center rounded-b-2xl lg:rounded-b-none lg:rounded-r-2xl min-h-[220px] sm:min-h-[260px] lg:min-h-0"
            style={{ background: "linear-gradient(135deg, #1a2a6c 0%, #1a6c2a 60%, #c9a028 100%)" }}
          >
            {/* decorative blobs */}
            <div className="absolute top-6 right-6 w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white/10" />
            <div className="absolute bottom-8 left-6 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/10" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 sm:w-40 sm:h-40 rounded-full bg-[#c9a028]/20 blur-2xl" />
            <div className="relative z-10 w-full px-4 py-5 sm:px-8 sm:py-8">
              <HeroSlider />
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTENT ── */}
      <section className="max-w-7xl mx-auto px-3 sm:px-5 pb-10">

        {/* category tabs — horizontally scrollable on mobile */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-2 scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap">
          <button
            onClick={() => setCategory("all")}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full border text-xs font-medium transition-all duration-150
              ${category === "all"
                ? "bg-[#1a2a6c] dark:bg-[#d4aa40] border-[#1a2a6c] dark:border-[#d4aa40] text-white dark:text-[#0e1a3d] font-bold"
                : "bg-white dark:bg-white/4 border-[#c5cfe8] dark:border-white/10 text-[#4a5a7a] dark:text-[#e8edf8]/55 hover:border-[#1a2a6c] dark:hover:border-[#d4aa40] hover:text-[#1a2a6c] dark:hover:text-[#d4aa40]"
              }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(String(cat.id))}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full border text-xs font-medium transition-all duration-150
                ${category === String(cat.id)
                  ? "bg-[#1a2a6c] dark:bg-[#d4aa40] border-[#1a2a6c] dark:border-[#d4aa40] text-white dark:text-[#0e1a3d] font-bold"
                  : "bg-white dark:bg-white/4 border-[#c5cfe8] dark:border-white/10 text-[#4a5a7a] dark:text-[#e8edf8]/55 hover:border-[#1a2a6c] dark:hover:border-[#d4aa40] hover:text-[#1a2a6c] dark:hover:text-[#d4aa40]"
                }`}
            >
              {cat.name}
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
              onChange={(e) => setSortBy(e.target.value)}
              className="flex-1 sm:flex-none text-xs font-semibold px-3 py-1.5 rounded-full bg-white dark:bg-white/4 border border-[#c5cfe8] dark:border-white/10 text-[#0e1a3d] dark:text-[#e8edf8] cursor-pointer hover:border-[#1a2a6c] dark:hover:border-[#d4aa40] transition-colors"
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

        {/* product list */}
        {loading ? (
          <p className="text-sm text-[#0e1a3d]/50 dark:text-[#e8edf8]/40 py-6">Loading products…</p>
        ) : displayed.length === 0 ? (
          <p className="text-sm text-[#0e1a3d]/50 dark:text-[#e8edf8]/40 py-6">
            {search ? `No results for "${search}".` : "No products available yet."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
            {displayed.map((product) => (
              <div
                key={product.id}
                className="bg-white dark:bg-white/4 rounded-2xl border border-[#c5cfe8] dark:border-white/[0.07] overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_28px_rgba(26,42,108,0.15)] dark:hover:shadow-[0_8px_28px_rgba(212,170,64,0.1)] hover:border-[#1a2a6c] dark:hover:border-[#d4aa40]"
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