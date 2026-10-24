"use client";
import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import ProductCard from "@/components/products/ProductCard";

import HeroSection from "@/components/HeroSection";
import Footer from "@/components/Footer";

const PRODUCTS_PER_PAGE = 20;

// Frontend-only sample listings for local development; never written to the database.
const DEMO_PRODUCT_TEMPLATES = [
  { name: "Calculus: Early Transcendentals, 8th Ed.", description: "Used for one semester. Clean pages with light cover wear; no missing pages.", price: 850, stock: 1, rating: 4.9, reviews: 8, category: "Books", image_url: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=640&q=80" },
  { name: "Casio fx-991ES Plus Scientific Calculator", description: "Fully working, with hard case and fresh battery. Small scratches on the back.", price: 650, stock: 1, rating: 4.8, reviews: 12, category: "Electronics", image_url: "https://images.unsplash.com/photo-1587145820266-a5951ee6f620?auto=format&fit=crop&w=640&q=80" },
  { name: "Heather Gray Campus Hoodie, Size M", description: "Pre-loved and freshly washed. Soft fleece lining; fits true to size.", price: 450, stock: 1, rating: 4.7, reviews: 6, category: "Clothing", image_url: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=640&q=80" },
  { name: "Chicken Teriyaki Bento", description: "Grilled chicken, rice, and vegetables. Prepared fresh for lunchtime pickup.", price: 125, stock: 7, rating: 5, reviews: 3, category: "Food & Drinks", image_url: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=640&q=80" },
  { name: "Yonex Badminton Racket with Cover", description: "Lightweight beginner racket in good condition. Grip recently replaced.", price: 550, stock: 1, rating: 4.6, reviews: 5, category: "Sports", image_url: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=640&q=80" },
  { name: "LED Study Lamp with USB Port", description: "Three brightness levels and flexible neck. Works perfectly; includes USB cable.", price: 275, stock: 1, rating: 0, reviews: 0, category: "Home & Living", image_url: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=640&q=80" },
  { name: "Natural Canvas Book Tote", description: "Roomy, sturdy tote with reinforced handles. Lightly used and freshly cleaned.", price: 180, stock: 1, rating: 4.8, reviews: 4, category: "Clothing", image_url: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=640&q=80" },
  { name: "Wireless Earbuds with Charging Case", description: "Bluetooth earbuds with charging case and extra silicone tips. Tested and working.", price: 790, stock: 1, rating: 4.5, reviews: 9, category: "Electronics", image_url: "https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?auto=format&fit=crop&w=640&q=80" },
  { name: "Biology Reviewer: Cell Biology", description: "Neatly organized reviewer with diagrams and chapter summaries. Printed and bound.", price: 120, stock: 1, rating: 4.9, reviews: 7, category: "Books", image_url: "https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&w=640&q=80" },
  { name: "Fresh Mango Graham Shake, 16 oz", description: "Made to order with ripe mango and chilled milk. Best enjoyed the same day.", price: 75, stock: 6, rating: 4.8, reviews: 11, category: "Food & Drinks", image_url: "https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=640&q=80" },
  { name: "Molten Volleyball, Size 5", description: "Good grip with no air leaks. Used for a few PE classes; still in great shape.", price: 390, stock: 1, rating: 4.6, reviews: 3, category: "Sports", image_url: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=640&q=80" },
  { name: "Potted Mini Succulent", description: "Easy-care live succulent in a small ceramic pot. Great for a desk or windowsill.", price: 110, stock: 4, rating: 4.9, reviews: 5, category: "Home & Living", image_url: "https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=640&q=80" },
  { name: "Compact Folding Pocket Mirror", description: "Clean, scratch-free double-sided mirror with a slim case that fits in a pouch.", price: 85, stock: 1, rating: 4.7, reviews: 4, category: "Beauty", image_url: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=640&q=80" },
  { name: "A5 Grid Notebook, 3-Pack", description: "Three barely used notebooks with squared pages. No writing or torn sheets.", price: 90, stock: 3, rating: 4.8, reviews: 6, category: "Books", image_url: "https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=640&q=80" },
  { name: "Bamboo Desk Organizer", description: "Keeps pens, sticky notes, and clips in one place. A few light surface marks.", price: 150, stock: 1, rating: 4.5, reviews: 2, category: "Home & Living", image_url: "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=640&q=80" },
  { name: "Chicken Rice Bowl with Garlic Sauce", description: "Grilled chicken over steamed rice with vegetables and house-made garlic sauce.", price: 110, stock: 9, rating: 4.9, reviews: 14, category: "Food & Drinks", image_url: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=640&q=80" },
  { name: "Nike Revolution Running Shoes, Size 8", description: "Pre-loved pair with clean insoles and plenty of tread left. No tears or loose seams.", price: 850, stock: 1, rating: 4.4, reviews: 8, category: "Clothing", image_url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=640&q=80" },
  { name: "Braided USB-C Charging Cable, 1 m", description: "Fast-charging cable with a braided outer layer. Tested with Android phones and tablets.", price: 130, stock: 2, rating: 4.6, reviews: 10, category: "Electronics", image_url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=640&q=80" },
  { name: "Medical Terminology Flashcards", description: "Color-coded study cards with clear notes. Complete set in a reusable storage box.", price: 90, stock: 1, rating: 4.8, reviews: 3, category: "Books", image_url: "https://images.unsplash.com/photo-1456324504439-367cee3b3c32?auto=format&fit=crop&w=640&q=80" },
  { name: "Stainless Steel Insulated Tumbler, 500 ml", description: "Double-wall tumbler with a leak-resistant lid. Keeps drinks cold; no dents.", price: 260, stock: 1, rating: 4.7, reviews: 7, category: "Home & Living", image_url: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=640&q=80" },
];

const DEMO_SELLERS = ["Mika Santos", "Jules Reyes", "Ana Cruz", "Sam Dela Rosa", "Pat Garcia", "Kai Mendoza"];
const DEMO_PRODUCTS = DEMO_PRODUCT_TEMPLATES.map((template, index) => ({
  id: `demo-product-${index + 1}`,
  name: template.name,
  description: template.description,
  price: template.price,
  stock: template.stock,
  average_rating: template.rating,
  total_ratings: template.reviews,
  total_sold: [18, 4, 11, 32, 7, 2, 15, 9, 6, 28, 3, 12, 5, 16, 21, 24, 8, 10, 13, 19][index],
  seller_name: DEMO_SELLERS[index % DEMO_SELLERS.length],
  category_name: template.category,
  image_url: template.image_url,
  is_demo: true,
}));

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
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 animate-pulse dark:border-white/10 dark:bg-slate-900">
      <div className="aspect-[3/2] rounded-xl bg-slate-200 dark:bg-slate-700" />
      <div className="space-y-2 pt-3">
        <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-4 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-3 h-8 rounded bg-slate-200 dark:bg-slate-700" />
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
  const [search, setSearch]             = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("q") || "");
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
    const applyPopularSearch = (event) => setSearch(String(event.detail || ""));
    window.addEventListener("piyumart:search", applyPopularSearch);
    return () => window.removeEventListener("piyumart:search", applyPopularSearch);
  }, []);

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
        setProducts(process.env.NODE_ENV === "development" ? [...filtered, ...DEMO_PRODUCTS] : filtered);
        setVisibleCount(PRODUCTS_PER_PAGE);
      } catch (err) {
        console.error(err);
        if (process.env.NODE_ENV === "development") setProducts(DEMO_PRODUCTS);
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
    const selectedCategory = categories.find((c) => String(c.id) === category)?.name;
    const matchesCategory =
      category === "all" || String(p.category_id) === String(category) || (p.is_demo && p.category_name === selectedCategory);
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
    <main className="min-h-screen scroll-smooth bg-[#f0eeff] transition-colors duration-300 dark:bg-[#070b14]">

      {/* ── HERO ── */}
      <section className="mx-auto max-w-7xl border-b border-[#c5cfe8] px-3 pb-8 pt-4 sm:px-5 sm:pb-10 sm:pt-6 dark:border-white/10">
        <HeroSection productCount={products.length} />
      </section>

      {/* ── CONTENT ── */}
      <section className="mx-auto max-w-7xl px-3 pb-10 pt-7 sm:px-5 sm:pt-9">

        {/* category tabs */}
        <div className="mb-7 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none sm:flex-wrap">
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
        <div className="mb-5 mt-7 flex flex-col gap-2 sm:mt-9 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-bold tracking-tight text-[#0e1a3d] dark:text-[#e8edf8]">
            {categoryLabel}
          </h2>
          <div className="flex items-center gap-2 sm:gap-3">
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setVisibleCount(PRODUCTS_PER_PAGE); }}
              className="flex-1 rounded-full border border-[#c5cfe8] bg-white px-3 py-2 text-sm font-semibold text-[#0e1a3d] transition-colors hover:border-[#0f1f5c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c94c] dark:border-white/10 dark:bg-[#0e1520] dark:text-white sm:flex-none"
            >
              <option value="newest">Newest First</option>
              <option value="best_rated">Best Rated</option>
              <option value="most_sold">Most Sold</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
            </select>
            <span className="flex-shrink-0 rounded-full bg-[#e8edf8] px-3 py-2 text-sm font-semibold text-[#0f1f5c] dark:bg-[#f2c94c]/10 dark:text-[#f2c94c]">
              {displayed.length} item{displayed.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* product grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(190px,1fr))]">
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
              <ProductCard key={product.id} product={product} />
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
