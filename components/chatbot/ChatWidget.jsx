'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatbot } from '@/app/hooks/useChatbot';
import ChatMessage from './ChatMessage';
import TypingIndicator from './TypingIndicator';
import { useSession } from 'next-auth/react';

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasSeenChat, setHasSeenChat] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isDark, setIsDark] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const { data: session } = useSession();

  // Track dark mode from <html class="dark">
  useEffect(() => {
    const update = () =>
      setIsDark(document.documentElement.classList.contains('dark'));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  const {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
  } = useChatbot();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, [messages, isLoading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

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

  // Suggestion pills
  const suggestions = [
    'What can I sell here?',
    'How do I post a listing?',
    'Is this marketplace safe?',
  ];

  return (
    <div className='fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2'>

      {/* ── Chat Window ───────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 30,
            }}
            className='
              w-[370px]
              max-h-[560px]

              bg-white dark:bg-[#12121a]

              rounded-2xl
              shadow-2xl

              border border-gray-200
              dark:border-white/[0.08]

              flex flex-col
              overflow-hidden

              transition-colors duration-300
            '
          >

            {/* ── Header ───────────────────────────── */}
            <div
              className='
                bg-blue-900 dark:bg-[#181825]

                px-4 py-3

                flex items-center justify-between

                border-b border-transparent
                dark:border-white/[0.06]

                transition-colors duration-300
              '
            >
              <div className='flex items-center gap-2'>

                {/* Bot Avatar */}
                <div className='w-8 h-8 rounded-full overflow-hidden shrink-0 border border-white/20'>
                  <img
                    src='/img/chatbotpfp.png'
                    alt='PiyuBot'
                    className='w-full h-full object-cover'
                  />
                </div>

                {/* Bot Info */}
                <div>
                  <p
                    className='
                      text-white
                      dark:text-[#f5f5f5]

                      text-sm
                      font-semibold
                    '
                  >
                    PiyuBot
                  </p>

                  <p
                    className='
                      text-blue-200
                      dark:text-[#b4b4c7]

                      text-xs
                    '
                  >
                    PiyuMart AI Assistant
                  </p>
                </div>
              </div>

              {/* Header Buttons */}
              <div className='flex items-center gap-2'>

                <button
                  onClick={clearMessages}
                  title='Clear chat'
                  className='
                    text-blue-200
                    dark:text-[#b4b4c7]

                    hover:text-white

                    text-xs
                    transition-colors
                  '
                >
                  Clear
                </button>

                <button
                  onClick={() => setIsOpen(false)}
                  aria-label='Close chat'
                  className='
                    text-blue-200
                    dark:text-[#b4b4c7]

                    hover:text-white

                    transition-colors

                    text-lg
                    leading-none
                  '
                >
                  ×
                </button>
              </div>
            </div>

            {/* ── Messages Area ───────────────────── */}
            <div
              className='
                flex-1
                overflow-y-auto

                p-4
                space-y-1
                min-h-0

                bg-[#fcfcfd]
                dark:bg-[#0f0f14]

                scrollbar-thin
                scrollbar-thumb-gray-300
                dark:scrollbar-thumb-white/[0.12]

                transition-colors duration-300
              '
            >

              {/* Messages */}
              {messages.map((msg, i) => (
                <ChatMessage
                  key={i}
                  role={msg.role}
                  content={msg.content}
                />
              ))}

              {/* Typing */}
              {isLoading && (
                <div className='flex justify-start'>
                  <TypingIndicator />
                </div>
              )}

              {/* Error */}
              {error && (
                <p className='text-center text-red-500 text-xs py-2'>
                  {error}
                </p>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* ── Suggestions ─────────────────────── */}
            {messages.length === 1 && (
              <div className='px-4 pb-2 flex flex-wrap gap-1.5'>

                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className='
                      text-xs

                      bg-blue-50
                      dark:bg-white/[0.04]

                      text-blue-800
                      dark:text-[#d6d6ea]

                      border border-blue-200
                      dark:border-white/[0.08]

                      rounded-full
                      px-3 py-1

                      hover:bg-blue-100
                      dark:hover:bg-white/[0.08]

                      transition-colors
                    '
                  >
                    {s}
                  </button>
                ))}

              </div>
            )}

            {/* ── Input Area ─────────────────────── */}
            {session ? (
              <div
                className='
                  border-t border-gray-100
                  dark:border-white/[0.06]

                  bg-white
                  dark:bg-[#12121a]

                  px-3 py-2
                  flex gap-2

                  transition-colors duration-300
                '
              >

                {/* Input */}
                <input
                  ref={inputRef}
                  type='text'
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder='Ask PiyuBot anything...'
                  maxLength={500}
                  disabled={isLoading}

                  style={{
                    color:               isDark ? '#f3f4f6' : '#111827',
                    WebkitTextFillColor: isDark ? '#f3f4f6' : '#111827',
                    caretColor:          isDark ? '#f3f4f6' : '#111827',
                  }}
                  className='
                    flex-1

                    text-sm

                    bg-transparent

                    placeholder:text-gray-400
                    dark:placeholder:text-gray-500

                    outline-none

                    disabled:opacity-50

                    py-1

                    transition-colors duration-300
                  '
                />

                {/* Send Button */}
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isLoading}
                  className='
                    bg-blue-900
                    dark:bg-[#c9a96e]

                    text-white
                    dark:text-[#0a0a0f]

                    rounded-xl

                    px-3 py-1.5

                    text-sm
                    font-medium

                    disabled:opacity-40

                    hover:bg-blue-800
                    dark:hover:bg-[#d8b57a]

                    transition-colors

                    shrink-0
                  '
                >
                  Send
                </button>

              </div>
            ) : (

              /* Guest Login */
              <div
                className='
                  border-t border-gray-100
                  dark:border-white/[0.06]

                  px-4 py-3
                  text-center
                '
              >
                <p
                  className='
                    text-xs
                    text-gray-500
                    dark:text-[#9b9bb0]
                  '
                >
                  Please{' '}

                  <a
                    href='/login'
                    className='
                      text-blue-700
                      dark:text-[#d4b27c]

                      underline
                    '
                  >
                    log in
                  </a>

                  {' '}to chat with PiyuBot.
                </p>
              </div>
            )}

          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toggle Button ───────────────────────── */}
      <motion.button
        onClick={() => {
          setIsOpen((o) => !o);

          if (!hasSeenChat) {
            setHasSeenChat(true);
          }
        }}

        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}

        aria-label='Toggle PiyuBot chat'

        className='
          relative

          w-14
          h-14

          rounded-full

          shadow-lg

          flex items-center justify-center

          transition-colors
        '
      >

        {isOpen ? (

          <div
            className='
              w-full
              h-full

              rounded-full

              bg-blue-900
              dark:bg-[#c9a96e]

              flex items-center justify-center

              text-white
              dark:text-[#0a0a0f]

              text-2xl

              hover:bg-blue-800
              dark:hover:bg-[#d8b57a]

              transition-colors
            '
          >
            ×
          </div>

        ) : (

          <div
            className='
              w-full
              h-full

              rounded-full

              overflow-hidden
            '
          >
            <img
              src='/img/chatbotpfp.png'
              alt='Chat'
              className='
                w-full
                h-full

                object-cover
              '
            />
          </div>

        )}
      {!isOpen && !hasSeenChat && (
        <span
          className='
            absolute

            top-0
            right-0

            translate-x-[15%]
            -translate-y-[15%]

            w-4
            h-4

            bg-orange-400

            rounded-full

            border-[3px]
            border-white
            dark:border-[#12121a]

            z-20

            shadow-sm
          '
        />
      )}

      </motion.button>

    </div>
  );
}