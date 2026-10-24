"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase"; // ✅ import supabase, tanggalin getSocket

export default function MessagesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status !== "authenticated") return;

    fetch("/api/conversations")
      .then((r) => r.json())
      .then((data) => setConversations(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));

   const channel = supabase
  .channel(`inbox:${session.user.id}`)
  .on(
    "broadcast",
    { event: "message:new" },
    (payload) => {
      const newMsg = payload.payload.message;
      if (String(newMsg.sender_id) !== String(session.user.id)) {
        setConversations((prev) =>
          prev.map((c) =>
            Number(c.id) === Number(newMsg.conversation_id)
              ? {
                  ...c,
                  unread_count: Number(c.unread_count) + 1,
                  last_message: newMsg.content,
                  last_message_at: newMsg.created_at,
                  last_sender_id: newMsg.sender_id,
                }
              : c
          )
        );
      }
    }
  )
  .subscribe();

    return () => supabase.removeChannel(channel); // ✅ nasa loob ng useEffect
  }, [status, session?.user?.id]); // ✅ closing ng useEffect

  function formatTime(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return date.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
    return date.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
  }

  if (loading) return (
    <div className="min-h-screen bg-[#f0eeff] dark:bg-[#070b14] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-[3px] border-[#c5cfe8] dark:border-white/10 border-t-[#1a2a6c] dark:border-t-[#c9a028] rounded-full mx-auto mb-4 animate-spin" />
        <p className="text-sm text-[#0e1a3d]/50 dark:text-[#e8edf8]/40">Loading messages...</p>
      </div>
    </div>
  );

  const totalUnread = conversations.reduce((s, c) => s + Number(c.unread_count || 0), 0);
  const filteredConversations = conversations.filter((convo) =>
    `${convo.other_user_name || ""} ${convo.product_name || ""} ${convo.last_message || ""}`
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  return (
    <main className="min-h-screen bg-[#f0eeff] dark:bg-[#070b14] transition-colors duration-300">
      <section className="bg-[#1a2a6c] dark:bg-[#0a0e1f]">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#d8b94e]">Your inbox</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Messages</h1>
              <p className="mt-1 text-sm text-white/65">
                {totalUnread > 0 ? `${totalUnread} unread message${totalUnread !== 1 ? "s" : ""}` : "You’re all caught up"}
              </p>
            </div>
            <span className="text-xs text-white/55">{conversations.length} conversation{conversations.length === 1 ? "" : "s"}</span>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
        {conversations.length === 0 ? (
          <div className="text-center py-16 sm:py-20 bg-white dark:bg-[#0e1520] border border-[#dce4df] dark:border-white/[0.07] rounded-md">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#edf2ee] dark:bg-white/6 flex items-center justify-center text-[#1a6c2a] dark:text-[#d8b94e]">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-[#0e1a3d] dark:text-[#e8edf8] mb-2">No messages yet</h2>
            <p className="text-sm text-[#0e1a3d]/55 dark:text-[#e8edf8]/45 mb-6">
              Start a conversation by clicking CHAT on a product page
            </p>
            <button onClick={() => router.push("/products")}
              className="bg-[#1a2a6c] text-white px-5 py-2.5 rounded-md text-sm font-semibold hover:bg-[#142060] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c9a028]">
              Browse Products
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-[#dce4df] bg-white dark:border-white/[0.07] dark:bg-[#0e1520]">
            <div className="flex items-center gap-3 border-b border-[#e8eee9] px-4 py-3.5 dark:border-white/[0.07] sm:px-5">
              <svg className="w-4 h-4 shrink-0 text-[#657568] dark:text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" strokeWidth="1.8" />
                <path strokeLinecap="round" strokeWidth="1.8" d="m16 16 4 4" />
              </svg>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search conversations"
                placeholder="Search people, products, or messages"
                className="w-full bg-transparent text-sm text-[#0e1a3d] outline-none placeholder:text-[#657568]/70 dark:text-[#e8edf8] dark:placeholder:text-white/35"
              />
              {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="text-xs font-semibold text-[#1a6c2a] hover:underline dark:text-[#d8b94e]">Clear</button>}
            </div>
            {filteredConversations.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-[#657568] dark:text-white/45">No conversations match “{search}”.</p>
            ) : (
              <div className="divide-y divide-[#edf1ee] dark:divide-white/5">
            {filteredConversations.map((convo) => {
              const unread = Number(convo.unread_count || 0);
              const initials = (convo.other_user_name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
              return (
                <button
                  key={convo.id}
                  type="button"
                  onClick={() => router.push(`/messages/${convo.id}`)}
                  className={`flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-[#f6f8f6] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1a6c2a] dark:hover:bg-white/3 sm:gap-4 sm:px-5
                    ${unread > 0 ? "bg-[#f3f7f3] dark:bg-[#1a6c2a]/10" : ""}`}
                >
                  <div className="w-11 h-11 rounded-full bg-[#1a6c2a] dark:bg-[#c9a028] flex items-center justify-center text-white dark:text-[#070b14] font-bold text-sm shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className={`text-sm truncate ${unread > 0 ? "font-bold text-[#0e1a3d] dark:text-[#e8edf8]" : "font-semibold text-[#0e1a3d]/80 dark:text-[#e8edf8]/70"}`}>
                        {convo.other_user_name || "Unknown"}
                      </p>
                      <span className="text-[11px] text-[#657568] dark:text-[#e8edf8]/40 shrink-0 ml-2">
                        {formatTime(convo.last_message_at)}
                      </span>
                    </div>
                    {convo.product_name && (
                      <p className="text-[11px] text-[#1a6c2a] dark:text-[#d8b94e] font-semibold truncate mb-1">
                        {convo.product_name}
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs truncate ${unread > 0 ? "text-[#0e1a3d]/75 dark:text-[#e8edf8]/65 font-medium" : "text-[#657568] dark:text-[#e8edf8]/40"}`}>
                        {convo.last_message
                          ? (String(convo.last_sender_id) === String(session?.user?.id) ? "You: " : "") + convo.last_message
                          : "No messages yet"}
                      </p>
                      {unread > 0 && (
                        <span className="shrink-0 min-w-5 h-5 px-1 rounded-full bg-[#1a6c2a] dark:bg-[#c9a028] text-white dark:text-[#070b14] text-[10px] font-bold flex items-center justify-center">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}