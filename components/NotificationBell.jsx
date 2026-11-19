"use client";
import { useSession } from "next-auth/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useFloatingPanel } from "@/components/layout/FloatingPanelProvider";

export default function NotificationBell({ align = "end" }) {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState([]);
  const { id, isOpen: open, openPanel, closePanel } = useFloatingPanel();
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const unread = notifications.filter((n) => !n.is_read).length;

  useLayoutEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    function positionPanel() {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) return;
      const rect = trigger.getBoundingClientRect();
      const viewportLeft = viewport?.offsetLeft || 0;
      const viewportTop = viewport?.offsetTop || 0;
      const viewportWidth = viewport?.width || window.innerWidth;
      const viewportBottom = viewportTop + (viewport?.height || window.innerHeight);
      const width = Math.min(320, Math.max(0, viewportWidth - 32));
      const preferredLeft = align === "start" ? rect.left : rect.right - width;
      const left = Math.max(viewportLeft + 16, Math.min(preferredLeft, viewportLeft + viewportWidth - width - 16));
      const top = Math.max(viewportTop + 16, Math.min(rect.bottom + 8, viewportBottom - 112));
      Object.assign(panel.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, maxHeight: `${Math.max(0, viewportBottom - top - 16)}px` });
    }
    positionPanel();
    window.addEventListener("resize", positionPanel);
    window.addEventListener("scroll", positionPanel, true);
    viewport?.addEventListener("resize", positionPanel);
    viewport?.addEventListener("scroll", positionPanel);
    return () => {
      window.removeEventListener("resize", positionPanel);
      window.removeEventListener("scroll", positionPanel, true);
      viewport?.removeEventListener("resize", positionPanel);
      viewport?.removeEventListener("scroll", positionPanel);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    function handleOutside(event) {
      if (!panelRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) closePanel();
    }
    function handleEscape(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      closePanel();
      triggerRef.current?.focus({ preventScroll: true });
    }
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleEscape, true);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleEscape, true);
    };
  }, [open, closePanel]);

 useEffect(() => {
  if (!session) return;

  fetch("/api/notifications")
    .then((r) => r.json())
    .then((data) => {
      console.log("notifications loaded:", data); // ✅ check if loading
      setNotifications(Array.isArray(data) ? data : []);
    });

  const channel = supabase
    .channel(`notifications:${session.user.id}`)
    .on("broadcast", { event: "notification:new" }, (payload) => {
      console.log("notification received:", payload); // ✅ check if realtime works
      setNotifications((prev) => [payload.payload, ...prev]);
    })
    .subscribe((status) => {
      console.log("supabase channel status:", status); // ✅ check if subscribed
    });

  return () => supabase.removeChannel(channel);
}, [session?.user?.id]);
  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  async function clearAll() {
    await fetch("/api/notifications", { method: "DELETE" });
    setNotifications([]);
  }

  const iconMap = {
    order: "🛒",
    order_placed: "✅",
    order_status: "📦",
    low_stock: "⚠️",
    message: "💬",
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => { if (open) closePanel(); else { openPanel(); if (unread > 0) markAllRead(); } }}
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[#FABB00] transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FABB00] focus-visible:ring-offset-2 focus-visible:ring-offset-[#131f50] dark:focus-visible:ring-offset-[#0b1230] md:h-9 md:w-9 md:border-transparent md:bg-transparent md:text-gray-300 md:hover:bg-white/10 md:hover:text-white"
      >
        <svg aria-hidden="true" className="h-[22px] w-[22px] md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-[#131f50] bg-red-500 px-0.5 text-[9px] font-bold text-white dark:border-[#0b1230] md:right-1 md:top-1 md:border-0 md:text-[10px]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div ref={panelRef} id={id} role="dialog" aria-label="Notifications" className="fixed z-[70] flex min-h-0 flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-xl">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-700">
            <span className="text-sm font-medium text-white">
              Notifications {unread > 0 && (
                <span className="ml-1 text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">{unread}</span>
              )}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {unread > 0 && (
                <button onClick={markAllRead} className="text-xs text-blue-400 hover:text-blue-300 transition">
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button onClick={clearAll} className="text-xs text-red-400 hover:text-red-300 transition">
                  Clear all
                </button>
              )}
              <button type="button" aria-label="Close notifications" onClick={() => { closePanel(); triggerRef.current?.focus({ preventScroll: true }); }} className="rounded-lg p-1.5 text-gray-300 transition hover:bg-white/10 hover:text-white">
                <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="m6 6 12 12M6 18 18 6" /></svg>
              </button>
            </div>
          </div>
          <div className="min-h-0 max-h-80 overflow-y-auto overscroll-contain">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">No notifications</div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className={`px-4 py-3 border-b border-gray-800 text-sm transition ${!n.is_read ? "bg-gray-800/60" : ""}`}>
                  <div className="flex gap-2">
                    <span className="text-base">{iconMap[n.type] || "🔔"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-gray-200">{n.message}</p>
                      <p className="text-xs text-gray-500 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
