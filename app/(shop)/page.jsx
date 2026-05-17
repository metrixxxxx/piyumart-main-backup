"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import ProductCard from "@/components/products/ProductCard";
import HeroSlider from "@/components/HeroSlider";

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const { data: session } = useSession();

  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch("/api/products");
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
  }, [session]);

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
    <main className="min-h-screen bg-[#f0eeff] dark:bg-[#0a0a0f] transition-colors duration-300">

      {/* ── HERO ── */}
      <section className="px-5 pt-6 pb-8 max-w-[1200px] mx-auto">
        <div className="bg-white dark:bg-[#12121a] rounded-2xl border border-[#e8e5f0] dark:border-white/[0.07] overflow-hidden grid grid-cols-1 md:grid-cols-2 min-h-[380px]">

          {/* LEFT — text + search */}
          <div className="flex flex-col justify-center px-10 py-12">

            {/* eyebrow */}
            <div className="inline-flex items-center gap-2 bg-[#ede9ff] dark:bg-[#c9a96e]/10 text-[#6d4aff] dark:text-[#c9a96e] text-[11px] font-semibold px-4 py-1.5 rounded-full mb-6 w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-[#6d4aff] dark:bg-[#c9a96e] animate-pulse" />
              {session ? `Welcome back, ${session.user.name}` : "Live on campus"}
            </div>

            {/* heading */}
            <h1 className="text-[2.6rem] font-extrabold leading-[1.1] tracking-tight text-[#1a1060] dark:text-[#f0ede8] mb-4">
              {session ? (
                <>Your campus{" "}
                  <span className="text-[#6d4aff] dark:text-[#c9a96e]">deals,</span>
                  <br />all in one place.
                </>
              ) : (
                <>Your campus{" "}
                  <span className="text-[#6d4aff] dark:text-[#c9a96e]">marketplace,</span>
                  <br />reimagined.
                </>
              )}
            </h1>

            {/* sub */}
            <p className="text-sm text-[#1a1060]/50 dark:text-[#f0ede8]/45 leading-relaxed mb-8">
              {session
                ? "Discover student deals on campus."
                : "Buy and sell with fellow students. Deals on books, tech, food, and more."}
            </p>

            {/* search */}
            <div className="relative">
              <svg
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1a1060]/35 dark:text-[#f0ede8]/35 pointer-events-none"
                xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="text"
                placeholder="What are you looking for?"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full py-3 pl-10 pr-10 rounded-xl border-[1.5px] border-[#e8e5f0] dark:border-white/10 bg-[#f5f3ff] dark:bg-white/[0.06] text-[#1a1060] dark:text-[#f0ede8] placeholder:text-[#1a1060]/30 dark:placeholder:text-[#f0ede8]/30 text-sm outline-none focus:border-[#6d4aff] dark:focus:border-[#c9a96e] transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#1a1060]/40 dark:text-[#f0ede8]/40 hover:text-[#1a1060] dark:hover:text-[#f0ede8] transition-colors"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* RIGHT — hero slider / featured */}
          <div className="relative bg-[#ede9ff] dark:bg-[#c9a96e]/5 flex items-center justify-center overflow-hidden">
            {/* decorative blobs */}
            <div className="absolute top-6 right-6 w-24 h-24 rounded-full bg-[#6d4aff]/20 dark:bg-[#c9a96e]/10" />
            <div className="absolute bottom-8 left-6 w-14 h-14 rounded-full bg-[#6d4aff]/15 dark:bg-[#c9a96e]/08" />
            <div className="relative z-10 w-full px-8 py-8">
              <HeroSlider />
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTENT ── */}
      <section className="max-w-[1200px] mx-auto px-5 pb-10">

        {/* category tabs */}
        <div className="flex gap-2 flex-wrap mb-2">
          <button
            onClick={() => setCategory("all")}
            className={`px-4 py-1.5 rounded-full border text-xs font-medium transition-all duration-150
              ${category === "all"
                ? "bg-[#6d4aff] dark:bg-[#c9a96e] border-[#6d4aff] dark:border-[#c9a96e] text-white dark:text-[#0a0a0f] font-bold"
                : "bg-white dark:bg-white/[0.04] border-[#ddd] dark:border-white/10 text-[#555] dark:text-[#f0ede8]/55 hover:border-[#6d4aff] dark:hover:border-[#c9a96e] hover:text-[#6d4aff] dark:hover:text-[#c9a96e]"
              }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(String(cat.id))}
              className={`px-4 py-1.5 rounded-full border text-xs font-medium transition-all duration-150
                ${category === String(cat.id)
                  ? "bg-[#6d4aff] dark:bg-[#c9a96e] border-[#6d4aff] dark:border-[#c9a96e] text-white dark:text-[#0a0a0f] font-bold"
                  : "bg-white dark:bg-white/[0.04] border-[#ddd] dark:border-white/10 text-[#555] dark:text-[#f0ede8]/55 hover:border-[#6d4aff] dark:hover:border-[#c9a96e] hover:text-[#6d4aff] dark:hover:text-[#c9a96e]"
                }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* header row */}
        <div className="flex justify-between items-center mt-6 mb-5">
          <h2 className="text-base font-bold tracking-tight text-[#1a1060] dark:text-[#f0ede8]">
            {categoryLabel}
          </h2>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#ede9ff] dark:bg-[#c9a96e]/10 text-[#6d4aff] dark:text-[#c9a96e]">
            {displayed.length} item{displayed.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* product list */}
        {loading ? (
          <p className="text-sm text-[#1a1060]/50 dark:text-[#f0ede8]/40 py-6">Loading products…</p>
        ) : displayed.length === 0 ? (
          <p className="text-sm text-[#1a1060]/50 dark:text-[#f0ede8]/40 py-6">
            {search ? `No results for "${search}".` : "No products available yet."}
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {displayed.map((product) => (
              <div
                key={product.id}
                className="bg-white dark:bg-white/[0.04] rounded-2xl border border-[#e8e5f0] dark:border-white/[0.07] overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_28px_rgba(109,74,255,0.12)] dark:hover:shadow-[0_8px_28px_rgba(201,169,110,0.1)] hover:border-[#6d4aff] dark:hover:border-[#c9a96e]"
              >
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}