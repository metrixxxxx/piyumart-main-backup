"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";

export default function HeroSlider() {
  const [products, setProducts] = useState([]);
  const [index, setIndex] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState("next");
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
    setTimeout(() => {
      setIndex(nextIndex);
      setAnimating(false);
    }, 500);
  };

  useEffect(() => {
    if (products.length === 0) return;
    intervalRef.current = setInterval(() => {
      goTo((index + 1) % products.length, "next");
    }, 4000);
    return () => clearInterval(intervalRef.current);
  }, [products, index, animating]);

  if (products.length === 0) {
    return (
      <div className="h-[260px] sm:h-[320px] lg:h-[400px] flex items-center justify-center text-white/50 text-sm">
        Loading featured products...
      </div>
    );
  }

  const product = products[index];

  return (
    <>
      <style>{`
        @keyframes slideInFromRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes slideInFromLeft {
          from { transform: translateX(-100%); opacity: 0; }
          to   { transform: translateX(0);     opacity: 1; }
        }
        .slide-enter-next { animation: slideInFromRight 0.5s ease forwards; }
        .slide-enter-prev { animation: slideInFromLeft 0.5s ease forwards; }
      `}</style>

      <div className="relative w-full h-[260px] sm:h-[320px] lg:h-[400px] overflow-hidden rounded-xl">

        {/* IMAGE */}
        <img
          key={`img-${index}`}
          src={
            product.image_url
              ? product.image_url.startsWith("http")
                ? product.image_url
                : product.image_url.startsWith("/")
                ? product.image_url
                : `/${product.image_url}`
              : "https://via.placeholder.com/1200x400?text=No+Image"
          }
          alt={product.name}
          className={`w-full h-full object-cover absolute inset-0 ${
            direction === "next" ? "slide-enter-next" : "slide-enter-prev"
          }`}
        />

        {/* OVERLAY */}
        <div
          key={`overlay-${index}`}
          className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col items-center justify-end text-center px-4 sm:px-10 pb-10 ${
            direction === "next" ? "slide-enter-next" : "slide-enter-prev"
          }`}
        >
          <h1 className="text-xl sm:text-2xl font-bold text-white drop-shadow-md">
            {product.name}
          </h1>
          <p className="text-white/70 text-xs sm:text-sm mt-1 max-w-md line-clamp-2">
            {product.description}
          </p>
          <p className="text-[#d4aa40] mt-1.5 font-bold text-sm sm:text-base">
            ₱{Number(product.price).toLocaleString()}
          </p>
          <Link
            href={`/products/${product.id}`}
            className="mt-3 inline-block bg-[#1a2a6c] hover:bg-[#142060] text-white text-xs font-semibold py-2 px-5 rounded-full transition-colors duration-150"
          >
            View Product →
          </Link>
        </div>

        {/* ARROWS */}
        <button
          onClick={() => goTo((index - 1 + products.length) % products.length, "prev")}
          className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-9 h-9 flex items-center justify-center z-10 transition-colors"
        >
          ‹
        </button>
        <button
          onClick={() => goTo((index + 1) % products.length, "next")}
          className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-9 h-9 flex items-center justify-center z-10 transition-colors"
        >
          ›
        </button>

        {/* DOTS */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {products.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i, i > index ? "next" : "prev")}
              className={`rounded-full transition-all duration-300 ${
                i === index ? "w-4 h-2 bg-[#d4aa40]" : "w-2 h-2 bg-white/40"
              }`}
            />
          ))}
        </div>

      </div>
    </>
  );
}