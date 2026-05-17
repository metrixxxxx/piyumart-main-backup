"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import ProductCard from "@/components/products/ProductCard";
import { getSocket } from "@/lib/socket";

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    async function fetchCategories() {
      const res = await fetch("/api/categories");
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    }
    fetchCategories();
  }, []);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch("/api/products");
        const data = await res.json();
        const allProducts = Array.isArray(data) ? data : [];
        const filtered = session?.user?.id ? allProducts.filter((p) => String(p.seller_id) !== String(session.user.id)) : allProducts;
        setProducts(filtered);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
    const socket = getSocket();
    socket.on("products:new", (newProduct) => {
      if (session?.user?.id && String(newProduct.seller_id) === String(session.user.id)) return;
      setProducts((prev) => [newProduct, ...prev]);
    });
    socket.on("products:updated", (updated) => {
      setProducts((prev) => prev.map((p) => String(p.id) === String(updated.id) ? { ...p, ...updated } : p));
    });
    socket.on("products:deleted", ({ id }) => {
      setProducts((prev) => prev.filter((p) => String(p.id) !== String(id)));
    });
    return () => { socket.off("products:new"); socket.off("products:updated"); socket.off("products:deleted"); };
  }, [session]);

  const visibleProducts = selectedCategory ? products.filter((p) => String(p.category_id) === String(selectedCategory)) : products;

  function handleAddToCart(product) {
    if (!session) { setShowModal(true); return; }
    fetch("/api/cart", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product_id: product.id, quantity: 1 }) }).then(() => alert(`${product.name} added to cart!`));
  }

  function handleBuyNow(product) {
    if (!session) { setShowModal(true); return; }
    fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product_id: product.id, quantity: 1 }) }).then(() => router.push("/checkout"));
  }

  if (loading) return (
    <div className="min-h-screen bg-[#f0eeff] dark:bg-[#0a0a0f] flex items-center justify-center">
      <div className="w-10 h-10 border-[3px] border-[#e8e5f0] dark:border-white/10 border-t-[#6d4aff] dark:border-t-[#c9a96e] rounded-full animate-spin" />
    </div>
  );

  return (
    <main className="min-h-screen bg-[#f0eeff] dark:bg-[#0a0a0f] transition-colors duration-300">

      {/* HERO */}
      <section className="bg-white dark:bg-[#0a0a0f] border-b border-[#e8e5f0] dark:border-white/[0.07] px-5 py-12 text-center">
        <div className="inline-flex items-center gap-2 bg-[#ede9ff] dark:bg-[#c9a96e]/10 text-[#6d4aff] dark:text-[#c9a96e] text-[11px] font-bold px-4 py-1.5 rounded-full mb-4 uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-[#6d4aff] dark:bg-[#c9a96e] animate-pulse" />
          Campus Marketplace
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#1a1060] dark:text-[#f0ede8]">All Products</h1>
        <p className="mt-2 text-sm text-[#1a1060]/50 dark:text-[#f0ede8]/45">Browse items from students in your campus</p>
      </section>

      <section className="max-w-[1200px] mx-auto px-5 py-8">

        {/* Category Filter */}
        <div className="flex gap-2 flex-wrap mb-6">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-1.5 rounded-full border text-xs font-medium transition-all duration-150
              ${selectedCategory === null
                ? "bg-[#6d4aff] dark:bg-[#c9a96e] border-[#6d4aff] dark:border-[#c9a96e] text-white dark:text-[#0a0a0f] font-bold"
                : "bg-white dark:bg-white/[0.04] border-[#ddd] dark:border-white/10 text-[#555] dark:text-[#f0ede8]/55 hover:border-[#6d4aff] dark:hover:border-[#c9a96e] hover:text-[#6d4aff] dark:hover:text-[#c9a96e]"}`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-1.5 rounded-full border text-xs font-medium transition-all duration-150
                ${selectedCategory === cat.id
                  ? "bg-[#6d4aff] dark:bg-[#c9a96e] border-[#6d4aff] dark:border-[#c9a96e] text-white dark:text-[#0a0a0f] font-bold"
                  : "bg-white dark:bg-white/[0.04] border-[#ddd] dark:border-white/10 text-[#555] dark:text-[#f0ede8]/55 hover:border-[#6d4aff] dark:hover:border-[#c9a96e] hover:text-[#6d4aff] dark:hover:text-[#c9a96e]"}`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Header row */}
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-base font-bold text-[#1a1060] dark:text-[#f0ede8]">
            {selectedCategory ? categories.find((c) => c.id === selectedCategory)?.name : "All Products"}
          </h2>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#ede9ff] dark:bg-[#c9a96e]/10 text-[#6d4aff] dark:text-[#c9a96e]">
            {visibleProducts.length} item{visibleProducts.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Products Grid */}
        {visibleProducts.length === 0 ? (
          <p className="text-sm text-[#1a1060]/50 dark:text-[#f0ede8]/40 py-6">No products found in this category.</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {visibleProducts.map((product) => (
              <div
                key={product.id}
                className="bg-white dark:bg-white/[0.04] rounded-2xl border border-[#e8e5f0] dark:border-white/[0.07] overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_28px_rgba(109,74,255,0.12)] dark:hover:shadow-[0_8px_28px_rgba(201,169,110,0.1)] hover:border-[#6d4aff] dark:hover:border-[#c9a96e]"
              >
                <ProductCard product={product} onAddToCart={() => handleAddToCart(product)} onClick={() => router.push(`/products/${product.id}`)} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Login Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-[#12121a] rounded-2xl border border-[#e8e5f0] dark:border-white/[0.07] p-8 w-[320px] text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-4xl mb-4">🔒</div>
            <h2 className="text-base font-bold text-[#1a1060] dark:text-[#f0ede8] mb-2">Sign in to continue</h2>
            <p className="text-xs text-[#1a1060]/50 dark:text-[#f0ede8]/40 mb-6">You need to be logged in to add items.</p>
            <button onClick={() => router.push("/login")} className="w-full py-2.5 bg-[#6d4aff] dark:bg-[#c9a96e] text-white dark:text-[#0a0a0f] rounded-xl text-sm font-bold hover:opacity-90 transition mb-2">
              Sign in
            </button>
            <button onClick={() => setShowModal(false)} className="w-full py-2.5 border border-[#e8e5f0] dark:border-white/[0.07] text-[#1a1060]/60 dark:text-[#f0ede8]/50 rounded-xl text-sm font-medium hover:border-[#6d4aff] dark:hover:border-[#c9a96e] transition">
              Continue browsing
            </button>
          </div>
        </div>
      )}
    </main>
  );
}