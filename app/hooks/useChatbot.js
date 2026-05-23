// ─────────────────────────────────────────────────────────────────────────
// PURPOSE: Custom React hook that manages chatbot state and API calls.
// Separating this logic from the UI keeps components clean.
// ─────────────────────────────────────────────────────────────────────────
'use client';
import { useState, useCallback, useRef } from 'react';

export function useChatbot() {
  // messages: array of {role: 'user'|'assistant', content: string}
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hi! I am PiyuBot, your PiyuMart assistant. How can I help you today? I can help you find products, answer questions about the marketplace, or guide you through buying and selling.',
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null); // for cancelling requests

  const sendMessage = useCallback(async (userInput) => {
    if (!userInput?.trim() || isLoading) return;

    const userMessage = { role: 'user', content: userInput.trim() };

    // Optimistically add user message to UI immediately
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const response = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: userInput.trim(),
          // Send last 10 messages as history (excludes the initial greeting)
          history: messages.slice(1).slice(-10),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Error ${response.status}`);
      }

      // Add AI reply to messages
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.reply },
      ]);

    } catch (err) {
      if (err.name === 'AbortError') return; // user cancelled — ignore
      setError(err.message || 'Something went wrong. Please try again.');
      // Remove the optimistic user message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [messages, isLoading]);

  const clearMessages = useCallback(() => {
    setMessages([{
      role: 'assistant',
      content: 'Chat cleared. How can I help you?',
    }]);
    setError(null);
  }, []);

  return { messages, isLoading, error, sendMessage, clearMessages };
}
