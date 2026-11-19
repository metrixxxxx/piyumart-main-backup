"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSentiment } from "@/app/hooks/useSentiment";
import ListingLocation from "@/components/products/ListingLocation";

export function StockBadge({ stock, compact = false }) {
  const spacing = compact ? "px-1 py-0.5 text-[8px] sm:px-2 sm:py-1 sm:text-[10px]" : "px-2 py-1 text-[10px]";
  if (Number(stock) === 0) return <span className={`max-w-full truncate rounded-full font-semibold ${spacing} bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200`}>Sold out</span>;
  if (Number(stock) <= 5) return <span className={`max-w-full truncate rounded-full font-semibold ${spacing} bg-amber-100 text-amber-900 dark:bg-amber-400/20 dark:text-amber-200`}>{stock} left</span>;
  return <span className={`max-w-full truncate rounded-full font-semibold ${spacing} bg-green-100 text-green-900 dark:bg-green-400/20 dark:text-green-200`}>{stock} available</span>;
}

export default function ProductCard({ product, onClick, priority = false }) {
  const [saved, setSaved] = useState(false);
  const router = useRouter();
  const { analyze, result: sentiment, loading: sentimentLoading } = useSentiment();
  const imageSource=product.image_url||"/placeholder.png";
  let optimizeImage=imageSource.startsWith("/")&&!imageSource.startsWith("//");
  try{optimizeImage=optimizeImage||(new URL(imageSource).protocol==="https:"&&new URL(imageSource).hostname===new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname);}catch{}
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
    <article onClick={() => onClick ? onClick() : product.is_demo ? undefined : router.push(`/products/${product.id}`)} className={`product-card-enter group flex h-full min-w-0 ${product.is_demo ? "cursor-default" : "cursor-pointer"} flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1 hover:border-[#FABB00]/80 hover:shadow-[0_16px_36px_rgba(15,31,92,0.16)] motion-reduce:transform-none motion-reduce:transition-none dark:border-white/10 dark:bg-slate-900 dark:hover:shadow-[0_16px_36px_rgba(0,0,0,0.4)] sm:rounded-xl ${isOutOfStock ? "opacity-75" : ""}`}>
      <div className="relative aspect-square overflow-hidden rounded-t-lg bg-slate-100 dark:bg-slate-800 sm:aspect-[3/2] sm:rounded-t-xl">
        {product.demo_icon ? <div aria-hidden="true" className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${product.demo_tone || "from-slate-100 to-slate-200"}`}><span className="select-none text-3xl drop-shadow-sm transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none sm:text-6xl">{product.demo_icon}</span></div> : <Image src={product.image_url?.trim() ? product.image_url : "/placeholder.png"} alt={product.name || "Product"} width={400} height={300} priority={priority} loading={priority ? "eager" : "lazy"} unoptimized={!optimizeImage} sizes="(max-width: 639px) 25vw, (max-width: 1024px) 33vw, 240px" className={`h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none ${isOutOfStock ? "grayscale-[35%]" : ""}`} />}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/25 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none" />
        {product.is_demo && <span className="absolute bottom-0.5 left-0.5 rounded-full bg-white/90 px-1 py-0.5 text-[7px] font-bold uppercase tracking-wide text-slate-600 sm:bottom-2 sm:left-2 sm:px-2 sm:py-1 sm:text-[9px]">Sample</span>}
        <button type="button" aria-label={`${saved ? "Unsave" : "Save"} ${product.name || "product"}`} aria-pressed={saved} onClick={(e) => { e.stopPropagation(); setSaved((value) => !value); }} className="absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-[#0f1f5c] shadow transition duration-200 hover:scale-110 hover:text-[#FABB00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FABB00] motion-reduce:transition-none dark:bg-slate-900/90 dark:text-white sm:right-2.5 sm:top-2.5 sm:h-8 sm:w-8">
          <svg viewBox="0 0 24 24" className="h-3 w-3 sm:h-4 sm:w-4" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></svg>
        </button>
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-1.5 sm:p-3">
        <h2 className={`line-clamp-2 min-h-7 break-words text-[10px] font-extrabold leading-[14px] tracking-tight transition-colors duration-200 group-hover:text-[#0f1f5c] dark:group-hover:text-[#FABB00] sm:min-h-8 sm:text-[15px] sm:leading-4 ${isOutOfStock ? "text-slate-500 dark:text-slate-400" : "text-[#0f1f5c] dark:text-slate-100"}`}>{product.name}</h2>
        <p className="mt-0.5 hidden min-h-8 text-xs leading-4 text-slate-600 dark:text-slate-300 sm:line-clamp-2">{product.description || " "}</p>
        {!product.is_demo && <div className="hidden sm:block"><ListingLocation product={product} className="mt-2" /></div>}
        <div className="mt-1 flex min-h-3.5 min-w-0 items-center justify-between gap-1 sm:mt-1.5 sm:min-h-5 sm:gap-2">
          {product.is_demo ? <span className="hidden truncate rounded-full border border-[#0f1f5c]/10 bg-[#0f1f5c]/5 px-2.5 py-1 text-xs font-bold text-[#0f1f5c] dark:border-white/10 dark:bg-white/5 dark:text-slate-100 sm:inline">{product.seller_name}</span> : <button type="button" onClick={(e) => { e.stopPropagation(); if (product.seller_id) router.push(`/shop/${product.seller_id}`); }} className="hidden truncate rounded-full border border-[#0f1f5c]/10 bg-[#0f1f5c]/5 px-2.5 py-1 text-left text-xs font-bold text-[#0f1f5c] underline-offset-2 transition-colors hover:border-[#FABB00]/70 hover:bg-[#FABB00]/15 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FABB00] dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:border-[#FABB00]/50 dark:hover:bg-[#FABB00]/10 sm:block">{product.seller_name || "Campus seller"}</button>}
          {Number(product.average_rating) > 0 ? <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-50 px-1 py-0.5 text-[8px] font-semibold text-amber-800 dark:bg-amber-400/10 dark:text-amber-200 sm:gap-1 sm:px-2 sm:py-1 sm:text-xs"><span className="text-amber-500">★</span>{Number(product.average_rating).toFixed(1)}</span> : <span className="shrink-0 rounded-full bg-slate-100 px-1 py-0.5 text-[8px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300 sm:px-2 sm:py-1 sm:text-[10px]"><span className="sm:hidden">New</span><span className="hidden sm:inline">New listing</span></span>}
        </div>
        <div className="mt-1 flex min-w-0 flex-col items-start gap-0.5 sm:mt-2 sm:min-h-6 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <span title={`₱${Number(product.price || 0).toLocaleString()}`} className={`max-w-full truncate border-none bg-transparent px-0 py-0 text-[11px] font-semibold leading-4 sm:text-base sm:leading-6 ${isOutOfStock ? "text-slate-500 dark:text-slate-400" : "product-price-maroon"}`}>₱{Number(product.price || 0).toLocaleString()}</span>
          <StockBadge stock={product.stock} compact />
        </div>
        <div className="mt-1.5 hidden min-h-8 flex-wrap items-center gap-1.5 sm:flex">
          <button type="button" onClick={(e) => { e.stopPropagation(); if (!product.is_demo) analyze({ productId: product.id, rating: product.average_rating, totalReviews: product.total_ratings, text: product.description }); }} disabled={sentimentLoading || product.is_demo} className="inline-flex items-center gap-1.5 rounded-full border border-[#0f1f5c]/15 bg-[#0f1f5c]/5 px-2.5 py-1 text-[10px] font-semibold text-[#0f1f5c] transition hover:bg-[#0f1f5c]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FABB00] disabled:opacity-60 dark:border-white/15 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10">
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
