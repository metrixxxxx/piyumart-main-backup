"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";

export default function HeroSlider() {
  const [products, setProducts] = useState([]);
  const [index, setIndex] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState("next");
  const [visible, setVisible] = useState(true);
  const intervalRef = useRef(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/products/featured");
        const data = await res.json().catch(() => []);
        setProducts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Fetch failed:", err);
        setProducts([]);
      }
    }
    load();
  }, []);

  const goTo = (nextIndex, dir = "next") => {
    if (animating) return;
    setDirection(dir);
    setAnimating(true);
    setVisible(false);
    setTimeout(() => {
      setIndex(nextIndex);
      setVisible(true);
      setAnimating(false);
    }, 420);
  };

  useEffect(() => {
    if (products.length === 0) return;
    intervalRef.current = setInterval(() => {
      goTo((index + 1) % products.length, "next");
    }, 5000);
    return () => clearInterval(intervalRef.current);
  }, [products, index, animating]);

  if (products.length === 0) {
    return (
      <div className="h-[280px] sm:h-[360px] lg:h-[440px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#c9a028] border-t-transparent rounded-full animate-spin" />
          <span className="text-white/40 text-xs tracking-widest uppercase">Loading deals</span>
        </div>
      </div>
    );
  }

  const product = products[index];
  const imgSrc = product.image_url
    ? product.image_url.startsWith("http")
      ? product.image_url
      : product.image_url.startsWith("/")
      ? product.image_url
      : `/${product.image_url}`
    : "https://via.placeholder.com/1200x400?text=No+Image";

  return (
    <>
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeSlideRight {
          from { opacity: 0; transform: translateX(-28px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(1.06); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes progressBar {
          from { width: 0%; }
          to   { width: 100%; }
        }

        .hero-img-enter  { animation: scaleIn 0.55s cubic-bezier(0.22,1,0.36,1) forwards; }
        .hero-tag-enter  { animation: fadeSlideDown 0.4s 0.05s ease both; }
        .hero-name-enter { animation: fadeSlideUp 0.45s 0.12s ease both; }
        .hero-desc-enter { animation: fadeSlideUp 0.45s 0.22s ease both; }
        .hero-price-enter{ animation: fadeSlideUp 0.45s 0.3s ease both; }
        .hero-cta-enter  { animation: fadeSlideUp 0.45s 0.38s ease both; }

        .hero-shimmer-text {
          background: linear-gradient(90deg, #c9a028 0%, #f5d87a 40%, #c9a028 60%, #f5d87a 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 3s linear infinite;
        }

        .progress-bar {
          animation: progressBar 5s linear forwards;
        }

        .hero-arrow {
          transition: all 0.2s ease;
        }
        .hero-arrow:hover {
          transform: scale(1.08);
        }
        .hero-arrow:active {
          transform: scale(0.95);
        }
      `}</style>

      <div className="relative w-full h-[280px] sm:h-[360px] lg:h-full lg:min-h-[440px] overflow-hidden shadow-none">

        {/* BG IMAGE */}
        {visible && (
          <img
            key={`img-${index}`}
            src={imgSrc}
            alt={product.name}
            className="hero-img-enter absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* LAYERED OVERLAYS for depth */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-black/10 z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />

        {/* DECORATIVE ACCENT LINE */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-[#c9a028] to-transparent z-20 opacity-80" />

        {/* CONTENT — left-aligned editorial layout */}
        <div className="absolute inset-0 z-20 flex flex-col justify-center px-7 sm:px-12 lg:px-14 max-w-[65%] sm:max-w-[55%]">

          {visible && (
            <>
              {/* CATEGORY PILL */}
              <div className="hero-tag-enter mb-3 sm:mb-4">
                <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-bold tracking-widest uppercase bg-[#c9a028]/20 border border-[#c9a028]/40 text-[#f5d87a] px-3 py-1 rounded-full backdrop-blur-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#c9a028] animate-pulse" />
                  Featured Deal
                </span>
              </div>

              {/* PRODUCT NAME */}
              <h2 className="hero-name-enter text-xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight tracking-tight drop-shadow-lg">
                {product.name}
              </h2>

              {/* DESCRIPTION */}
              <p className="hero-desc-enter mt-2 text-white/60 text-xs sm:text-sm leading-relaxed line-clamp-2 max-w-xs">
                {product.description}
              </p>

              {/* PRICE */}
              <div className="hero-price-enter mt-3 sm:mt-4 flex items-baseline gap-2">
                <span className="hero-shimmer-text text-2xl sm:text-3xl font-black tracking-tight">
                  ₱{Number(product.price).toLocaleString()}
                </span>
              </div>

              {/* CTA */}
              <div className="hero-cta-enter mt-4 sm:mt-5">
                <Link
                  href={`/products/${product.id}`}
                  className="group inline-flex items-center gap-2 bg-[#c9a028] hover:bg-[#dbb53a] text-[#0e1a3d] text-xs sm:text-sm font-extrabold py-2.5 px-5 sm:px-6 rounded-full shadow-lg shadow-[#c9a028]/30 transition-all duration-200 hover:shadow-[#c9a028]/50 hover:scale-[1.03] active:scale-95"
                >
                  View Product
                  <svg className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </div>
            </>
          )}
        </div>

        {/* SLIDE COUNTER — top right */}
        <div className="absolute top-4 right-4 z-30 flex items-center gap-1.5">
          <span className="text-white font-bold text-sm tabular-nums">{String(index + 1).padStart(2, "0")}</span>
          <span className="text-white/30 text-xs">/</span>
          <span className="text-white/40 text-xs tabular-nums">{String(products.length).padStart(2, "0")}</span>
        </div>

        {/* ARROWS — bottom right stacked */}
        <div className="absolute bottom-5 right-5 z-30 flex gap-2">
          <button
            onClick={() => goTo((index - 1 + products.length) % products.length, "prev")}
            className="hero-arrow w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-[#c9a028] border border-white/20 hover:border-[#c9a028] text-white backdrop-blur-sm flex items-center justify-center shadow-lg"
            aria-label="Previous"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button
            onClick={() => goTo((index + 1) % products.length, "next")}
            className="hero-arrow w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-[#c9a028] border border-white/20 hover:border-[#c9a028] text-white backdrop-blur-sm flex items-center justify-center shadow-lg"
            aria-label="Next"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>

        {/* PROGRESS BAR DOTS — bottom center */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5">
          {products.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i, i > index ? "next" : "prev")}
              aria-label={`Go to slide ${i + 1}`}
              className={`rounded-full transition-all duration-300 ${
                i === index
                  ? "w-6 h-1.5 bg-[#c9a028]"
                  : "w-1.5 h-1.5 bg-white/30 hover:bg-white/60"
              }`}
            />
          ))}
        </div>

        {/* PROGRESS LINE — very bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5 z-30">
          <div
            key={`progress-${index}`}
            className="progress-bar h-full bg-[#c9a028]/60"
          />
        </div>

      </div>
    </>
  );
}