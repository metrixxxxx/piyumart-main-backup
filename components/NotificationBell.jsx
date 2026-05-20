"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function NotificationBell() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);

  const unread = notifications.filter((n) => !n.is_read).length;

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
        onClick={() => { setOpen(!open); if (!open && unread > 0) markAllRead(); }}
        className="relative p-2 text-gray-300 hover:text-white transition"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <span className="text-sm font-medium text-white">
              Notifications {unread > 0 && (
                <span className="ml-1 text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">{unread}</span>
              )}
            </span>
            <div className="flex items-center gap-3">
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
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">No notifications</div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className={`px-4 py-3 border-b border-gray-800 text-sm transition ${!n.is_read ? "bg-gray-800/60" : ""}`}>
                  <div className="flex gap-2">
                    <span className="text-base">{iconMap[n.type] || "🔔"}</span>
                    <div>
                      <p className="text-gray-200">{n.message}</p>
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