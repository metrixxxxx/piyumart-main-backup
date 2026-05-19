"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import NotificationBell from "@/components/NotificationBell";
import ConfirmModal from "@/components/ui/ConfirmModal";
import LoadingModal from "@/components/ui/LoadingModal";

function ThemeToggle() {
  const [state, setState] = useState({ dark: false, mounted: false });

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = stored === "dark" || (!stored && prefersDark);
    document.documentElement.classList.toggle("dark", isDark);
    setTimeout(() => setState({ dark: isDark, mounted: true }), 0);
  }, []);

  const toggle = () => {
    const next = !state.dark;
    setState((prev) => ({ ...prev, dark: next }));
    localStorage.setItem("theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  };

  if (!state.mounted) return null;

  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      className={`relative w-11 h-6 rounded-full border transition-all duration-300 flex items-center px-0.5 shrink-0
        ${state.dark ? "bg-[#c9a028] border-[#c9a028]" : "bg-[#e8edf8] border-[#1a2a6c]/30"}`}
    >
      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-white shadow-sm transition-all duration-300
        ${state.dark ? "translate-x-5" : "translate-x-0"}`}>
        {state.dark ? "🌙" : "☀️"}
      </span>
    </button>
  );
}

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const dropdownRef = useRef(null);

  const isActive = (path) => pathname === path || pathname.startsWith(path + "/");

  const linkClass = (path) =>
    `text-xs font-semibold tracking-wide transition-colors duration-150
    ${isActive(path)
      ? "text-[#c9a028] dark:text-[#c9a028]"
      : "text-white/70 hover:text-white"}`;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const requestLogout = () => {
    setOpen(false);
    setMobileOpen(false);
    setLogoutOpen(true);
  };

  const handleLogout = async () => {
    setLogoutOpen(false);
    setLoggingOut(true);
    await signOut({ callbackUrl: "/" });
  };

  return (
    <>
      <nav className="sticky top-0 z-50 bg-[#1a2a6c] dark:bg-[#0a0e1f] border-b border-white/10 px-5 md:px-8 py-4 flex justify-between items-center transition-colors duration-300 shadow-md">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          
          <h1 className="text-lg font-extrabold tracking-tight text-white">
            PIYU<span className="text-[#c9a028]">MART</span>
          </h1>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6">
          <Link href="/" className={linkClass("/")}>Home</Link>
          <Link href="/cart" className={linkClass("/cart")}>Cart</Link>
          <Link href="/my-orders" className={linkClass("/my-orders")}>My Orders</Link>
          {session && <NotificationBell />}
          <ThemeToggle />

          {session ? (
            <div className="relative" ref={dropdownRef}>
              <button onClick={() => setOpen((prev) => !prev)} className="flex items-center gap-2 hover:opacity-80 transition">
                {session.user.image ? (
                  <img src={session.user.image} alt="avatar" className="w-9 h-9 rounded-full object-cover border-2 border-[#c9a028]" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[#c9a028] flex items-center justify-center text-xs font-bold text-[#0e1a3d]">
                    {session.user.name?.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-medium text-white/70">{session.user.name}</span>
                <svg className={`w-3 h-3 text-white/50 transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {open && (
                <div className="absolute right-0 mt-2.5 w-52 bg-white dark:bg-[#0e1520] rounded-xl border border-[#c5cfe8] dark:border-white/[0.07] shadow-xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-[#c5cfe8] dark:border-white/[0.07] bg-[#1a2a6c]">
                    <p className="text-sm font-semibold text-white truncate">{session.user.name}</p>
                    <p className="text-xs text-white/50 truncate">{session.user.email}</p>
                  </div>
                  <div className="py-1">
                    {[
                      { href: "/profile",     label: "My Profile",     icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
                      { href: "/sell",        label: "Sell a Product",  icon: "M12 4v16m8-8H4" },
                      { href: "/my-listings", label: "My Listings",    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
                    ].map(({ href, label, icon }) => (
                      <Link key={href} href={href} onClick={() => setOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-xs text-[#0e1a3d]/70 dark:text-[#e8edf8]/60 hover:bg-[#e8edf8] dark:hover:bg-white/[0.04] hover:text-[#1a2a6c] dark:hover:text-[#c9a028] transition-colors">
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                        </svg>
                        {label}
                      </Link>
                    ))}
                  </div>
                  <div className="border-t border-[#c5cfe8] dark:border-white/[0.07] py-1">
                    <button onClick={requestLogout}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-xs text-red-400 hover:bg-[#e8edf8] dark:hover:bg-white/[0.04] hover:text-red-500 transition-colors">
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
            <Link href="/login" className="text-xs font-semibold px-4 py-2 rounded-full bg-[#c9a028] text-[#0e1a3d] hover:bg-[#d4aa40] transition">
              Login
            </Link>
          )}
        </div>

        {/* Mobile: right side */}
        <div className="flex md:hidden items-center gap-3">
          {session && <NotificationBell />}
          <ThemeToggle />
          <button
            onClick={() => setMobileOpen((p) => !p)}
            aria-expanded={mobileOpen}
            aria-label="Toggle menu"
            className="relative h-8 w-8 rounded-lg text-white transition hover:bg-white/10"
          >
            <svg className="absolute inset-1 h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                className={`origin-center transition-all duration-300 ${mobileOpen ? "translate-y-1.5 rotate-45" : ""}`}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16"
              />
              <path
                className={`transition-all duration-200 ${mobileOpen ? "opacity-0" : "opacity-100"}`}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 12h16"
              />
              <path
                className={`origin-center transition-all duration-300 ${mobileOpen ? "-translate-y-1.5 -rotate-45" : ""}`}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 18h16"
              />
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div
        className={`md:hidden fixed inset-x-0 top-[57px] bottom-0 z-40 bg-[#1a2a6c] dark:bg-[#0a0e1f] flex flex-col px-6 py-6 gap-4 transition-all duration-300 ease-out
          ${mobileOpen ? "translate-y-0 opacity-100 pointer-events-auto" : "-translate-y-3 opacity-0 pointer-events-none"}`}
      >
          {session && (
            <div className={`flex items-center gap-3 pb-4 border-b border-white/10 transition-all duration-300 ${mobileOpen ? "translate-y-0 opacity-100 delay-100" : "-translate-y-2 opacity-0"}`}>
              <div className="w-10 h-10 rounded-full bg-[#c9a028] flex items-center justify-center text-sm font-bold text-[#0e1a3d]">
                {session.user.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{session.user.name}</p>
                <p className="text-xs text-white/50">{session.user.email}</p>
              </div>
            </div>
          )}
          {[
            { href: "/", label: "Home" },
            { href: "/cart", label: "Cart" },
            { href: "/my-orders", label: "My Orders" },
            ...(session ? [
              { href: "/profile", label: "My Profile" },
              { href: "/sell", label: "Sell a Product" },
              { href: "/my-listings", label: "My Listings" },
            ] : []),
          ].map(({ href, label }) => (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)}
              className={`text-sm font-semibold py-2 border-b border-white/10 transition-all duration-300
                ${isActive(href) ? "text-[#c9a028]" : "text-white/80 hover:text-white"}`}>
              {label}
            </Link>
          ))}
          {session ? (
            <button onClick={requestLogout}
              className="mt-2 text-sm font-semibold text-red-400 text-left py-2">
              Logout
            </button>
          ) : (
            <Link href="/login" onClick={() => setMobileOpen(false)}
              className="mt-2 text-center bg-[#c9a028] text-[#0e1a3d] font-bold text-sm py-3 rounded-xl">
              Login
            </Link>
          )}
      </div>

      <ConfirmModal
        open={logoutOpen}
        title="Log out?"
        description="You will need to sign in again to manage orders, listings, and your cart."
        confirmText="Log out"
        cancelText="Stay signed in"
        loading={loggingOut}
        onCancel={() => setLogoutOpen(false)}
        onConfirm={handleLogout}
      />
      <LoadingModal
        open={loggingOut}
        title="Logging out"
        description="Ending your session and returning you to the shop."
      />
    </>
  );
}
