"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import NotificationBell from "@/components/NotificationBell";

// ── THEME TOGGLE ──────────────────────────────────────────────────────────────
function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return stored === "dark" || (!stored && prefersDark);
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      className={`relative w-11 h-6 rounded-full border transition-all duration-300 flex items-center px-0.5 shrink-0
        ${dark
          ? "bg-[#c9a96e] border-[#c9a96e]"
          : "bg-[#ede9ff] border-[#6d4aff]/30"
        }`}
    >
      <span
        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-white shadow-sm transition-all duration-300
          ${dark ? "translate-x-5" : "translate-x-0"}`}
      >
        {dark ? "🌙" : "☀️"}
      </span>
    </button>
  );
}

// ── NAVBAR ────────────────────────────────────────────────────────────────────
export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const isActive = (path) =>
    pathname === path || pathname.startsWith(path + "/");

  const linkClass = (path) =>
    `text-xs font-medium tracking-wide transition-colors duration-150
    ${isActive(path)
      ? "text-[#6d4aff] dark:text-[#c9a96e]"
      : "text-[#1a1060]/60 dark:text-[#f0ede8]/50 hover:text-[#6d4aff] dark:hover:text-[#c9a96e]"
    }`;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="sticky top-0 z-50 bg-white dark:bg-[#0a0a0f] border-b border-[#e8e5f0] dark:border-white/[0.07] px-6 py-3.5 flex justify-between items-center transition-colors duration-300">

      {/* Logo */}
      <h1 className="text-base font-extrabold tracking-tight text-[#1a1060] dark:text-[#f0ede8]">
        PIYU<span className="text-[#6d4aff] dark:text-[#c9a96e]">MART</span>
      </h1>

      {/* Nav items */}
      <div className="flex items-center gap-5">
        <Link href="/" className={linkClass("/")}>Home</Link>
        <Link href="/cart" className={linkClass("/cart")}>Cart</Link>
        <Link href="/my-orders" className={linkClass("/my-orders")}>My Orders</Link>

        {session && <NotificationBell />}

        <ThemeToggle />

        {/* Authenticated: avatar + dropdown */}
        {session ? (
          <div className="relative" ref={dropdownRef}>

            {/* Avatar button */}
            <button
              onClick={() => setOpen((prev) => !prev)}
              className="flex items-center gap-2 hover:opacity-80 transition"
            >
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt="avatar"
                  className="w-8 h-8 rounded-full object-cover border-2 border-[#6d4aff] dark:border-[#c9a96e]"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#6d4aff] dark:bg-[#c9a96e] flex items-center justify-center text-xs font-bold text-white dark:text-[#0a0a0f]">
                  {session.user.name?.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-xs text-[#1a1060]/60 dark:text-[#f0ede8]/50">
                {session.user.name}
              </span>
              <svg
                className={`w-3 h-3 text-[#1a1060]/40 dark:text-[#f0ede8]/40 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown */}
            {open && (
              <div className="absolute right-0 mt-2.5 w-52 bg-white dark:bg-[#12121a] rounded-xl border border-[#e8e5f0] dark:border-white/[0.07] shadow-xl overflow-hidden z-50">

                {/* Profile header */}
                <div className="px-4 py-3 border-b border-[#e8e5f0] dark:border-white/[0.07]">
                  <p className="text-sm font-semibold text-[#1a1060] dark:text-[#f0ede8] truncate">
                    {session.user.name}
                  </p>
                  <p className="text-xs text-[#1a1060]/40 dark:text-[#f0ede8]/40 truncate">
                    {session.user.email}
                  </p>
                </div>

                {/* Menu items */}
                <div className="py-1">
                  {[
                    { href: "/profile",     label: "My Profile",    icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
                    { href: "/sell",        label: "Sell a Product", icon: "M12 4v16m8-8H4" },
                    { href: "/my-listings", label: "My Listings",   icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
                  ].map(({ href, label, icon }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-xs text-[#1a1060]/70 dark:text-[#f0ede8]/60 hover:bg-[#f5f3ff] dark:hover:bg-white/[0.04] hover:text-[#6d4aff] dark:hover:text-[#c9a96e] transition-colors"
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                      </svg>
                      {label}
                    </Link>
                  ))}
                </div>

                {/* Logout */}
                <div className="border-t border-[#e8e5f0] dark:border-white/[0.07] py-1">
                  <button
                    onClick={() => { setOpen(false); signOut({ callbackUrl: "/" }); }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-xs text-red-400 hover:bg-[#f5f3ff] dark:hover:bg-white/[0.04] hover:text-red-500 transition-colors"
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>

        ) : (
          /* Guest: login button */
          <Link
            href="/login"
            className="text-xs font-semibold px-4 py-1.5 rounded-full bg-[#6d4aff] dark:bg-[#c9a96e] text-white dark:text-[#0a0a0f] hover:opacity-90 transition"
          >
            Login
          </Link>
        )}
      </div>
    </nav>
  );
}