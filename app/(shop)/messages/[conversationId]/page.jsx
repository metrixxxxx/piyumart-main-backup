"use client";
import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ConversationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { conversationId } = useParams();
  const [messages, setMessages] = useState([]);
  const [convoInfo, setConvoInfo] = useState(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status !== "authenticated") return;
    console.log("session user:", JSON.stringify(session.user));

    // Fetch messages
    fetch(`/api/messages/${conversationId}`)
      .then((r) => r.json())
      .then((data) => setMessages(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));

    // Fetch conversation info
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const found = data.find((c) => Number(c.id) === Number(conversationId));
          if (found) setConvoInfo(found);
        }
      });

    // ✅ Supabase Realtime — listen for new messages
    const channel = supabase
  .channel(`conversation:${conversationId}`)
  .on(
    "broadcast",
    { event: "message:new" },
    (payload) => {
      const newMsg = payload.payload.message;
      if (String(newMsg.sender_id) !== String(session.user.id)) {
        setMessages((prev) => [...prev, newMsg]);
        fetch(`/api/messages/${conversationId}`, { method: "GET" });
      }
    }
  )
  .subscribe();

    return () => supabase.removeChannel(channel);
  }, [status, session?.user?.id, conversationId]);

  // Auto scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || sending) return;
    setSending(true);
    const content = input.trim();
    setInput("");

    const optimistic = {
      id: Date.now(),
      conversation_id: Number(conversationId),
      sender_id: session.user.id,
      sender_name: session.user.name,
      content,
      created_at: new Date().toISOString(),
      is_read: false,
      optimistic: true,
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch(`/api/messages/${conversationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      setMessages((prev) => prev.map((m) => m.optimistic ? data : m));
    } catch (err) {
      setMessages((prev) => prev.filter((m) => !m.optimistic));
      setInput(content);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }
  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function formatTime(dateStr) {
    return new Date(dateStr).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  }

  // Group messages by date
  function groupByDate(msgs) {
    const groups = [];
    let currentDate = null;
    msgs.forEach((msg) => {
      const date = formatDate(msg.created_at);
      if (date !== currentDate) {
        groups.push({ type: "date", label: date });
        currentDate = date;
      }
      groups.push({ type: "message", ...msg });
    });
    return groups;
  }

  const otherUserName = convoInfo?.other_user_name || "User";
  const otherInitials = otherUserName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const grouped = groupByDate(messages);

  if (loading) return (
    <div className="min-h-screen bg-[#f0eeff] dark:bg-[#070b14] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-[3px] border-[#c5cfe8] dark:border-white/10 border-t-[#1a2a6c] dark:border-t-[#c9a028] rounded-full mx-auto mb-4 animate-spin" />
        <p className="text-sm text-[#0e1a3d]/50 dark:text-[#e8edf8]/40">Loading chat...</p>
      </div>
    </div>
  );

  return (
    <main className="min-h-[calc(100dvh-68px)] bg-[#f0eeff] px-3 py-3 dark:bg-[#070b14] sm:px-6 sm:py-5">
      <section className="mx-auto flex h-[calc(100dvh-108px)] min-h-105 max-h-205 w-full max-w-5xl flex-col overflow-hidden rounded-md border border-[#dce4df] bg-white shadow-[0_12px_40px_rgba(14,26,61,0.08)] dark:border-white/[0.07] dark:bg-[#0e1520]">
      <div className="flex items-center gap-3 border-b border-[#e8eee9] bg-[#1a2a6c] px-3 py-3 dark:border-white/[0.07] dark:bg-[#0a0e1f] sm:px-5">
        <button
          onClick={() => router.push("/messages")}
          aria-label="Back to messages"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d8b94e]"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-[#d8b94e] flex items-center justify-center text-[#1a2a6c] font-bold text-sm shrink-0">
          {otherInitials}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{otherUserName}</p>
          {convoInfo?.product_name && (
            <p className="text-[11px] text-white/65 truncate">About {convoInfo.product_name}</p>
          )}
          {!convoInfo?.product_name && (
            <p className="text-[11px] text-white/55">Marketplace conversation</p>
          )}
        </div>

        {/* Product thumbnail */}
        {convoInfo?.product_image && (
          <img
            src={convoInfo.product_image}
            alt={convoInfo.product_name || "Product"}
            className="w-9 h-9 rounded-sm object-cover border border-white/20 shrink-0"
          />
        )}
      </div>

      {/* Messages */}
      <div aria-label="Conversation messages" className="min-h-0 flex-1 overflow-y-auto bg-[#f4f7f4] px-4 py-5 flex flex-col gap-1 dark:bg-[#0b1118] sm:px-8">
        {grouped.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white text-[#1a6c2a] flex items-center justify-center shadow-sm dark:bg-white/6 dark:text-[#d8b94e]">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h8m-8 4h5m-9 6 2.1-3.15A8.97 8.97 0 013 12a9 9 0 1118 0 9 9 0 01-9 9c-1.62 0-3.15-.43-4.47-1.18L4 20z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-[#0e1a3d]/50 dark:text-[#e8edf8]/40">
                Say hi to {otherUserName}!
              </p>
            </div>
          </div>
        ) : (
          grouped.map((item, idx) => {
            if (item.type === "date") return (
              <div key={idx} className="flex items-center gap-3 my-3">
                <div className="flex-1 h-px bg-[#dce4df] dark:bg-white/9" />
                <span className="text-[10px] text-[#657568] dark:text-[#e8edf8]/40 font-semibold shrink-0">
                  {item.label}
                </span>
                <div className="flex-1 h-px bg-[#dce4df] dark:bg-white/9" />
              </div>
            );

            const isMe = String(item.sender_id) === String(session?.user?.id);
            return (
              <div key={item.id} className={`flex ${isMe ? "justify-end" : "justify-start"} mb-1`}>
                <div className={`max-w-[88%] sm:max-w-[75%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                  <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed wrap-break-word
                    ${isMe
                      ? "bg-[#1a2a6c] dark:bg-[#c9a028] text-white dark:text-[#070b14] rounded-br-sm"
                      : "bg-white dark:bg-[#0e1520] text-[#0e1a3d] dark:text-[#e8edf8] border border-[#e1e8e2] dark:border-white/[0.07] rounded-bl-sm"
                    } ${item.optimistic ? "opacity-70" : ""}`}>
                    {item.content}
                  </div>
                  <span className="text-[10px] text-[#657568]/75 dark:text-[#e8edf8]/35 mt-1 px-1">
                    {formatTime(item.created_at)}
                    {isMe && (
                      <span className="ml-1">
                        {item.is_read ? "✓✓" : "✓"}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white dark:bg-[#0e1520] border-t border-[#e8eee9] dark:border-white/[0.07] px-3 py-3 flex items-end gap-2 shrink-0 sm:px-5">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Type a message"
          placeholder="Type a message..."
          rows={1}
          className="flex-1 resize-none bg-[#f4f7f4] dark:bg-white/5 border border-[#dce4df] dark:border-white/8 rounded-xl px-4 py-2.5 text-sm text-[#0e1a3d] dark:text-[#e8edf8] placeholder-[#657568]/70 dark:placeholder-white/30 outline-none focus:border-[#1a6c2a] focus:ring-2 focus:ring-[#1a6c2a]/15 dark:focus:border-[#c9a028] transition-colors max-h-32 overflow-y-auto"
          style={{ lineHeight: "1.5" }}
          onInput={(e) => {
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 128) + "px";
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          aria-label={sending ? "Sending message" : "Send message"}
          title={sending ? "Sending message" : "Send message"}
          className="w-11 h-11 rounded-xl bg-[#1a6c2a] dark:bg-[#c9a028] flex items-center justify-center shrink-0 text-white dark:text-[#070b14] transition-colors disabled:opacity-40 hover:bg-[#145520] dark:hover:bg-[#e0bf60] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a6c2a]"
        >
          <svg className="w-4 h-4 text-white dark:text-[#070b14] translate-x-px" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
      </section>
    </main>
  );
}