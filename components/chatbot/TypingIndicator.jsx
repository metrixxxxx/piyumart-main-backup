// Animated typing indicator shown while AI is generating a response.

'use client';

import { useState, useEffect } from 'react';

export default function TypingIndicator() {
  const [isDark, setIsDark] = useState(false);

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

  return (
    <div
      className={`flex items-center gap-2 px-4 py-3 rounded-2xl w-fit max-w-xs
        ${isDark ? 'bg-gray-100' : 'bg-gray-800'}`}
    >

      {/* Typing Text */}
      <span
        className='text-sm font-medium'
        style={{ color: isDark ? '#111827' : '#f3f4f6' }}
      >
        Typing
      </span>

      {/* Animated Dots */}
      <div className='flex items-center gap-1'>
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className='w-2 h-2 rounded-full animate-bounce'
            style={{
              animationDelay: `${i * 0.15}s`,
              backgroundColor: isDark ? '#111827' : '#f3f4f6',
            }}
          />
        ))}
      </div>

    </div>
  );
}