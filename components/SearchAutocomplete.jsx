"use client";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function SearchAutocomplete() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (!query.trim()) return;

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/products`);
        const data = await res.json();
        const allProducts = Array.isArray(data) ? data : [];

        const filtered = allProducts
          .filter((p) =>
            p.name?.toLowerCase().includes(query.toLowerCase()) ||
            p.description?.toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, 8);

        setSuggestions(filtered);
        setIsOpen(filtered.length > 0);
      } catch (err) {
        console.error("Search error:", err);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  function handleSelectProduct(productId) {
    router.push(`/products/${productId}`);
    setQuery("");
    setIsOpen(false);
  }

  return (
    <div className="relative w-full">
      <div className="relative">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0e1a3d]/35 dark:text-[#e8edf8]/35 pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search products..."
          value={query}
          onChange={(e) => {
            const value = e.target.value;
            setQuery(value);
            if (!value.trim()) {
              setSuggestions([]);
              setIsOpen(false);
            }
          }}
          onFocus={() => query.trim() && setIsOpen(suggestions.length > 0)}
          className="w-full py-3 pl-10 pr-10 rounded-xl border-[1.5px] border-[#c5cfe8] dark:border-white/10 bg-[#f0f4ff] dark:bg-white/6 text-[#0e1a3d] dark:text-[#e8edf8] placeholder:text-[#0e1a3d]/30 dark:placeholder:text-[#e8edf8]/30 text-sm outline-none focus:border-[#1a2a6c] dark:focus:border-[#d4aa40] transition-colors"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setSuggestions([]);
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#0e1a3d]/40 dark:text-[#e8edf8]/40 hover:text-[#0e1a3d] dark:hover:text-[#e8edf8] transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* DROPDOWN */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#0e1520] rounded-xl border border-[#c5cfe8] dark:border-white/10 shadow-lg z-50 max-h-96 overflow-y-auto overscroll-contain ring-1 ring-black/5">
          {loading ? (
            <div className="p-4 text-center text-sm text-[#0e1a3d]/50 dark:text-[#e8edf8]/50">
              Searching...
            </div>
          ) : suggestions.length === 0 ? (
            <div className="p-4 text-center text-sm text-[#0e1a3d]/50 dark:text-[#e8edf8]/50">
              No products found
            </div>
          ) : (
            <div className="divide-y divide-[#e8edf8]/10">
              {suggestions.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleSelectProduct(product.id)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#f0f4ff] dark:hover:bg-white/5 transition text-left"
                >
                  <Image
                    src={
                      product.image_url?.trim()
                        ? product.image_url
                        : "https://via.placeholder.com/40x40?text=No+Image"
                    }
                    alt={product.name}
                    width={40}
                    height={40}
                    unoptimized
                    className="w-10 h-10 rounded-lg object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0e1a3d] dark:text-[#e8edf8] truncate">
                      {product.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-[#0e1a3d]/50 dark:text-[#e8edf8]/50">
                      <span className="font-bold text-[#1a2a6c] dark:text-[#d4aa40]">
                        ₱{Number(product.price).toLocaleString()}
                      </span>
                      {product.sold_count > 0 && (
                        <>
                          <span>•</span>
                          <span>📦 {product.sold_count} sold</span>
                        </>
                      )}
                      {product.average_rating > 0 && (
                        <>
                          <span>•</span>
                          <span>⭐ {Number(product.average_rating).toFixed(1)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
