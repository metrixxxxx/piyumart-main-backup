"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";

export default function MessagesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status !== "authenticated") return;

    fetch("/api/conversations")
      .then((r) => r.json())
      .then((data) => setConversations(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));

    // Real-time — update unread count kapag may bagong message
    const socket = getSocket(session.user.id);
    socket.on("message:received", ({ conversationId }) => {
      setConversations((prev) =>
        prev.map((c) =>
          Number(c.id) === Number(conversationId)
            ? { ...c, unread_count: Number(c.unread_count) + 1 }
            : c
        )
      );
    });
    return () => socket.off("message:received");
  }, [status, session?.user?.id]);

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
    <div className="min-h-screen bg-[#eef2f7] dark:bg-[#070b14] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-[3px] border-[#c5cfe8] dark:border-white/10 border-t-[#1a2a6c] dark:border-t-[#c9a028] rounded-full mx-auto mb-4 animate-spin" />
        <p className="text-sm text-[#0e1a3d]/50 dark:text-[#e8edf8]/40">Loading messages...</p>
      </div>
    </div>
  );

  const totalUnread = conversations.reduce((s, c) => s + Number(c.unread_count || 0), 0);

  return (
    <main className="min-h-screen bg-[#eef2f7] dark:bg-[#070b14] transition-colors duration-300">

      {/* Hero */}
      <section className="bg-[#1a2a6c] dark:bg-[#0a0e1f] px-4 sm:px-5 py-10 text-center">
        <div className="inline-flex items-center gap-2 bg-white/10 text-[#c9a028] text-[11px] font-bold px-4 py-1.5 rounded-full mb-4 uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-[#c9a028]" />
          Inbox
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Messages</h1>
        <p className="mt-2 text-sm text-white/60">
          {totalUnread > 0 ? `${totalUnread} unread message${totalUnread !== 1 ? "s" : ""}` : "All caught up!"}
        </p>
      </section>

      <section className="max-w-[680px] mx-auto px-4 py-5">
        {conversations.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-[#0e1520] border border-[#c5cfe8] dark:border-white/[0.07] rounded-sm">
            <div className="text-5xl mb-4">💬</div>
            <h2 className="text-base font-bold text-[#0e1a3d] dark:text-[#e8edf8] mb-2">No messages yet</h2>
            <p className="text-sm text-[#0e1a3d]/50 dark:text-[#e8edf8]/40 mb-6">
              Start a conversation by clicking CHAT on a product page
            </p>
            <button onClick={() => router.push("/products")}
              className="bg-[#1a2a6c] text-white px-6 py-2.5 rounded-sm text-sm font-bold hover:bg-[#142060] transition">
              Browse Products
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#0e1520] border border-[#c5cfe8] dark:border-white/[0.07] rounded-sm overflow-hidden divide-y divide-[#f0f4ff] dark:divide-white/[0.04]">
            {conversations.map((convo) => {
              const unread = Number(convo.unread_count || 0);
              const initials = (convo.other_user_name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
              return (
                <div
                  key={convo.id}
                  onClick={() => router.push(`/messages/${convo.id}`)}
                  className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors hover:bg-[#f8f9ff] dark:hover:bg-white/[0.03]
                    ${unread > 0 ? "bg-[#f0f4ff] dark:bg-[#1a2a6c]/10" : ""}`}
                >
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#1a2a6c] to-[#2a3d8f] dark:from-[#c9a028] dark:to-[#e8b830] flex items-center justify-center text-white dark:text-[#070b14] font-bold text-sm shrink-0">
                    {initials}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className={`text-sm truncate ${unread > 0 ? "font-bold text-[#0e1a3d] dark:text-[#e8edf8]" : "font-semibold text-[#0e1a3d]/80 dark:text-[#e8edf8]/70"}`}>
                        {convo.other_user_name || "Unknown"}
                      </p>
                      <span className="text-[10px] text-[#0e1a3d]/35 dark:text-[#e8edf8]/30 shrink-0 ml-2">
                        {formatTime(convo.last_message_at)}
                      </span>
                    </div>

                    {/* Product context */}
                    {convo.product_name && (
                      <p className="text-[10px] text-[#1a2a6c] dark:text-[#c9a028] font-semibold truncate mb-0.5">
                        re: {convo.product_name}
                      </p>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs truncate ${unread > 0 ? "text-[#0e1a3d]/70 dark:text-[#e8edf8]/60 font-medium" : "text-[#0e1a3d]/40 dark:text-[#e8edf8]/30"}`}>
                        {convo.last_message
                          ? (String(convo.last_sender_id) === String(session?.user?.id) ? "You: " : "") + convo.last_message
                          : "No messages yet"}
                      </p>
                      {unread > 0 && (
                        <span className="shrink-0 w-5 h-5 rounded-full bg-[#1a2a6c] dark:bg-[#c9a028] text-white dark:text-[#070b14] text-[10px] font-bold flex items-center justify-center">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}