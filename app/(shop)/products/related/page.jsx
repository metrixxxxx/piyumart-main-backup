"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import ProductCard from "@/components/products/ProductCard";

export default function RelatedProductsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/products/${id}`);
        const productData = await res.json();
        setProduct(productData);

        const relRes = await fetch(
          `/api/products/related?id=${id}&category_id=${productData.category_id || ""}&seller_id=${productData.seller_id || ""}&price=${productData.price || ""}&limit=24`
        );
        const relData = await relRes.json();
        setRelated(Array.isArray(relData) ? relData : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-[#f0eeff] dark:bg-[#0a0a0f]">
      <div className="text-center">
        <div className="w-10 h-10 border-[3px] border-[#e5e7eb] border-t-[#6d4aff] dark:border-t-[#c9a96e] rounded-full mx-auto mb-4 animate-spin" />
        <p className="text-[#1a1060]/50 dark:text-[#f0ede8]/40 text-sm">Loading...</p>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#f0eeff] dark:bg-[#0a0a0f] transition-colors duration-300">

      {/* HEADER */}
      <section className="bg-white dark:bg-[#12121a] border-b border-[#e8e5f0] dark:border-white/[0.07] px-5 py-8">
        <div className="max-w-[1200px] mx-auto">

          {/* back button */}
          <button
            onClick={() => router.push(`/products/${id}`)}
            className="flex items-center gap-2 text-xs font-semibold text-[#1a1060]/50 dark:text-[#f0ede8]/40 hover:text-[#6d4aff] dark:hover:text-[#c9a96e] transition-colors mb-5 bg-transparent border-none cursor-pointer"
          >
            ← Back to product
          </button>

          {/* product mini card */}
          {product && (
            <div
              onClick={() => router.push(`/products/${id}`)}
              className="flex items-center gap-4 bg-[#f5f3ff] dark:bg-white/[0.04] rounded-2xl px-4 py-3 border border-[#e8e5f0] dark:border-white/[0.07] cursor-pointer hover:border-[#6d4aff] dark:hover:border-[#c9a96e] transition-colors w-fit"
            >
              <img
                src={product.images?.[0] || product.image_url || "/placeholder.png"}
                className="w-12 h-12 rounded-xl object-cover shrink-0 border border-[#e8e5f0] dark:border-white/10"
              />
              <div>
                <p className="text-xs text-[#1a1060]/40 dark:text-[#f0ede8]/35">Because you viewed</p>
                <p className="text-sm font-bold text-[#1a1060] dark:text-[#f0ede8]">{product.name}</p>
                {product.category_name && (
                  <span className="text-[11px] text-[#6d4aff] dark:text-[#c9a96e] font-semibold">{product.category_name}</span>
                )}
              </div>
            </div>
          )}

          {/* title */}
          <div className="mt-5">
            <h1 className="text-2xl font-extrabold text-[#1a1060] dark:text-[#f0ede8]">
              {product?.category_name
                ? <>More in <span className="text-[#6d4aff] dark:text-[#c9a96e]">{product.category_name}</span></>
                : <>You might <span className="text-[#6d4aff] dark:text-[#c9a96e]">also like</span></>
              }
            </h1>
            <p className="text-sm text-[#1a1060]/45 dark:text-[#f0ede8]/35 mt-1">
              {related.length} similar product{related.length !== 1 ? "s" : ""} found
            </p>
          </div>
        </div>
      </section>

      {/* GRID */}
      <section className="max-w-[1200px] mx-auto px-5 py-8">
        {related.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[#1a1060]/40 dark:text-[#f0ede8]/30 text-sm">No related products found.</p>
            <button
              onClick={() => router.push("/products")}
              className="mt-4 text-xs font-semibold text-[#6d4aff] dark:text-[#c9a96e] bg-transparent border-none cursor-pointer hover:opacity-75 transition-opacity"
            >
              Browse all products →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,170px),1fr))] gap-4 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
            {related.map((p) => (
              <div
                key={p.id}
                className="bg-white dark:bg-white/[0.04] rounded-2xl border border-[#e8e5f0] dark:border-white/[0.07] overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_28px_rgba(109,74,255,0.12)] dark:hover:shadow-[0_8px_28px_rgba(201,169,110,0.1)] hover:border-[#6d4aff] dark:hover:border-[#c9a96e]"
              >
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
