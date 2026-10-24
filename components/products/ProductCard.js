"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSentiment } from "@/app/hooks/useSentiment";

export function StockBadge({ stock }) {
  if (Number(stock) === 0) return <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">Sold out</span>;
  if (Number(stock) <= 5) return <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-900 dark:bg-amber-400/20 dark:text-amber-200">{stock} left</span>;
  return <span className="rounded-full bg-green-100 px-2 py-1 text-[10px] font-semibold text-green-900 dark:bg-green-400/20 dark:text-green-200">{stock} available</span>;
}

export default function ProductCard({ product, onClick, priority = false }) {
  const [saved, setSaved] = useState(false);
  const router = useRouter();
  const { analyze, result: sentiment, loading: sentimentLoading } = useSentiment();
  const isOutOfStock = Number(product.stock) === 0;
  const sentimentType = sentiment?.label === "NO_REVIEWS" ? "noreviews" : sentiment?.tone;
  const sentimentStyles = {
    positive: "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300",
    negative: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
    mixed: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
    noreviews: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
  };
  const sentimentLabels = { positive: "Good feedback", negative: "Low rated", mixed: "Mixed reviews", noreviews: "No reviews yet" };

  return <>
    <article onClick={() => onClick ? onClick() : product.is_demo ? undefined : router.push(`/products/${product.id}`)} className={`product-card-enter group flex h-full ${product.is_demo ? "cursor-default" : "cursor-pointer"} flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1 hover:border-[#f2c94c]/80 hover:shadow-[0_16px_36px_rgba(15,31,92,0.16)] motion-reduce:transform-none motion-reduce:transition-none dark:border-white/10 dark:bg-slate-900 dark:hover:shadow-[0_16px_36px_rgba(0,0,0,0.4)] ${isOutOfStock ? "opacity-75" : ""}`}>
      <div className="relative aspect-[3/2] overflow-hidden rounded-t-xl bg-slate-100 dark:bg-slate-800">
        {product.demo_icon ? <div aria-hidden="true" className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${product.demo_tone || "from-slate-100 to-slate-200"}`}><span className="select-none text-6xl drop-shadow-sm transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none">{product.demo_icon}</span></div> : <Image src={product.image_url?.trim() ? product.image_url : "/placeholder.png"} alt={product.name || "Product"} width={400} height={300} priority={priority} loading={priority ? "eager" : "lazy"} unoptimized className={`h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none ${isOutOfStock ? "grayscale-[35%]" : ""}`} />}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/25 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none" />
        {product.is_demo && <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-600">Sample</span>}
        <button type="button" aria-label="Save" aria-pressed={saved} onClick={(e) => { e.stopPropagation(); setSaved((value) => !value); }} className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[#0f1f5c] shadow transition duration-200 hover:scale-110 hover:text-[#f2c94c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c94c] motion-reduce:transition-none dark:bg-slate-900/90 dark:text-white">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></svg>
        </button>
      </div>
      <div className="flex flex-1 flex-col p-2.5 sm:p-3">
        <h2 className={`line-clamp-2 min-h-8 text-[15px] font-extrabold leading-4 tracking-tight transition-colors duration-200 group-hover:text-[#0f1f5c] dark:group-hover:text-[#f2c94c] ${isOutOfStock ? "text-slate-500 dark:text-slate-400" : "text-[#0f1f5c] dark:text-slate-100"}`}>{product.name}</h2>
        <p className="mt-0.5 line-clamp-2 min-h-8 text-xs leading-4 text-slate-600 dark:text-slate-300">{product.description || " "}</p>
        <div className="mt-1.5 flex min-h-5 items-center justify-between gap-2">
          {product.is_demo ? <span className="truncate rounded-full border border-[#0f1f5c]/10 bg-[#0f1f5c]/5 px-2.5 py-1 text-xs font-bold text-[#0f1f5c] dark:border-white/10 dark:bg-white/5 dark:text-slate-100">{product.seller_name}</span> : <button type="button" onClick={(e) => { e.stopPropagation(); if (product.seller_id) router.push(`/shop/${product.seller_id}`); }} className="truncate rounded-full border border-[#0f1f5c]/10 bg-[#0f1f5c]/5 px-2.5 py-1 text-left text-xs font-bold text-[#0f1f5c] underline-offset-2 transition-colors hover:border-[#f2c94c]/70 hover:bg-[#f2c94c]/15 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c94c] dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:border-[#f2c94c]/50 dark:hover:bg-[#f2c94c]/10">{product.seller_name || "Campus seller"}</button>}
          {Number(product.average_rating) > 0 ? <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-400/10 dark:text-amber-200"><span className="text-amber-500">★</span>{Number(product.average_rating).toFixed(1)}</span> : <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">New listing</span>}
        </div>
        <div className="mt-2 flex min-h-6 items-center justify-between gap-2">
          <span className={`border-none bg-transparent px-0 py-0 text-base font-semibold ${isOutOfStock ? "text-slate-500 dark:text-slate-400" : "product-price-maroon"}`}>{isOutOfStock ? `₱${Number(product.price || 0).toLocaleString()}` : `₱${Number(product.price || 0).toLocaleString()}`}</span>
          <StockBadge stock={product.stock} />
        </div>
        <div className="mt-1.5 flex min-h-8 flex-wrap items-center gap-1.5">
          <button type="button" onClick={(e) => { e.stopPropagation(); if (!product.is_demo) analyze({ productId: product.id, rating: product.average_rating, totalReviews: product.total_ratings, text: product.description }); }} disabled={sentimentLoading || product.is_demo} className="inline-flex items-center gap-1.5 rounded-full border border-[#0f1f5c]/15 bg-[#0f1f5c]/5 px-2.5 py-1 text-[10px] font-semibold text-[#0f1f5c] transition hover:bg-[#0f1f5c]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c94c] disabled:opacity-60 dark:border-white/15 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10">
            <span aria-hidden="true">✦</span>{product.is_demo ? "Sample reviews" : sentimentLoading ? "Reading reviews…" : "Review insight"}
          </button>
          {sentiment && <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${sentimentStyles[sentimentType] || sentimentStyles.noreviews}`}>
            <span aria-hidden="true">{sentimentType === "positive" ? "☺" : sentimentType === "negative" ? "☹" : sentimentType === "mixed" ? "◐" : "✉"}</span>
            {sentimentLabels[sentimentType] || "Review insight"}
            {sentiment.averageRating ? <span className="tabular-nums">· {Number(sentiment.averageRating).toFixed(1)}</span> : null}
          </span>}
        </div>
      </div>
    </article>
  </>;
}
