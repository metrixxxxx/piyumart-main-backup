"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

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

const CATEGORY_DESC = {
  "Beauty": "Skincare & cosmetics",
  "Books": "Buy & sell textbooks",
  "Clothing": "Thrift & fashion",
  "Electronics": "Student gadgets",
  "Food & Drinks": "Campus food finds",
  "Home & Living": "Dorm essentials",
  "Sports": "Sports gear exchange",
  "Toys": "Games & collectibles",
};

const FOOTER_LINKS = [
  {
    heading: "Get to Know Us",
    links: [
      { label: "About PIYUMART", href: "/about-us" },
    ],
  },
  {
    heading: "Sell with Us",
    links: [
      { label: "Sell your products", href: "/sell" },
    ],
  },
  {
    heading: "Payment & Safety",
    links: [
      { label: "Cash on Meetup", href: "#" },
      { label: "Safe Trade Guidelines", href: "#" },
      { label: "Report a Listing", href: "#" },
    ],
  },
  {
    heading: "Let Us Help You",
    links: [
      { label: "Your Account", href: "/profile" },
      { label: "Your Orders", href: "/my-orders" },
      { label: "Help Center", href: "#" },
    ],
  },
];

export default function Footer() {
  const [lang, setLang] = useState("English");
  const [currency, setCurrency] = useState("PHP - Philippine Peso");
  const [location, setLocation] = useState("Philippines");
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch("/api/categories");
        const data = await res.json();
        setCategories(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch categories:", err);
      }
    }
    fetchCategories();
  }, []);

  return (
    <footer className="w-full mt-0">
      {/* Back to top */}
      <div
        className="w-full text-center py-3 text-xs font-semibold cursor-pointer transition-opacity hover:opacity-80 select-none"
        style={{ backgroundColor: "#232f3e", color: "#e8edf8" }}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        Back to top ↑
      </div>

      {/* Main link columns */}
      <div style={{ backgroundColor: "#37475a" }} className="w-full py-10 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8">
          {FOOTER_LINKS.map((col) => (
            <div key={col.heading}>
              <h3 className="text-white font-bold text-sm mb-3">{col.heading}</h3>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[#c8cdd6] text-xs hover:text-white hover:underline transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div style={{ backgroundColor: "#232f3e" }} className="w-full border-t border-white/10" />

      {/* Logo + locale selectors */}
      <div
        style={{ backgroundColor: "#232f3e" }}
        className="w-full py-6 px-4 flex flex-col items-center gap-4"
      >
        <div className="flex items-center gap-2 select-none">
          <span className="text-lg font-extrabold tracking-tight text-white">PIYU</span>
          <span className="text-lg font-extrabold tracking-tight" style={{ color: "#d4aa40" }}>
            MART
          </span>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {[
            { icon: "🌐", value: lang, setter: setLang, options: ["English", "Filipino"] },
            { icon: "₱", value: currency, setter: setCurrency, options: ["PHP - Philippine Peso", "USD - US Dollar"] },
            { icon: "📍", value: location, setter: setLocation, options: ["Philippines"] },
          ].map(({ icon, value, setter, options }) => (
            <div
              key={icon}
              className="flex items-center gap-1 border border-white/25 rounded px-3 py-1.5 cursor-pointer hover:border-white/60 transition-colors"
            >
              <span className="text-xs text-white/70">{icon}</span>
              <select
                value={value}
                onChange={(e) => setter(e.target.value)}
                className="bg-transparent text-white text-xs font-medium outline-none cursor-pointer appearance-none pr-1"
              >
                {options.map((o) => (
                  <option key={o} value={o} style={{ backgroundColor: "#232f3e" }}>
                    {o}
                  </option>
                ))}
              </select>
              <span className="text-white/50 text-xs">▾</span>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div style={{ backgroundColor: "#131a22" }} className="w-full border-t border-white/10" />

      {/* Categories — fetched from DB with real IDs */}
      <div style={{ backgroundColor: "#131a22" }} className="w-full py-7 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-x-4 gap-y-5">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/products?category=${cat.id}`}
              className="group"
            >
              <p className="text-sm mb-0.5">{CATEGORY_ICONS[cat.name] || "🏷️"}</p>
              <p className="text-xs font-bold text-[#c8cdd6] group-hover:text-white transition-colors leading-tight">
                {cat.name}
              </p>
              <p className="text-[11px] text-[#6b7280] group-hover:text-[#9ca3af] transition-colors leading-tight mt-0.5">
                {CATEGORY_DESC[cat.name] || "Browse products"}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* Bottom copyright */}
      <div
        style={{ backgroundColor: "#131a22" }}
        className="w-full border-t border-white/5 py-5 px-4"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[11px] text-[#6b7280] text-center sm:text-left">
            © {new Date().getFullYear()} PIYUMART. All rights reserved.
          </p>
          <div className="flex gap-4 flex-wrap justify-center">
            {[
              { label: "Privacy Policy", href: "#" },
              { label: "Terms of Service", href: "#" },
            ].map((t) => (
              <Link
                key={t.label}
                href={t.href}
                className="text-[11px] text-[#6b7280] hover:text-white transition-colors"
              >
                {t.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}