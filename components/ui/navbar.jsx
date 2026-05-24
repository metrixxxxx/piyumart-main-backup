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

function ThemeToggle() {
  const [state, setState] = useState({
    dark: false,
    mounted: false,
  });

  useEffect(() => {
    const stored = localStorage.getItem("theme");

    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;

    const isDark =
      stored === "dark" || (!stored && prefersDark);

    document.documentElement.classList.toggle(
      "dark",
      isDark
    );

    setTimeout(() => {
      setState({
        dark: isDark,
        mounted: true,
      });
    }, 0);
  }, []);

  const toggle = () => {
    const next = !state.dark;

    setState((prev) => ({
      ...prev,
      dark: next,
    }));

    localStorage.setItem(
      "theme",
      next ? "dark" : "light"
    );

    document.documentElement.classList.toggle(
      "dark",
      next
    );
  };

  if (!state.mounted) return null;

  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      className={`relative w-11 h-6 rounded-full border transition-all duration-300 flex items-center px-0.5 shrink-0
      ${
        state.dark
          ? "bg-[#c9a028] border-[#c9a028]"
          : "bg-[#e8edf8] border-[#1a2a6c]/30"
      }`}
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

export default function Navbar() {
  const { data: session } = useSession();

  const pathname = usePathname();

  const [open, setOpen] = useState(false);

  const [mobileOpen, setMobileOpen] =
    useState(false);

  const [logoutOpen, setLogoutOpen] =
    useState(false);

  const [loggingOut, setLoggingOut] =
    useState(false);

  const [unreadMessages, setUnreadMessages] =
    useState(0);

  const [searchOpen, setSearchOpen] =
    useState(false);

  const dropdownRef = useRef(null);

  const searchRef = useRef(null);

  const searchButtonRef = useRef(null);

  const isActive = (path) =>
    pathname === path ||
    pathname.startsWith(path + "/");

  const linkClass = (path) =>
    `text-xs font-semibold tracking-wide transition-colors duration-150
    ${
      isActive(path)
        ? "text-[#c9a028]"
        : "text-white/70 hover:text-white"
    }`;

  // unread messages
  useEffect(() => {
    if (!session) return;

    fetch("/api/conversations")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const total = data.reduce(
            (s, c) =>
              s + Number(c.unread_count || 0),
            0
          );

          setUnreadMessages(total);
        }
      })
      .catch(() => {});

    const socket = getSocket(session.user.id);

    socket.on("message:received", () => {
      if (!pathname.startsWith("/messages")) {
        setUnreadMessages((prev) => prev + 1);
      }
    });

    return () =>
      socket.off("message:received");
  }, [session, pathname]);

  // reset unread
  useEffect(() => {
    if (pathname.startsWith("/messages")) {
      setUnreadMessages(0);
    }
  }, [pathname]);

  // close profile dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  // close search dropdown
  useEffect(() => {
    const handleOutsideSearch = (e) => {
      if (
        searchOpen &&
        searchRef.current &&
        !searchRef.current.contains(e.target) &&
        searchButtonRef.current &&
        !searchButtonRef.current.contains(e.target)
      ) {
        setSearchOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideSearch
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideSearch
      );
    };
  }, [searchOpen]);

  const requestLogout = () => {
    setOpen(false);

    setMobileOpen(false);

    setLogoutOpen(true);
  };

  const handleLogout = async () => {
    setLogoutOpen(false);

    setLoggingOut(true);

    await signOut({
      callbackUrl: "/",
    });
  };

  return (
    <>
      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 bg-[#1a2a6c] dark:bg-[#0a0e1f] border-b border-white/10 px-6 md:px-8 py-4 flex items-center gap-4 shadow-md">

        {/* LOGO */}
        <Link
          href="/"
          className="flex items-center gap-2.5 shrink-0"
        >
          <h1 className="text-lg font-extrabold tracking-tight text-white">
            PIYU
            <span className="text-[#c9a028]">
              MART
            </span>
          </h1>
        </Link>

        {/* DESKTOP SEARCH */}
        {pathname !== "/" && (
          <div className="hidden md:flex flex-1 max-w-[1200px] ml-4 opacity-96 hover:opacity-100 transition animation-fade-in">
            <SearchAutocomplete />
          </div>
        )}

        {/* DESKTOP NAV */}
        <div className="hidden md:flex items-center gap-6 ml-auto">

          <Link
            href="/"
            className={linkClass("/")}
          >
            Home
          </Link>

          <Link
            href="/cart"
            className={linkClass("/cart")}
          >
            Cart
          </Link>

          {session && (
            <Link
              href="/messages"
              className={`relative ${linkClass(
                "/messages"
              )}`}
            >
              Messages

              {unreadMessages > 0 && (
                <span className="absolute -top-2 -right-3 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadMessages > 9
                    ? "9+"
                    : unreadMessages}
                </span>
              )}
            </Link>
          )}

          {session && <NotificationBell />}

          <ThemeToggle />

          {/* PROFILE */}
          {session ? (
            <div
              className="relative"
              ref={dropdownRef}
            >
              <button
                onClick={() =>
                  setOpen((p) => !p)
                }
                className="flex items-center gap-2 hover:opacity-80 transition"
              >
                {session.user.image ? (
                  <img
                    src={session.user.image}
                    alt="avatar"
                    className="w-9 h-9 rounded-full object-cover border-2 border-[#c9a028]"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[#c9a028] flex items-center justify-center text-xs font-bold text-[#0e1a3d]">
                    {session.user.name
                      ?.charAt(0)
                      .toUpperCase()}
                  </div>
                )}

                <span className="text-xs font-medium text-white/70">
                  {session.user.name}
                </span>

                <svg
                  className={`w-3 h-3 text-white/50 transition-transform duration-200 ${
                    open ? "rotate-180" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {open && (
                <div className="absolute right-0 mt-2.5 w-56 bg-white dark:bg-[#0e1520] rounded-xl border border-[#c5cfe8] dark:border-white/[0.07] shadow-2xl overflow-hidden z-50">

                  {/* HEADER */}
                  <div className="px-4 py-3 border-b border-[#c5cfe8] dark:border-white/[0.07] bg-[#1a2a6c]">
                    <p className="text-sm font-semibold text-white truncate">
                      {session.user.name}
                    </p>

                    <p className="text-xs text-white/60 truncate">
                      {session.user.email}
                    </p>
                  </div>

                  {/* LINKS */}
                  <div className="py-1">

                    {[
                      {
                        href: "/profile",
                        label: "My Profile",
                      },
                      {
                        href: "/sell",
                        label: "Sell a Product",
                      },
                      {
                        href: "/my-listings",
                        label: "My Listings",
                      },
                      {
                        href: "/my-orders",
                        label: "My Orders",
                      },
                      {
                        href: "/messages",
                        label: "Messages",
                      },
                    ].map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() =>
                          setOpen(false)
                        }
                        className="flex items-center px-4 py-3 text-xs text-[#0e1a3d]/70 dark:text-[#e8edf8]/60 hover:bg-[#e8edf8] dark:hover:bg-white/[0.04] hover:text-[#1a2a6c] dark:hover:text-[#c9a028] transition-colors"
                      >
                        {item.label}

                        {item.href ===
                          "/messages" &&
                          unreadMessages >
                            0 && (
                            <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                              {unreadMessages >
                              9
                                ? "9+"
                                : unreadMessages}
                            </span>
                          )}
                      </Link>
                    ))}
                  </div>

                  {/* LOGOUT */}
                  <div className="border-t border-[#c5cfe8] dark:border-white/[0.07] py-1">
                    <button
                      onClick={requestLogout}
                      className="w-full text-left px-4 py-3 text-xs text-red-400 hover:bg-[#e8edf8] dark:hover:bg-white/[0.04] hover:text-red-500 transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="text-xs font-semibold px-4 py-2 rounded-full bg-[#c9a028] text-[#0e1a3d]"
            >
              Login
            </Link>
          )}
        </div>

       {/* MOBILE CONTROLS */}
<div className="flex md:hidden items-center gap-3 ml-auto">

{/* MOBILE SEARCH OVERLAY — direct child of nav */}
{pathname !== "/" && searchOpen && (
  <div
    ref={searchRef}
    className="md:hidden absolute inset-0 z-20 flex items-center px-4 bg-[#1a2a6c] dark:bg-[#0a0e1f] animated fade-in-down"
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

  {/* SEARCH ICON */}
  {pathname !== "/" && (
    <button
      ref={searchButtonRef}
      className="text-white/70 hover:text-white transition"
      onClick={() => setSearchOpen((p) => !p)}
      aria-label="Search"
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </button>
  )}

  {/* NOTIFICATIONS */}
  {session && <NotificationBell />}

  {/* THEME */}
  <ThemeToggle />

          {/* MENU */}
          <button
            onClick={() =>
              setMobileOpen((p) => !p)
            }
            className="relative h-8 w-8 rounded-lg text-white transition hover:bg-white/10"
          >
            <svg
              className="absolute inset-1 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                className={`origin-center transition-all duration-300 ${
                  mobileOpen
                    ? "translate-y-1.5 rotate-45"
                    : ""
                }`}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16"
              />

              <path
                className={`transition-all duration-200 ${
                  mobileOpen
                    ? "opacity-0"
                    : "opacity-100"
                }`}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 12h16"
              />

              <path
                className={`origin-center transition-all duration-300 ${
                  mobileOpen
                    ? "-translate-y-1.5 -rotate-45"
                    : ""
                }`}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 18h16"
              />
            </svg>
          </button>
        </div>
      </nav>

      {/* MOBILE MENU */}
      <div
        className={`md:hidden fixed inset-x-0 top-[57px] bottom-0 z-40 bg-[#1a2a6c] dark:bg-[#0a0e1f] flex flex-col px-6 py-7 gap-6 transition-all duration-300
        ${
          mobileOpen
            ? "translate-y-0 opacity-100"
            : "-translate-y-3 opacity-0 pointer-events-none"
        }`}
      >
        {[
          {
            href: "/",
            label: "Home",
          },
          {
            href: "/cart",
            label: "Cart",
          },
        ]
          .concat(
            session
              ? [
                  {
                    href: "/messages",
                    label: "Messages",
                  },
                  {
                    href: "/profile",
                    label: "Profile",
                  },
                  {
                    href: "/sell",
                    label: "Sell",
                  },
                  {
                    href: "/my-listings",
                    label: "Listings",
                  },
                  {
                    href: "/my-orders",
                    label: "Orders",
                  },
                ]
              : []
          )
          .map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() =>
                setMobileOpen(false)
              }
              className="text-white/80 border-b border-white/10 py-3.5 text-sm"
            >
              {item.label}
            </Link>
          ))}

        {session ? (
          <button
            onClick={requestLogout}
            className="text-red-400 text-sm mt-2 text-left"
          >
            Logout
          </button>
        ) : (
          <Link
            href="/login"
            onClick={() =>
              setMobileOpen(false)
            }
            className="bg-[#c9a028] text-[#0e1a3d] text-sm font-bold py-3 rounded-xl text-center"
          >
            Login
          </Link>
        )}
      </div>

      {/* MODALS */}
      <ConfirmModal
        open={logoutOpen}
        title="Log out?"
        description="You will need to sign in again."
        confirmText="Log out"
        cancelText="Cancel"
        loading={loggingOut}
        onCancel={() =>
          setLogoutOpen(false)
        }
        onConfirm={handleLogout}
      />

      <LoadingModal
        open={loggingOut}
        title="Logging out"
        description="Ending session..."
      />
    </>
  );
}