// components/chatbot/ChatWidget.jsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatbot } from '@/app/hooks/useChatbot';
import ChatMessage from './ChatMessage';
import TypingIndicator from './TypingIndicator';
import { useSession } from 'next-auth/react';
import { useFloatingPanel } from '@/components/layout/FloatingPanelProvider';

// Contextual suggestions shown after specific assistant replies
// Already-asked questions are filtered out so pills stay fresh
function getContextualSuggestions(messages) {
  const askedByUser = new Set(
    messages
      .filter(m => m.role === 'user')
      .map(m => m.content.trim().toLowerCase())
  );

  const filter = (pills) =>
    pills.filter(p => !askedByUser.has(p.toLowerCase())).slice(0, 3);

  // ── Initial greeting ──────────────────────────────────────────
  if (messages.length === 1) {
    return filter([
      'What can I sell here?',
      'How do I post a listing?',
      'Is this marketplace safe?',
    ]);
  }

  // Read BOTH the last bot reply AND the last user message for signals
  const lastBot  = [...messages].reverse().find(m => m.role === 'assistant');
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  const botText  = (lastBot?.content  || '').toLowerCase();
  const userText = (lastUser?.content || '').toLowerCase();
  const combined = botText + ' ' + userText;

  const has = (...terms) => terms.some(t => combined.includes(t));

  // ── Product recommendations shown ────────────────────────────
  if (has('₱', 'in stock', 'seller:', '/products/')) {
    return filter([
      'How do I buy this?',
      'How do I add to cart?',
      'How do I message the seller?',
    ]);
  }

  // ── Buying / cart / checkout ──────────────────────────────────
  if (has('add to cart', 'buy now', 'product detail', 'cart', 'checkout', 'place order', 'bumili', 'order')) {
    return filter([
      'How do I track my order?',
      'How do I cancel an order?',
      'How do I message the seller?',
    ]);
  }

  // ── Order tracking / status ───────────────────────────────────
  if (has('track', 'pending', 'confirmed', 'shipped', 'completed', 'cancelled', 'my orders')) {
    return filter([
      'How do I cancel an order?',
      'How do I leave a review?',
      'How do I message the seller?',
    ]);
  }

  // ── Selling / listings ────────────────────────────────────────
  if (has('listing', 'sell', 'post', 'ibenta', 'mag-sell', 'add product', 'visibility')) {
    return filter([
      'How do I edit a listing?',
      'How do I add photos?',
      'How do I set my price?',
    ]);
  }

  // ── Scam / safety / fraud ─────────────────────────────────────
  if (has('scam', 'fraud', 'warning', 'suspicious', 'report', 'safe', 'payment')) {
    return filter([
      'What payment methods are safe?',
      'How do I report a seller?',
      'How do I verify a seller?',
    ]);
  }

  // ── Messaging / conversations ─────────────────────────────────
  if (has('message', 'chat', 'conversation', 'inbox', 'mag-message', 'seller')) {
    return filter([
      'How do I view my messages?',
      'How do I message a seller?',
      'What are unread message badges?',
    ]);
  }

  // ── Account / profile / auth ──────────────────────────────────
  if (has('login', 'register', 'sign in', 'sign up', 'password', 'profile', 'account', 'google')) {
    return filter([
      'How do I change my password?',
      'How do I update my profile?',
      'How do I log out?',
    ]);
  }

  // ── Reviews ───────────────────────────────────────────────────
  if (has('review', 'rating', 'stars', 'feedback', 'completed')) {
    return filter([
      'How do I leave a review?',
      'How do I view product ratings?',
      'Can I edit my review?',
    ]);
  }

  // ── Search / browsing ─────────────────────────────────────────
  if (has('search', 'browse', 'find', 'category', 'filter', 'sort')) {
    return filter([
      'How do I filter by category?',
      'How do I sort products?',
      'What categories are available?',
    ]);
  }

  // ── Fallback — always show something ─────────────────────────
  return filter([
    'What can I sell here?',
    'How do I post a listing?',
    'Is this marketplace safe?',
  ]);
}

const MAX_CHARS = 500;

export default function ChatWidget() {
  const { id, isOpen, openPanel, closePanel } = useFloatingPanel();
  const [hasSeenChat, setHasSeenChat] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isDark, setIsDark] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const widgetRef = useRef(null);
  const toggleRef = useRef(null);
  const { data: session } = useSession();

  const { messages, isLoading, error, sendMessage, clearMessages } = useChatbot();

  useEffect(() => {
    const viewport = window.visualViewport;
    function updateViewport() {
      const widget = widgetRef.current;
      if (!widget) return;
      const height = viewport?.height || window.innerHeight;
      widget.style.setProperty('--chat-offset', window.innerWidth >= 640 ? '1.5rem' : '1rem');
      widget.style.setProperty('--chat-viewport-height', `${height}px`);
      widget.style.setProperty('--chat-viewport-width', `${viewport?.width || window.innerWidth}px`);
      widget.style.setProperty('--chat-keyboard-inset', `${Math.max(0, window.innerHeight - height - (viewport?.offsetTop || 0))}px`);
    }
    updateViewport();
    window.addEventListener('resize', updateViewport);
    viewport?.addEventListener('resize', updateViewport);
    viewport?.addEventListener('scroll', updateViewport);
    return () => {
      window.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('scroll', updateViewport);
    };
  }, []);

  // Track dark mode from <html class="dark">
  useEffect(() => {
    const update = () => setIsDark(document.documentElement.classList.contains('dark'));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input when opened
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 100);
    function handleEscape(event) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closePanel();
      toggleRef.current?.focus({ preventScroll: true });
    }
    document.addEventListener('keydown', handleEscape);
    return () => { clearTimeout(timer); document.removeEventListener('keydown', handleEscape); };
  }, [isOpen, closePanel]);

  async function handleSend() {
    const text = inputValue.trim();
    if (!text || isLoading) return;
    setInputValue('');
    await sendMessage(text);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const charsLeft = MAX_CHARS - inputValue.length;
  const suggestions = getContextualSuggestions(messages);

  return (
    <div ref={widgetRef} className="pm-chat-widget fixed z-50 flex flex-col items-end gap-2" style={{
      right: 'max(var(--chat-offset, 1rem), env(safe-area-inset-right))',
      bottom: 'calc(max(var(--chat-offset, 1rem), env(safe-area-inset-bottom)) + var(--chat-keyboard-inset, 0px))',
      maxWidth: 'calc(var(--chat-viewport-width, 100vw) - 2rem)',
    }}>

      {/* ── Chat Window ─────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id={id}
            role="dialog"
            aria-label="PiyuBot assistant"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0 } }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              width: 370,
              maxWidth: 'calc(var(--chat-viewport-width, 100vw) - 2rem)',
              maxHeight: 'min(560px, calc(var(--chat-viewport-height, 100dvh) - max(var(--chat-offset, 1rem), env(safe-area-inset-bottom)) - 5rem))',
            }}
            className="pm-chat-panel min-h-0 bg-white dark:bg-[#12121a] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/[0.08] flex flex-col overflow-hidden transition-colors duration-300"
          >

            {/* Header */}
            <div className="shrink-0 bg-blue-900 dark:bg-[#181825] px-3 py-3 sm:px-4 flex items-center justify-between gap-2 border-b border-transparent dark:border-white/[0.06] transition-colors duration-300">
              <div className="flex min-w-0 items-center gap-2">
                <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-white/20">
                  <img src="/img/chatbotpfp.png" alt="PiyuBot" className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="text-white dark:text-[#f5f5f5] text-sm font-semibold">PiyuBot</p>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <p className="truncate text-blue-200 dark:text-[#b4b4c7] text-xs">PiyuMart AI Assistant</p>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <button
                  onClick={clearMessages}
                  title="Clear chat"
                  className="text-blue-200 dark:text-[#b4b4c7] hover:text-white text-xs transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={() => { closePanel(); toggleRef.current?.focus({ preventScroll: true }); }}
                  aria-label="Close chat"
                  className="text-blue-200 dark:text-[#b4b4c7] hover:text-white transition-colors text-lg leading-none"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-1 min-h-0 bg-[#fcfcfd] dark:bg-[#0f0f14] scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-white/[0.12] transition-colors duration-300">
              {messages.map((msg, i) => (
                <ChatMessage key={i} role={msg.role} content={msg.content} />
              ))}

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex justify-start"
                >
                  <TypingIndicator />
                </motion.div>
              )}

              {error && (
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20">
                  <p className="text-red-500 dark:text-red-400 text-xs">{error}</p>
                  <button
                    onClick={() => sendMessage(messages.findLast(m => m.role === 'user')?.content || '')}
                    className="text-xs text-red-500 dark:text-red-400 underline underline-offset-2 shrink-0 hover:text-red-700 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Contextual suggestions */}
            {suggestions.length > 0 && !isLoading && (
              <div className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-2 pt-1 flex flex-wrap gap-1.5 border-t border-gray-100 dark:border-white/[0.05]">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-xs bg-blue-50 dark:bg-white/[0.04] text-blue-800 dark:text-[#d6d6ea] border border-blue-200 dark:border-white/[0.08] rounded-full px-3 py-1 hover:bg-blue-100 dark:hover:bg-white/[0.08] transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input area */}
            {session ? (
              <div className="shrink-0 border-t border-gray-100 dark:border-white/[0.06] bg-white dark:bg-[#12121a] px-3 py-2 flex flex-col gap-1 transition-colors duration-300">
                <div className="flex gap-2 items-center">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value.slice(0, MAX_CHARS))}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask PiyuBot anything..."
                    maxLength={MAX_CHARS}
                    disabled={isLoading}
                    style={{
                      color: isDark ? '#f3f4f6' : '#111827',
                      WebkitTextFillColor: isDark ? '#f3f4f6' : '#111827',
                      caretColor: isDark ? '#f3f4f6' : '#111827',
                    }}
                    className="min-w-0 flex-1 text-sm bg-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none disabled:opacity-50 py-1 transition-colors duration-300"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isLoading}
                    className="bg-blue-900 dark:bg-[#c9a96e] text-white dark:text-[#0a0a0f] rounded-xl px-3 py-1.5 text-sm font-medium disabled:opacity-40 hover:bg-blue-800 dark:hover:bg-[#d8b57a] transition-colors shrink-0"
                  >
                    Send
                  </button>
                </div>
                {/* Character counter — only visible when approaching the limit */}
                {charsLeft <= 100 && (
                  <p className={`text-right text-[10px] transition-colors ${charsLeft <= 20 ? 'text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>
                    {charsLeft} remaining
                  </p>
                )}
              </div>
            ) : (
              <div className="shrink-0 border-t border-gray-100 dark:border-white/[0.06] px-4 py-3 text-center">
                <p className="text-xs text-gray-500 dark:text-[#9b9bb0]">
                  Please{' '}
                  <a href="/login" className="text-blue-700 dark:text-[#d4b27c] underline">
                    log in
                  </a>
                  {' '}to chat with PiyuBot.
                </p>
              </div>
            )}

          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toggle Button ──────────────────────────────── */}
      <motion.button
        ref={toggleRef}
        type="button"
        onClick={() => {
          if (isOpen) closePanel(); else openPanel();
          if (!hasSeenChat) setHasSeenChat(true);
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Toggle PiyuBot chat"
        aria-expanded={isOpen}
        aria-controls={isOpen ? id : undefined}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#0f1f5c] text-[#f2c94c] shadow-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c94c] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
      >
        {isOpen ? (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-[#0f1f5c] text-2xl text-[#f2c94c] transition-colors hover:bg-[#172c78]">
            ×
          </div>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M7 10h10M7 14h6m-1 7-3.5-3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-3l-3 3Z" /></svg>
        )}

        {!isOpen && !hasSeenChat && (
          <span className="absolute top-0 right-0 translate-x-[15%] -translate-y-[15%] w-4 h-4 bg-orange-400 rounded-full border-[3px] border-white dark:border-[#12121a] z-20 shadow-sm" />
        )}
      </motion.button>

    </div>
  );
}
