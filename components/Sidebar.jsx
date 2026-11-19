"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  HomeIcon, CartIcon, MessagesIcon, SellIcon, ListingsIcon,
  OrdersIcon, ProfileIcon, LogoutIcon, ThemeToggle,
} from "@/components/ui/navbar";
import NotificationBell from "@/components/NotificationBell";
import SearchAutocomplete from "@/components/SearchAutocomplete";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ActionFeedback from "@/components/ui/ActionFeedback";
import LoginRequiredModal from "@/components/ui/LoginRequiredModal";
import { getSocket } from "@/lib/socket";
import { useFloatingPanels } from "@/components/layout/FloatingPanelProvider";

const desktopQuery = "(min-width: 768px)";
function subscribeToViewport(callback) {
  const query = window.matchMedia(desktopQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
const getDesktopSnapshot = () => window.matchMedia(desktopQuery).matches;
const getServerSnapshot = () => true;

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { closeAllPanels } = useFloatingPanels();
  const [openForPath, setOpenForPath] = useState(null);
  const subscribe = useCallback(callback => subscribeToViewport(() => {
    setOpenForPath(null);
    callback();
  }), []);
  const desktop = useSyncExternalStore(subscribe, getDesktopSnapshot, getServerSnapshot);
  const dialogRef = useRef(null);
  const [cartLoginOpen, setCartLoginOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [unreadMessages, setUnreadMessages] = useState(0);
  const drawerOpen = !desktop && openForPath === pathname;
  const isBao = pathname === "/bao" || pathname.startsWith("/bao/");
  const workspace = isBao;
  const hideSidebar = pathname === "/login" || pathname === "/admin/login" || workspace;
  const seller = session?.user?.role === "seller";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!drawerOpen || !dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, [drawerOpen]);

  // Keep the navbar's unread indicator and socket subscription in the shell.
  useEffect(() => {
    if (!session?.user?.id || hideSidebar) return;
    let current = true;
    fetch("/api/conversations")
      .then(response => response.json())
      .then(data => {
        if (current && Array.isArray(data)) {
          setUnreadMessages(data.reduce((total, conversation) => total + Number(conversation.unread_count || 0), 0));
        }
      })
      .catch(() => {});
    const socket = getSocket(session.user.id);
    const onMessage = () => setUnreadMessages(count => count + 1);
    socket.on("message:received", onMessage);
    return () => { current = false; socket.off("message:received", onMessage); };
  }, [session?.user?.id, pathname, hideSidebar]);

  const links = [
    { href: "/", label: "Home", icon: HomeIcon },
    { href: "/cart", label: "Cart", icon: CartIcon },
    { href: "/my-orders", label: "My Orders", icon: OrdersIcon },
    { href: "/messages", label: "Messages", icon: MessagesIcon },
    { href: "/profile", label: "My Profile", icon: ProfileIcon },
    { href: "/sell", label: seller ? "Sell a Product" : "Become a seller", icon: SellIcon },
    ...(seller ? [
      { href: "/my-listings", label: "My Listings", icon: ListingsIcon },
      { href: "/wallet", label: "My Wallet", icon: ListingsIcon },
    ] : []),
    { href: "/about-us", label: "About us", icon: ProfileIcon },
  ];
  const matches = path => pathname === path || pathname.startsWith(path + "/");
  const hasPageSearch = ["/cart", "/my-orders", "/my-listings", "/wallet", "/sell", "/messages", "/profile"].includes(pathname);
  const isActive = href => {
    if (href === "/") return pathname === href;
    if (href === "/products") return matches(href) || matches("/shop") || matches("/seller");
    if (href === "/cart") return matches(href) || matches("/checkout");
    if (href === "/my-orders") return matches(href) || matches("/payments");
    return matches(href);
  };
  const linkClass = active => `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FABB00] ${active ? "bg-[#FABB00]/15 text-[#FABB00]" : "text-white/75 hover:bg-white/10 hover:text-white"}`;
  const brand = <Link href="/" className="text-lg font-extrabold tracking-wide text-white">PIYU<span className="text-[#FABB00]">MART</span></Link>;
  const closeDrawer = () => { closeAllPanels(); setOpenForPath(null); };
  const loginHref = "/login";

  async function handleLogout() {
    setLogoutOpen(false);
    setLoggingOut(true);
    try { await signOut({ callbackUrl: "/" }); }
    catch { setLoggingOut(false); setLogoutError("Unable to log out. Check your connection and try again."); }
  }

  if (hideSidebar) return null;

  const content = <div className="flex h-full flex-col border-r border-[#FABB00]/20 bg-[#131f50] text-white dark:bg-[#0b1230]">
    <div className="flex shrink-0 items-center justify-between px-5 py-6">
      {brand}
      <button type="button" onClick={closeDrawer} aria-label="Close navigation" className="rounded-lg p-2 text-white/75 hover:bg-white/10 md:hidden">
        <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="m6 6 12 12M6 18 18 6" /></svg>
      </button>
    </div>
    <div className="relative z-50 flex shrink-0 items-center justify-between px-4 pb-4">
      <div>{session && !workspace && <NotificationBell align="start" />}</div>
      <ThemeToggle />
    </div>
    {!workspace && !hasPageSearch && !matches("/sell") && !matches("/my-listings") && <div className="relative z-40 shrink-0 px-4 pb-4"><SearchAutocomplete /></div>}
    <nav aria-label="Main navigation" className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 pb-4">
      {links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined} className={linkClass(isActive(href))}
        onClick={event => {
          closeDrawer();
          if (href === "/cart" && !session) { event.preventDefault(); setCartLoginOpen(true); }
        }}>
        <Icon className="h-5 w-5 shrink-0" />
        {label}
        {href === "/messages" && unreadMessages > 0 && <span className="ml-auto rounded-full bg-red-500 px-1.5 text-[10px] text-white">{unreadMessages > 9 ? "9+" : unreadMessages}</span>}
      </Link>)}
    </nav>
    {!workspace && <div className="shrink-0 border-t border-white/10 p-3">
      {session ? <>
        <p className="truncate px-3 pb-2 text-xs text-white/60">{session.user.name}</p>
        <button type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-red-300 hover:bg-white/10" onClick={() => { closeDrawer(); setLogoutOpen(true); }}><LogoutIcon className="h-5 w-5" />Logout</button>
      </> : <>
        <Link href={loginHref} onClick={closeDrawer} aria-current={pathname === loginHref ? "page" : undefined} className={linkClass(pathname === loginHref)}><ProfileIcon className="h-5 w-5" />Login</Link>
      </>}
    </div>}
  </div>;

  return <>
    <header className="flex h-16 shrink-0 items-center justify-between bg-[#131f50] px-4 dark:bg-[#0b1230] md:hidden">
      {brand}
      <button type="button" aria-label="Open navigation" aria-haspopup="dialog" aria-controls="sidebar-drawer" aria-expanded={drawerOpen} onClick={() => { closeAllPanels(); setOpenForPath(pathname); }} className="rounded-lg p-2 text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[#FABB00]">
        <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>
    </header>
    {desktop ? <aside aria-label="Sidebar" className="relative z-50 hidden h-dvh w-64 shrink-0 flex-col md:flex">{content}</aside> :
      <dialog ref={dialogRef} id="sidebar-drawer" aria-label="Navigation" onClose={() => { if (drawerOpen) closeDrawer(); }} onCancel={event => { event.preventDefault(); closeDrawer(); }}
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-64 max-w-[calc(100vw-2rem)] overflow-visible border-0 bg-transparent p-0 text-white outline-none backdrop:bg-[#070f27]/60 backdrop:backdrop-blur-sm"
        onClick={event => {
          if (event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDrawer();
        }}>{content}</dialog>}
    <LoginRequiredModal open={cartLoginOpen} onClose={() => setCartLoginOpen(false)} description="You need to be logged in to view your cart." />
    <ConfirmModal open={logoutOpen} title="Log out?" description="You will need to sign in again." confirmText="Log out" cancelText="Cancel" loading={loggingOut} onCancel={() => setLogoutOpen(false)} onConfirm={handleLogout} />
    <ActionFeedback pending={loggingOut} error={logoutError} showLoading={false} errorTitle="Unable to log out" />
  </>;
}
