"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const CATEGORIES = [
  "Electronics", "Clothing", "Books",
  "Food & Drinks", "Home & Living", "Sports", "Beauty", "Toys"
];

export default function SearchAutocomplete({ variant = "default" }) {
  const header = variant === "header";
  const InputContainer = header ? "form" : "div";
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [notFound, setNotFound] = useState(false);

  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const router = useRouter();
  const { data: session } = useSession();

  function highlightMatch(text = "", query = "") {
    if (!query || !text) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    return text.split(regex).map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <span key={i} className="bg-yellow-300 dark:bg-yellow-500/40 font-semibold rounded px-0.5">
          {part}
        </span>
      ) : part
    );
  }

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch suggestions
  useEffect(() => {
    const trimmedQuery = query.trim();
    const controller = new AbortController();

    const fetchProducts = async () => {
      if (!trimmedQuery) {
        setSuggestions([]);
        setIsOpen(false);
        setNotFound(false);
        return;
      }
      try {
        setLoading(true);
        const res = await fetch(
          `/api/products/search?q=${encodeURIComponent(trimmedQuery)}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        const safeData = Array.isArray(data) ? data : [];
        const filtered = session?.user?.id
          ? safeData.filter((p) => String(p.seller_id) !== String(session.user.id))
          : safeData;

        setSuggestions(filtered);
        setNotFound(filtered.length === 0);
        setIsOpen(true);
        setActiveIndex(-1);
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error("Search error:", err);
        setSuggestions([]);
        setIsOpen(false);
        setNotFound(false);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    const timer = setTimeout(fetchProducts, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, session?.user?.id]);

  function handleSelectProduct(productId) {
    router.push(`/products/${productId}`);
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
    setNotFound(false);
    setActiveIndex(-1);
  }

  function handleSelectCategory(cat) {
    router.push(`/?q=${encodeURIComponent(cat)}`);
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
    setNotFound(false);
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    if (!query.trim()) { inputRef.current?.focus(); return; }
    router.push(`/?q=${encodeURIComponent(query.trim())}`);
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e) {
    if (!isOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        handleSelectProduct(suggestions[activeIndex].id);
      } else if (query.trim()) {
        router.push(`/?q=${encodeURIComponent(query.trim())}`);
        setIsOpen(false);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* SEARCH INPUT */}
      <InputContainer role={header ? "search" : undefined} aria-label={header ? "Marketplace search" : undefined}
        action={header ? "/" : undefined} onSubmit={header ? handleSearchSubmit : undefined}
        className={header ? "relative flex h-11 w-full rounded-sm border border-[#1a2a6c] bg-white focus-within:ring-2 focus-within:ring-[#FABB00] dark:border-[#FABB00]/70 dark:bg-[#101a30]" : "relative"}>
        {!header && <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0f1f5c] dark:text-[#FABB00] pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>}

        <input
                maxLength={100}
          ref={inputRef}
          type="text"
          name={header ? "q" : undefined}
          aria-label="Search products"
          placeholder={header ? "Search products..." : "Search by keyword, category, or price..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.trim() && (suggestions.length > 0 || notFound)) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className={header ? "min-w-0 flex-1 rounded-l-sm bg-transparent py-2 pl-3 pr-10 text-sm text-[#0e1a3d] outline-none placeholder:text-slate-500 dark:text-[#e8edf8] dark:placeholder:text-slate-400" : "h-11 w-full rounded-xl border-[1.5px] border-[#c5cfe8] bg-white py-2 pl-10 pr-10 text-sm text-[#0e1a3d] outline-none placeholder:text-slate-600 transition-colors focus:border-[#FABB00] focus:ring-2 focus:ring-[#FABB00] dark:border-white/15 dark:bg-slate-900 dark:text-[#e8edf8] dark:placeholder:text-slate-300"}
        />

        {loading && (
          <div className={`absolute top-1/2 -translate-y-1/2 ${header ? "right-[4.25rem]" : "right-3"}`}>
            <div className="w-4 h-4 border-2 border-[#1a2a6c]/20 dark:border-[#FABB00]/20 border-t-[#1a2a6c] dark:border-t-[#FABB00] rounded-full animate-spin" />
          </div>
        )}

        {query && !loading && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              setSuggestions([]);
              setIsOpen(false);
              setNotFound(false);
              setActiveIndex(-1);
              inputRef.current?.focus();
            }}
            className={`absolute top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center text-sm text-[#0e1a3d]/40 transition-colors hover:text-[#0e1a3d] dark:text-[#e8edf8]/40 dark:hover:text-[#e8edf8] ${header ? "right-[4.25rem]" : "right-3"}`}
          >
            ✕
          </button>
        )}
        {header && <button type="submit" aria-label="Submit product search" className="flex w-14 shrink-0 items-center justify-center rounded-r-[1px] bg-[#1a2a6c] text-[#FABB00] transition-colors hover:bg-[#13214c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FABB00]">
          <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
        </button>}
      </InputContainer>

      {/* DROPDOWN */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#0e1520] rounded-xl border border-[#c5cfe8] dark:border-white/10 shadow-lg z-50 max-h-96 overflow-y-auto overscroll-contain ring-1 ring-black/5">

          {/* ── NO RESULTS ── */}
          {notFound ? (
            <div className="p-5 flex flex-col items-center gap-3">
              <div className="text-3xl select-none">🔍</div>
              <div className="text-center">
                <p className="text-sm font-semibold text-[#0e1a3d] dark:text-[#e8edf8]">
                  No results for &ldquo;{query}&rdquo;
                </p>
                <p className="text-xs text-[#0e1a3d]/50 dark:text-[#e8edf8]/40 mt-1">
                  Try browsing a category instead:
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleSelectCategory(cat)}
                    className="text-[11px] font-medium px-3 py-1.5 rounded-full border border-[#c5cfe8] dark:border-white/10 text-[#1a2a6c] dark:text-[#FABB00] hover:bg-[#e8edf8] dark:hover:bg-white/10 transition-colors"
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

          ) : (
            // ── RESULTS ──
            <div className="divide-y divide-[#e8edf8]/10">
              <div className="px-4 pt-2.5 pb-1.5 flex items-center justify-between">
                <span className="text-[10px] text-[#0e1a3d]/40 dark:text-[#e8edf8]/30">
                  {suggestions.length} result{suggestions.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
                </span>
                <span className="text-[10px] text-[#0e1a3d]/30 dark:text-[#e8edf8]/25 hidden sm:block">
                  ↑↓ to navigate · Enter to select · Esc to close
                </span>
              </div>

              {suggestions.map((product, i) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => handleSelectProduct(product.id)}
                  className={`w-full px-4 py-3 flex items-center gap-3 transition text-left ${
                    i === activeIndex
                      ? "bg-[#e8edf8] dark:bg-white/10"
                      : "hover:bg-[#f0f4ff] dark:hover:bg-white/5"
                  }`}
                >
                  <Image
                    src={product.image_url?.trim() ? product.image_url : "/placeholder.png"}
                    alt={product.name || "Product"}
                    width={40}
                    height={40}
                    unoptimized
                    className="w-10 h-10 rounded-lg object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0e1a3d] dark:text-[#e8edf8] truncate">
                      {highlightMatch(product.name, query)}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#0e1a3d]/50 dark:text-[#e8edf8]/50">
                      <span className="font-bold text-[#1a2a6c] dark:text-[#FABB00]">
                        ₱{Number(product.price || 0).toLocaleString()}
                      </span>
                      {product.sold_count > 0 && (
                        <><span>·</span><span>📦 {product.sold_count} sold</span></>
                      )}
                      {product.average_rating && (
                        <><span>·</span><span>⭐ {Number(product.average_rating).toFixed(1)}</span></>
                      )}
                      {product.category && (
                        <><span>·</span><span className="truncate">{highlightMatch(product.category, query)}</span></>
                      )}
                    </div>
                  </div>
                  {i === activeIndex && (
                    <span className="text-[#1a2a6c] dark:text-[#FABB00] text-xs shrink-0">→</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
