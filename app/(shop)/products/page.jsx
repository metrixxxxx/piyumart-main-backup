"use client";
import LoginRequiredModal from "@/components/ui/LoginRequiredModal";
import Pagination from "@/components/ui/Pagination";
import { usePagedResource } from "@/lib/usePagedResource";
import { getCategories } from "@/lib/client-catalog";
import { useCatalogRealtime } from "@/lib/realtime/useCatalogRealtime";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import ProductCard from "@/components/products/ProductCard";
import SearchAutocomplete from "@/components/SearchAutocomplete";

const HIDDEN_CATEGORY_NAMES = new Set(["toys", "home & living", "food & drinks"]);

export default function ProductsPage() {
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [heroPassed, setHeroPassed] = useState(false);

  const { data: session,status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedCategory = searchParams.get("category")
    ? Number(searchParams.get("category"))
    : null;
  const visibleCategories = categories.filter(
    (cat) => !HIDDEN_CATEGORY_NAMES.has(cat.name?.trim().toLowerCase())
  );

  // ─── Fetch categories ─────────────────────────────
  const [page,setPage]=useState(1);
  const query=new URLSearchParams({page:String(page)});if(selectedCategory)query.set("category",selectedCategory);
  const catalog=usePagedResource("/api/products?"+query,{enabled:status!=="loading",identity:session?.user?.id,onPageChange:setPage});
  const products=catalog.items,loading=!catalog.loaded;
  useCatalogRealtime(catalog.reload);
  useEffect(()=>{getCategories().then(setCategories).catch(console.error);},[]);
  useEffect(()=>{setPage(1);},[selectedCategory]);

  useEffect(() => {
    const sentinel = document.getElementById("products-hero-sentinel");
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setHeroPassed(!entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  if (loading)
    return (
      <div className="min-h-screen bg-[#f0eeff] dark:bg-[#070b14] flex items-center justify-center">
        <div className="w-10 h-10 border-[3px] border-[#e8e5f0] dark:border-white/10 border-t-[#6d4aff] dark:border-t-[#c9a96e] rounded-full animate-spin" />
      </div>
    );

  return (
    <main className="min-h-screen bg-[#f0eeff] dark:bg-[#070b14] transition-colors duration-300">

      {/* HERO */}
      <section className="bg-[#142060] dark:bg-[#0a0a0f] border-b border-[#e8e5f0] dark:border-white/[0.07] px-4 sm:px-5 py-10 sm:py-12 text-center">

        <div className="inline-flex items-center gap-2 bg-[#ede9ff] dark:bg-[#c9a96e]/10 text-[#6d4aff] dark:text-[#c9a96e] text-[11px] font-bold px-4 py-1.5 rounded-full mb-4 uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-[#c9a96e] dark:bg-[#c9a96e] animate-pulse" />
          Campus Marketplace
        </div>

        <h1 className="text-3xl font-extrabold text-[white] dark:text-[#f0ede8]">
          {selectedCategory
            ? categories.find(
                (c) => Number(c.id) === Number(selectedCategory)
              )?.name ?? "All Products"
            : "All Products"}
        </h1>

        <p className="mt-2 text-sm text-[white]/50 dark:text-[#f0ede8]/45">
          Browse items from students in your campus
        </p>

        {/* SEARCH (ONLY AFTER HERO PASSED) */}
        <div
          className={`max-w-lg mx-auto mt-6 transition-all duration-300
            ${
              heroPassed
                ? "opacity-100 translate-y-0"
                : "opacity-0 -translate-y-2 pointer-events-none"
            }`}
        >
          <SearchAutocomplete />
        </div>
      </section>

      {/* HERO SENTINEL (IMPORTANT FOR OBSERVER) */}
      <div id="products-hero-sentinel" />

      {/* MAIN CONTENT */}
      <section className="max-w-[1200px] mx-auto px-4 sm:px-5 py-8">

        {/* Category Filter */}
        <div className="sticky top-[76px] z-40 -mx-4 mb-6 bg-[#f0eeff]/95 px-4 py-3 backdrop-blur-md dark:bg-[#070b14]/95 sm:-mx-5 sm:px-5 md:top-[84px]">
          <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => router.push("/products")}
            className={`px-4 py-1.5 rounded-full border text-xs font-medium transition-all duration-150
              ${
                selectedCategory === null
                  ? "bg-[#6d4aff] dark:bg-[#c9a96e] border-[#6d4aff] dark:border-[#c9a96e] text-white dark:text-[#0a0a0f] font-bold"
                  : "bg-white dark:bg-white/[0.04] border-[#ddd] dark:border-white/10 text-[#555] dark:text-[#f0ede8]/55 hover:border-[#6d4aff] dark:hover:border-[#c9a96e] hover:text-[#6d4aff] dark:hover:text-[#c9a96e]"
              }`}
          >
            All
          </button>

          {visibleCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => router.push(`/products?category=${cat.id}`)}
              className={`px-4 py-1.5 rounded-full border text-xs font-medium transition-all duration-150
                ${
                  selectedCategory === cat.id
                    ? "bg-[#6d4aff] dark:bg-[#c9a96e] border-[#6d4aff] dark:border-[#c9a96e] text-white dark:text-[#0a0a0f] font-bold"
                    : "bg-white dark:bg-white/[0.04] border-[#ddd] dark:border-white/10 text-[#555] dark:text-[#f0ede8]/55 hover:border-[#6d4aff] dark:hover:border-[#c9a96e] hover:text-[#6d4aff] dark:hover:text-[#c9a96e]"
                }`}
            >
              {cat.name}
            </button>
          ))}
          </div>
        </div>

        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center mb-5">
          <h2 className="text-base font-bold text-[#1a1060] dark:text-[#f0ede8]">
            {selectedCategory
              ? categories.find(
                  (c) => Number(c.id) === Number(selectedCategory)
                )?.name ?? "All Products"
              : "All Products"}
          </h2>

          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#ede9ff] dark:bg-[#c9a96e]/10 text-[#6d4aff] dark:text-[#c9a96e]">
            {catalog.pagination.total} item{catalog.pagination.total !== 1 ? "s" : ""}
          </span>
        </div>

        {/* PRODUCTS */}
        {products.length === 0 ? (
          <p className="text-sm text-[#1a1060]/50 dark:text-[#f0ede8]/40 py-6">
            No products found in this category.
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,170px),1fr))] gap-4 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-white dark:bg-white/[0.04] rounded-2xl border border-[#e8e5f0] dark:border-white/[0.07] overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_28px_rgba(109,74,255,0.12)] dark:hover:shadow-[0_8px_28px_rgba(201,169,110,0.1)] hover:border-[#6d4aff] dark:hover:border-[#c9a96e]"
              >
                <ProductCard
                  product={product}
                  onAddToCart={() => {
                    if (!session) {
                      setShowModal(true);
                      return;
                    }

                    fetch("/api/cart", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        product_id: product.id,
                        quantity: 1,
                      }),
                    });
                  }}
                  onClick={() => router.push(`/products/${product.id}`)}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mx-auto max-w-[1200px] px-4 pb-8">{catalog.error&&<p role="alert" className="text-sm text-rose-600">{catalog.error}<button className="ml-3 underline" onClick={catalog.reload}>Retry</button></p>}<Pagination pagination={catalog.pagination} loading={catalog.loading} onPageChange={setPage}/></div>
      {/* LOGIN MODAL */}
      <LoginRequiredModal open={showModal} onClose={() => setShowModal(false)} />
    </main>
  );
}