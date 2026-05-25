"use client";

import { useEffect, useState, useRef, useReducer } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import SearchAutocomplete from "@/components/SearchAutocomplete";

// ─── Typewriter hook ──────────────────────────────────────────────────────────
function useTypewriter(text, speed = 60) {
  const [state, dispatch] = useReducer(
    (s, a) => {
      if (a.type === "reset") return { display: "", done: false };
      if (a.type === "tick")  return { display: a.display, done: a.done };
      return s;
    },
    { display: "", done: false }
  );

  useEffect(() => {
    if (!text) return;
    dispatch({ type: "reset" });
    let i = 0;
    const t = setInterval(() => {
      i++;
      dispatch({ type: "tick", display: text.slice(0, i), done: i >= text.length });
      if (i >= text.length) clearInterval(t);
    }, speed);
    return () => clearInterval(t);
  }, [text, speed]);

  return { display: state.display, done: state.done };
}

export default function HeroSection() {
  const { data: session } = useSession();
  const router = useRouter();

  // slider state
  const [products, setProducts] = useState([]);
  const [index, setIndex]       = useState(0);
  const [animating, setAnimating] = useState(false);
  const [visible, setVisible]   = useState(true);
  const [direction, setDirection] = useState("next");
  const intervalRef = useRef(null);

  // greeting
  const h = typeof window !== "undefined" ? new Date().getHours() : 12;
  const greeting = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const firstName = session?.user?.name?.split(" ")[0] || "";
  const { display: typedName, done: nameDone } = useTypewriter(firstName);

  // fetch featured
  useEffect(() => {
    fetch("/api/products/featured")
      .then(r => r.json()).catch(() => [])
      .then(d => setProducts(Array.isArray(d) ? d : []));
  }, []);

  const goTo = (next, dir = "next") => {
    if (animating) return;
    setDirection(dir);
    setAnimating(true);
    setVisible(false);
    setTimeout(() => { setIndex(next); setVisible(true); setAnimating(false); }, 400);
  };

  useEffect(() => {
    if (!products.length) return;
    intervalRef.current = setInterval(() =>
      goTo((index + 1) % products.length, "next"), 5000);
    return () => clearInterval(intervalRef.current);
  }, [products, index, animating]);

  const product = products[index];
  const imgSrc = product?.image_url
    ? product.image_url.startsWith("http") ? product.image_url
      : product.image_url.startsWith("/") ? product.image_url
      : `/${product.image_url}`
    : null;

  return (
    <>
      <style>{`
        @keyframes scaleIn {
          from { opacity:0; transform:scale(1.07); }
          to   { opacity:1; transform:scale(1); }
        }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(16px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes fadeDown {
          from { opacity:0; transform:translateY(-12px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position:-200% center; }
          100% { background-position:200% center; }
        }
        @keyframes progress {
          from { width:0%; }
          to   { width:100%; }
        }
        @keyframes orb1 {
          0%,100% { transform:translate(0,0); }
          50%     { transform:translate(16px,-20px); }
        }
        @keyframes orb2 {
          0%,100% { transform:translate(0,0); }
          50%     { transform:translate(-12px,16px); }
        }
        @keyframes blink {
          0%,100% { opacity:1; } 50% { opacity:0; }
        }

        .hs-img     { animation:scaleIn 0.55s cubic-bezier(0.22,1,0.36,1) both; }
        .hs-tag     { animation:fadeDown 0.4s 0.05s ease both; }
        .hs-name    { animation:fadeUp  0.45s 0.1s  ease both; }
        .hs-desc    { animation:fadeUp  0.45s 0.2s  ease both; }
        .hs-price   { animation:fadeUp  0.45s 0.28s ease both; }
        .hs-cta     { animation:fadeUp  0.45s 0.36s ease both; }
        .hs-badge   { animation:fadeDown 0.5s 0.1s cubic-bezier(0.34,1.56,0.64,1) both; }
        .hs-h1      { animation:fadeUp  0.55s 0.22s ease both; }
        .hs-sub     { animation:fadeUp  0.5s  0.36s ease both; }
        .hs-search  { animation:fadeUp  0.5s  0.48s ease both; }
        .hs-chips   { animation:fadeUp  0.5s  0.6s  ease both; }

        .shimmer-gold {
          background:linear-gradient(90deg,#c9a028 0%,#f5d87a 40%,#c9a028 60%,#f5d87a 100%);
          background-size:200% auto;
          -webkit-background-clip:text;
          -webkit-text-fill-color:transparent;
          background-clip:text;
          animation:shimmer 3s linear infinite;
        }
        .progress-bar { animation:progress 5s linear forwards; }

        .orb-a { animation:orb1 7s ease-in-out infinite; }
        .orb-b { animation:orb2 9s ease-in-out infinite; }

        .cursor {
          display:inline-block; width:2px; height:.9em;
          background:#c9a028; margin-left:2px; vertical-align:text-bottom;
          animation:blink 0.75s step-end infinite;
        }
        .arrow-btn { transition:all 0.18s ease; }
        .arrow-btn:hover  { background:rgba(201,160,40,0.9) !important; border-color:#c9a028 !important; }
        .arrow-btn:active { transform:scale(0.93); }
        .chip { transition:all 0.15s ease; }
        .chip:hover { background:rgba(201,160,40,0.15); border-color:rgba(201,160,40,0.45); color:#f5d87a; transform:translateY(-1px); }
        .search-wrap:focus-within { border-color:rgba(201,160,40,0.55) !important; box-shadow:0 0 0 3px rgba(201,160,40,0.1); }
      `}</style>

      {/* OUTER CARD */}
      <div className="w-full rounded-2xl overflow-visible flex flex-col lg:flex-row" style={{ minHeight:440, boxShadow:"0 0 0 1.5px rgba(201,160,40,0.25), 0 28px 70px rgba(0,0,0,0.6)" }}>

        {/* ── LEFT: hero panel ─────────────────────────────────────── */}
        <div className="relative lg:w-[45%] flex-shrink-0 flex flex-col justify-center px-8 sm:px-10 py-10 lg:py-0" style={{ minHeight:300, background:"linear-gradient(140deg,#112060 0%,#0c1840 45%,#080f25 100%)" }}>

          {/* blue glow */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background:"radial-gradient(ellipse 70% 60% at 15% 50%,rgba(30,55,140,0.4) 0%,transparent 70%)" }} />

          {/* orbs */}
          <div className="orb-a absolute top-[8%] left-[10%] w-44 h-44 rounded-full pointer-events-none"
            style={{ background:"radial-gradient(circle,rgba(201,160,40,0.28) 0%,transparent 70%)" }} />
          <div className="orb-b absolute bottom-[10%] right-[6%] w-36 h-36 rounded-full pointer-events-none"
            style={{ background:"radial-gradient(circle,rgba(26,42,108,0.75) 0%,transparent 70%)" }} />

          {/* left gold rule */}
          <div className="absolute left-0 top-10 bottom-10 w-[3px] rounded-r-full"
            style={{ background:"linear-gradient(to bottom,transparent,#c9a028,transparent)" }} />
          {/* right gold divider */}
          <div className="absolute right-0 top-0 bottom-0 w-px"
            style={{ background:"linear-gradient(to bottom,transparent,rgba(201,160,40,0.35) 30%,rgba(201,160,40,0.35) 70%,transparent)" }} />

          {/* content */}
          <div className="relative z-10 flex flex-col gap-0">

            {/* badge */}
            <div className="hs-badge mb-4">
              {session ? (
                <span className="inline-flex items-center gap-2 text-[11px] font-bold tracking-widest uppercase bg-[#c9a028]/15 border border-[#c9a028]/30 text-[#f5d87a] px-3.5 py-1.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#c9a028] animate-pulse shrink-0" />
                  {greeting},&nbsp;{typedName}{!nameDone && <span className="cursor" />}
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 text-[11px] font-bold tracking-widest uppercase bg-white/5 border border-white/10 text-white/45 px-3.5 py-1.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/25 animate-pulse" />
                  Campus Marketplace
                </span>
              )}
            </div>

            {/* headline */}
            <h1 className="hs-h1 text-[1.85rem] sm:text-[2.3rem] font-black text-white leading-[1.12] tracking-tight">
              Your campus{" "}
              <span className="shimmer-gold">deals,</span>
              <br />all in one place.
            </h1>

            {/* sub */}
            <p className="hs-sub mt-3 text-white/40 text-xs sm:text-sm leading-relaxed max-w-[270px]">
              Discover student listings, second-hand finds, and local campus offers.
            </p>

            {/* search */}
            <div className="hs-search mt-5 relative z-50">
              <SearchAutocomplete />
            </div>

            {/* chips */}
            <div className="hs-chips mt-3 flex flex-wrap gap-2">
              {["Electronics","Clothing","Books","Food"].map(tag => (
                <button key={tag} onClick={() => router.push(`/?q=${tag}`)}
                  className="chip text-[10px] font-semibold text-white/35 border border-white/[0.1] px-2.5 py-1 rounded-full">
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT: slider ────────────────────────────────────────── */}
        <div className="relative lg:flex-1 overflow-visible bg-[#080d1e]" style={{ minHeight: 280 }}>

          {/* image */}
          {visible && imgSrc && (
            <Image
              key={`img-${index}`}
              src={imgSrc}
              alt={product?.name || "Featured product"}
              fill
              className="hs-img object-cover"
              priority={index === 0}
              loading={index === 0 ? "eager" : "lazy"}
              unoptimized
            />
          )}

          {/* loading state */}
          {!products.length && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-2 border-[#c9a028] border-t-transparent rounded-full animate-spin" />
              <span className="text-white/30 text-xs tracking-widest uppercase">Loading deals</span>
            </div>
          )}

          {/* overlays */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-black/5 z-10" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent z-10" />

          {/* content */}
          {visible && product && (
            <div className="absolute inset-0 z-20 flex flex-col justify-center px-7 sm:px-10 max-w-[70%]">
              <div className="hs-tag mb-3">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase bg-[#c9a028]/20 border border-[#c9a028]/35 text-[#f5d87a] px-3 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#c9a028] animate-pulse" />
                  Featured Deal
                </span>
              </div>
              <h2 className="hs-name text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight tracking-tight drop-shadow-lg">
                {product.name}
              </h2>
              <p className="hs-desc mt-1.5 text-white/55 text-xs sm:text-sm line-clamp-2 max-w-[240px]">
                {product.description}
              </p>
              <div className="hs-price mt-3">
                <span className="shimmer-gold text-2xl sm:text-3xl font-black tracking-tight">
                  ₱{Number(product.price).toLocaleString()}
                </span>
              </div>
              <div className="hs-cta mt-4">
                <Link href={`/products/${product.id}`}
                  className="group inline-flex items-center gap-2 bg-[#c9a028] hover:bg-[#dbb53a] text-[#0e1a3d] text-xs sm:text-sm font-extrabold py-2.5 px-5 rounded-full shadow-lg shadow-[#c9a028]/25 transition-all duration-200 hover:scale-[1.03] active:scale-95">
                  View Product
                  <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </div>
            </div>
          )}

          {/* slide counter */}
          {products.length > 0 && (
            <div className="absolute top-4 right-4 z-30 flex items-center gap-1">
              <span className="text-white font-bold text-sm tabular-nums">{String(index+1).padStart(2,"0")}</span>
              <span className="text-white/25 text-xs mx-0.5">/</span>
              <span className="text-white/35 text-xs tabular-nums">{String(products.length).padStart(2,"0")}</span>
            </div>
          )}

          {/* arrows */}
          {products.length > 1 && (
            <div className="absolute bottom-5 right-5 z-30 flex gap-2">
              <button onClick={() => goTo((index-1+products.length)%products.length,"prev")}
                aria-label="Previous"
                className="arrow-btn w-9 h-9 rounded-full bg-white/10 border border-white/15 text-white flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <button onClick={() => goTo((index+1)%products.length,"next")}
                aria-label="Next"
                className="arrow-btn w-9 h-9 rounded-full bg-white/10 border border-white/15 text-white flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          )}

          {/* dots */}
          {products.length > 1 && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5">
              {products.map((_,i) => (
                <button key={i} onClick={() => goTo(i, i>index?"next":"prev")}
                  aria-label={`Slide ${i+1}`}
                  className={`rounded-full transition-all duration-300 ${i===index?"w-6 h-1.5 bg-[#c9a028]":"w-1.5 h-1.5 bg-white/30 hover:bg-white/60"}`} />
              ))}
            </div>
          )}

          {/* progress line */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5 z-30">
            <div key={`p-${index}`} className="progress-bar h-full bg-[#c9a028]/50" />
          </div>

        </div>
      </div>

      {/* ── Sentinel: Navbar watches this to show/hide search ── */}
      <div id="hero-sentinel" />
    </>
  );
}