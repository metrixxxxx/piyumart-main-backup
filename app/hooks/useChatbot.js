// app/hooks/useChatbot.js
'use client';
import { useState, useCallback, useRef, useEffect } from 'react';

const STORAGE_KEY = 'piyubot_history';
const GREETING = {
  role: 'assistant',
  content: 'Hi! I\'m PiyuBot, your PiyuMart assistant. How can I help you today? I can help you find products, answer questions about the marketplace, or guide you through buying and selling.',
};

function loadHistory() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [GREETING];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [GREETING];
  } catch {
    return [GREETING];
  }
}

function saveHistory(messages) {
  try {
    // Only persist the last 20 messages to keep storage light
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20)));
  } catch {
    // sessionStorage full or unavailable — silently skip
  }
}

export function useChatbot() {
  const [messages, setMessages] = useState([GREETING]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const initialized = useRef(false);

  // Restore session history on first mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const stored = loadHistory();
    setMessages(stored);
  }, []);

  // Persist to sessionStorage whenever messages change
  useEffect(() => {
    if (!initialized.current) return;
    saveHistory(messages);
  }, [messages]);

  const sendMessage = useCallback(async (userInput) => {
    if (!userInput?.trim() || isLoading) return;

    const userMessage = { role: 'user', content: userInput.trim() };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      // Route is the authority on history depth — send all we have;
      // the server trims to its own limit.
      const response = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: userInput.trim(),
          history: messages.slice(1), // exclude greeting
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Error ${response.status}`);
      }

      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.reply },
      ]);

    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Something went wrong. Please try again.');
      setMessages(prev => prev.slice(0, -1)); // remove optimistic user message
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [messages, isLoading]);

  const clearMessages = useCallback(() => {
    const fresh = [{ role: 'assistant', content: 'Chat cleared. How can I help you?' }];
    setMessages(fresh);
    setError(null);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  return { messages, isLoading, error, sendMessage, clearMessages };
}