"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";

import NotificationBell from "@/components/NotificationBell";
import ConfirmModal from "@/components/ui/ConfirmModal";
import LoadingModal from "@/components/ui/LoadingModal";
import SearchAutocomplete from "@/components/SearchAutocomplete";

import { getSocket } from "@/lib/socket";

// ─── Icons ────────────────────────────────────────────────────────────────────

function HomeIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 9.75L12 3l9 6.75V21a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75v-4.5h-4.5V21a.75.75 0 01-.75.75H3.75A.75.75 0 013 21V9.75z" />
    </svg>
  );
}

function CartIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c.51 0 .962-.343 1.087-.835l1.564-5.873A1.125 1.125 0 0017.5 7.5H5.884M7.5 14.25L5.106 5.272M15 19.5a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm-7.5 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
    </svg>
  );
}

function MessagesIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    </svg>
  );
}

function SellIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function ListingsIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  );
}

function OrdersIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

function ProfileIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

function LogoutIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
    </svg>
  );
}

// ─── ThemeToggle ──────────────────────────────────────────────────────────────

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
        ${state.dark ? "bg-[#c9a028] border-[#c9a028]" : "bg-white/20 border-white/20"}`}
    >
      <span
        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-white shadow-sm transition-all duration-300
          ${state.dark ? "translate-x-5" : "translate-x-0"}`}
      >
        {state.dark ? "🌙" : "☀️"}
      </span>
    </button>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // true when the hero sentinel has scrolled out of view (home page only)
  const [heroPassed, setHeroPassed] = useState(false);

  const dropdownRef = useRef(null);
  const searchRef = useRef(null);
  const searchButtonRef = useRef(null);

  const isHome = pathname === "/";
  const hideSearchPages = ["/sell", "/my-listings", ];
const isSearchHiddenPage = hideSearchPages.some((path) =>
  pathname.startsWith(path)
);

  // Show search in nav when: not home page, OR home page + hero has scrolled past
  const showSearch = !isSearchHiddenPage && (!isHome || heroPassed);

  const isActive = (path) => pathname === path || pathname.startsWith(path + "/");

  const linkClass = (path) =>
    `flex items-center gap-1.5 text-xs font-semibold tracking-wide transition-colors duration-150
    ${isActive(path) ? "text-[#c9a028]" : "text-white/60 hover:text-white"}`;

  // ── Observe hero sentinel ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isHome) return;

    // Reset when navigating back to home
    setHeroPassed(false);

    const tryObserve = () => {
      const sentinel = document.getElementById("hero-sentinel");
      if (!sentinel) {
        // Fallback: scroll position if sentinel not found yet
        const onScroll = () => setHeroPassed(window.scrollY > 320);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
      }

      const observer = new IntersectionObserver(
        ([entry]) => setHeroPassed(!entry.isIntersecting),
        { threshold: 0 }
      );
      observer.observe(sentinel);
      return () => observer.disconnect();
    };

    // Small delay to ensure hero has mounted and sentinel exists in DOM
    const timer = setTimeout(() => {
      const cleanup = tryObserve();
      return cleanup;
    }, 100);

    return () => clearTimeout(timer);
  }, [isHome, pathname]);

  // ── Unread messages ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;

    fetch("/api/conversations")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const total = data.reduce((s, c) => s + Number(c.unread_count || 0), 0);
          setUnreadMessages(total);
        }
      })
      .catch(() => {});

    const socket = getSocket(session.user.id);
    socket.on("message:received", () => setUnreadMessages((prev) => prev + 1));
    return () => socket.off("message:received");
  }, [session, pathname]);

  // ── Close dropdown on outside click ─────────────────────────────────────────
  useEffect(() => {
    const handle = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // ── Close search on outside click ───────────────────────────────────────────
  useEffect(() => {
    const handle = (e) => {
      if (
        searchOpen &&
        searchRef.current &&
        !searchRef.current.contains(e.target) &&
        searchButtonRef.current &&
        !searchButtonRef.current.contains(e.target)
      ) setSearchOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [searchOpen]);

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

  const desktopNavItems = [
    { href: "/", label: "Home", icon: HomeIcon },
    { href: "/cart", label: "Cart", icon: CartIcon },
  ];

  const dropdownItems = [
    { href: "/profile", label: "My Profile", icon: ProfileIcon },
    { href: "/sell", label: "Sell a Product", icon: SellIcon },
    { href: "/my-listings", label: "My Listings", icon: ListingsIcon },
    { href: "/my-orders", label: "My Orders", icon: OrdersIcon },
    { href: "/messages", label: "Messages", icon: MessagesIcon },
  ];

  const mobileItems = [
    { href: "/", label: "Home", icon: HomeIcon },
    { href: "/cart", label: "Cart", icon: CartIcon },
    ...(session
      ? [
          { href: "/messages", label: "Messages", icon: MessagesIcon },
          { href: "/profile", label: "Profile", icon: ProfileIcon },
          { href: "/sell", label: "Sell", icon: SellIcon },
          { href: "/my-listings", label: "Listings", icon: ListingsIcon },
          { href: "/my-orders", label: "Orders", icon: OrdersIcon },
        ]
      : []),
  ];

  return (
    <>
      <style>{`
        nav.piyu-nav {
          position: sticky;
          top: 0;
        }
        nav.piyu-nav::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(201,160,40,0.35) 20%,
            rgba(201,160,40,0.8) 50%,
            rgba(201,160,40,0.35) 80%,
            transparent 100%
          );
        }
      `}</style>

      {/* ── NAVBAR — sticky so it stays at top on scroll ── */}
      <nav className="piyu-nav sticky top-0 z-50 bg-[#131f50] dark:bg-[#0b1230] px-8 md:px-12 py-5 flex items-center gap-6 shadow-[0_2px_24px_rgba(0,0,0,0.4)] backdrop-blur-md">

        {/* LOGO */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <h1 className="text-lg font-extrabold tracking-tight text-white">
            PIYU<span className="text-[#c9a028]">MART</span>
          </h1>
        </Link>

        {/* SEARCH — slides in smoothly after hero scrolls away on home,
            always visible on all other pages */}
        <div
          className={`hidden md:flex flex-1 max-w-2x1 ml-6 transition-all duration-500 ease-in-out
            ${showSearch
              ? "opacity-100 translate-y-0 pointer-events-auto"
              : "opacity-0 -translate-y-2 pointer-events-none"}`}
        >
          <SearchAutocomplete />
        </div>

        {/* DESKTOP NAV */}
        <div className="hidden md:flex items-center gap-8 ml-auto">

          {desktopNavItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={linkClass(href)}>
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}

          {session && (
            <Link href="/messages" className={`relative ${linkClass("/messages")}`}>
              <MessagesIcon className="w-4 h-4" />
              Messages
              {unreadMessages > 0 && (
                <span className="absolute -top-2 -right-3 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadMessages > 9 ? "9+" : unreadMessages}
                </span>
              )}
            </Link>
          )}

          {session && <NotificationBell />}

          <ThemeToggle />

          {/* PROFILE DROPDOWN */}
          {session ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setOpen((p) => !p)}
                className="flex items-center gap-2.5 hover:opacity-80 transition"
              >
                {session.user.image ? (
                  <img
                    src={session.user.image}
                    alt="avatar"
                    className="w-9 h-9 rounded-full object-cover border-2 border-[#c9a028]"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[#c9a028] flex items-center justify-center text-xs font-bold text-[#0e1a3d]">
                    {session.user.name?.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-medium text-white/70">{session.user.name}</span>
                <svg
                  className={`w-3 h-3 text-white/40 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {open && (
                <div className="absolute right-0 mt-2.5 w-56 bg-white dark:bg-[#08091c] rounded-xl border border-[#c5cfe8] dark:border-[#c9a028]/20 shadow-2xl dark:shadow-[0_8px_32px_rgba(0,0,0,0.7)] overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-[#c5cfe8] dark:border-white/[0.07] bg-[#131f50] dark:bg-[#0b1230]">
                    <p className="text-sm font-semibold text-white truncate">{session.user.name}</p>
                    <p className="text-xs text-white/60 truncate">{session.user.email}</p>
                  </div>
                  <div className="py-1">
                    {dropdownItems.map(({ href, label, icon: Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-xs text-[#0e1a3d]/70 dark:text-[#e8edf8]/60 hover:bg-[#e8edf8] dark:hover:bg-white/[0.04] hover:text-[#1a2a6c] dark:hover:text-[#c9a028] transition-colors"
                      >
                        <Icon className="w-4 h-4 shrink-0 opacity-60" />
                        {label}
                        {href === "/messages" && unreadMessages > 0 && (
                          <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                            {unreadMessages > 9 ? "9+" : unreadMessages}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                  <div className="border-t border-[#c5cfe8] dark:border-white/[0.07] py-1">
                    <button
                      onClick={requestLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 text-xs text-red-400 hover:bg-[#e8edf8] dark:hover:bg-white/[0.04] hover:text-red-500 transition-colors"
                    >
                      <LogoutIcon className="w-4 h-4 shrink-0" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="text-xs font-semibold px-5 py-2 rounded-full bg-[#c9a028] text-[#0e1a3d] hover:bg-[#dbb030] transition-colors"
            >
              Login
            </Link>
          )}
        </div>

        {/* ── MOBILE CONTROLS ── */}
        <div className="flex md:hidden items-center gap-3 ml-auto">

          {/* Mobile search overlay — shown after hero passes OR on non-home pages */}
          {showSearch && searchOpen && (
            <div
              ref={searchRef}
              className="absolute inset-0 z-20 flex items-center px-4 bg-[#131f50] dark:bg-[#0b1230]"
            >
              <SearchAutocomplete autoFocus />
              <button
                onClick={() => setSearchOpen(false)}
                className="ml-3 text-white/70 hover:text-white transition shrink-0"
                aria-label="Close search"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Mobile search icon — only when search is applicable */}
          {showSearch && (
            <button
              ref={searchButtonRef}
              className="text-white/70 hover:text-white transition"
              onClick={() => setSearchOpen((p) => !p)}
              aria-label="Search"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          )}

          {session && <NotificationBell />}
          <ThemeToggle />

          <button
            onClick={() => setMobileOpen((p) => !p)}
            aria-label="Open menu"
            className="relative shrink-0"
          >
            {session ? (
              <>
                {session.user.image ? (
                  <img
                    src={session.user.image}
                    alt="avatar"
                    className={`w-9 h-9 rounded-full object-cover border-2 transition-all duration-200
                      ${mobileOpen ? "border-white" : "border-[#c9a028]"}`}
                  />
                ) : (
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200
                      ${mobileOpen ? "bg-white text-[#1a2a6c]" : "bg-[#c9a028] text-[#0e1a3d]"}`}
                  >
                    {session.user.name?.charAt(0).toUpperCase()}
                  </div>
                )}
                {unreadMessages > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 border-2 border-[#131f50]" />
                )}
              </>
            ) : (
              <div className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
                <ProfileIcon className="w-5 h-5 text-white/80" />
              </div>
            )}
          </button>
        </div>
      </nav>

      {/* ── MOBILE MENU ── */}
      <div
        className={`md:hidden fixed inset-x-0 top-[65px] bottom-0 z-40
          bg-[#131f50] dark:bg-[#0b1230]
          border-t border-[#c9a028]/20
          flex flex-col px-6 py-7 gap-1 overflow-y-auto overscroll-contain
          transition-all duration-300
          ${mobileOpen ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0 pointer-events-none"}`}
      >
        {session && (
          <div className="flex items-center gap-3 pb-5 border-b border-white/10 mb-2">
            {session.user.image ? (
              <img src={session.user.image} alt="avatar"
                className="w-11 h-11 rounded-full object-cover border-2 border-[#c9a028]" />
            ) : (
              <div className="w-11 h-11 rounded-full bg-[#c9a028] flex items-center justify-center text-sm font-bold text-[#0e1a3d]">
                {session.user.name?.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{session.user.name}</p>
              <p className="text-xs text-white/50 truncate">{session.user.email}</p>
            </div>
          </div>
        )}

        {mobileItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 border-b border-white/10 py-4 text-sm transition-colors
              ${isActive(href) ? "text-[#c9a028]" : "text-white/80 hover:text-white"}`}
          >
            <Icon className="w-5 h-5 shrink-0 opacity-70" />
            {label}
            {href === "/messages" && unreadMessages > 0 && (
              <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadMessages > 9 ? "9+" : unreadMessages}
              </span>
            )}
          </Link>
        ))}

        {session ? (
          <button
            onClick={requestLogout}
            className="flex items-center gap-3 text-red-400 text-sm mt-3 hover:text-red-300 transition-colors"
          >
            <LogoutIcon className="w-5 h-5 shrink-0" />
            Logout
          </button>
        ) : (
          <Link
            href="/login"
            onClick={() => setMobileOpen(false)}
            className="flex items-center justify-center gap-2 bg-[#c9a028] text-[#0e1a3d] text-sm font-bold py-3 rounded-xl mt-4"
          >
            <ProfileIcon className="w-5 h-5" />
            Login
          </Link>
        )}
      </div>

      {/* ── MODALS ── */}
      <ConfirmModal
        open={logoutOpen}
        title="Log out?"
        description="You will need to sign in again."
        confirmText="Log out"
        cancelText="Cancel"
        loading={loggingOut}
        onCancel={() => setLogoutOpen(false)}
        onConfirm={handleLogout}
      />

      <LoadingModal open={loggingOut} title="Logging out" description="Ending session..." />
    </>
  );
}