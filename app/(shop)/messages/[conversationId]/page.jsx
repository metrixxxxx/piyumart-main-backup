"use client";
import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { getSocket } from "@/lib/socket";

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

    // Socket — listen for new messages
    const socket = getSocket(session.user.id);
    socket.on("message:received", ({ conversationId: cId, message }) => {
      if (Number(cId) === Number(conversationId)) {
        setMessages((prev) => [...prev, message]);
        // Mark as read since naka-open ang conversation
        fetch(`/api/messages/${conversationId}`, { method: "GET" });
      }
    });

    return () => socket.off("message:received");
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

    // Optimistic update
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
      // Replace optimistic with real message
      setMessages((prev) => prev.map((m) => m.optimistic ? data : m));
    } catch (err) {
      // Remove optimistic on error
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
    <div className="min-h-screen bg-[#eef2f7] dark:bg-[#070b14] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-[3px] border-[#c5cfe8] dark:border-white/10 border-t-[#1a2a6c] dark:border-t-[#c9a028] rounded-full mx-auto mb-4 animate-spin" />
        <p className="text-sm text-[#0e1a3d]/50 dark:text-[#e8edf8]/40">Loading chat...</p>
      </div>
    </div>
  );

  return (
    <main className="h-screen flex flex-col bg-[#eef2f7] dark:bg-[#070b14] transition-colors duration-300">

      {/* Header */}
      <div className="bg-[#1a2a6c] dark:bg-[#0a0e1f] px-4 py-3 flex items-center gap-3 shrink-0">
        <button
          onClick={() => router.push("/messages")}
          className="text-white/60 hover:text-white transition p-1"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#c9a028] to-[#e8b830] flex items-center justify-center text-[#1a2a6c] font-bold text-sm shrink-0">
          {otherInitials}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{otherUserName}</p>
          {convoInfo?.product_name && (
            <p className="text-[10px] text-white/50 truncate">re: {convoInfo.product_name}</p>
          )}
        </div>

        {/* Product thumbnail */}
        {convoInfo?.product_image && (
          <img
            src={convoInfo.product_image}
            className="w-9 h-9 rounded-sm object-cover border border-white/20 shrink-0"
          />
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">
        {grouped.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-3">👋</div>
              <p className="text-sm font-semibold text-[#0e1a3d]/50 dark:text-[#e8edf8]/40">
                Say hi to {otherUserName}!
              </p>
            </div>
          </div>
        ) : (
          grouped.map((item, idx) => {
            if (item.type === "date") return (
              <div key={idx} className="flex items-center gap-3 my-3">
                <div className="flex-1 h-px bg-[#e8edf8] dark:bg-white/[0.07]" />
                <span className="text-[10px] text-[#0e1a3d]/35 dark:text-[#e8edf8]/25 font-semibold shrink-0">
                  {item.label}
                </span>
                <div className="flex-1 h-px bg-[#e8edf8] dark:bg-white/[0.07]" />
              </div>
            );

            const isMe = String(item.sender_id) === String(session?.user?.id);
            return (
              <div key={item.id} className={`flex ${isMe ? "justify-end" : "justify-start"} mb-1`}>
                <div className={`max-w-[75%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                  <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed
                    ${isMe
                      ? "bg-[#1a2a6c] dark:bg-[#c9a028] text-white dark:text-[#070b14] rounded-br-sm"
                      : "bg-white dark:bg-[#0e1520] text-[#0e1a3d] dark:text-[#e8edf8] border border-[#e8edf8] dark:border-white/[0.07] rounded-bl-sm"
                    } ${item.optimistic ? "opacity-70" : ""}`}>
                    {item.content}
                  </div>
                  <span className="text-[9px] text-[#0e1a3d]/30 dark:text-[#e8edf8]/25 mt-1 px-1">
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
      <div className="bg-white dark:bg-[#0e1520] border-t border-[#e8edf8] dark:border-white/[0.07] px-4 py-3 flex items-end gap-2 shrink-0">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="flex-1 resize-none bg-[#f0f4ff] dark:bg-white/[0.05] border border-[#e8edf8] dark:border-white/[0.08] rounded-2xl px-4 py-2.5 text-sm text-[#0e1a3d] dark:text-[#e8edf8] placeholder-[#0e1a3d]/30 dark:placeholder-white/20 outline-none focus:border-[#1a2a6c] dark:focus:border-[#c9a028] transition-colors max-h-32 overflow-y-auto"
          style={{ lineHeight: "1.5" }}
          onInput={(e) => {
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 128) + "px";
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="w-10 h-10 rounded-full bg-[#1a2a6c] dark:bg-[#c9a028] flex items-center justify-center shrink-0 transition-opacity disabled:opacity-40 hover:opacity-90"
        >
          <svg className="w-4 h-4 text-white dark:text-[#070b14] translate-x-px" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </main>
  );
}