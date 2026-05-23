// lib/groqService.js
// ─────────────────────────────────────────────────────────────────────────
// PURPOSE: Initializes and exports the Groq AI client.
// This file only runs on the server (Node.js). It is never sent to browsers.
// ─────────────────────────────────────────────────────────────────────────

import Groq from 'groq-sdk';

if (!process.env.GROQ_API_KEY) {
  throw new Error(
    '[groqService] GROQ_API_KEY is missing from .env.local. ' +
    'Add it before starting the dev server.'
  );
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const DEFAULT_MODEL      = process.env.GROQ_MODEL        || 'llama-3.3-70b-versatile';
const DEFAULT_MAX_TOKENS = parseInt(process.env.GROQ_MAX_TOKENS  || '600');
const DEFAULT_TEMP       = parseFloat(process.env.GROQ_TEMPERATURE || '0.7');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Read Groq's retry-after header and return milliseconds to wait.
 * The header is either a number of seconds or an HTTP-date string.
 */
function getRetryAfterMs(err) {
  try {
    // groq-sdk surfaces headers on the raw response object
    const raw =
      err?.headers?.['retry-after'] ??
      err?.response?.headers?.['retry-after'] ??
      err?.error?.headers?.['retry-after'];

    if (!raw) return null;

    const secs = Number(raw);
    if (!isNaN(secs)) return secs * 1000;

    const date = new Date(raw);
    if (!isNaN(date.getTime())) return Math.max(0, date.getTime() - Date.now());
  } catch {}
  return null;
}

// ─── Core send ────────────────────────────────────────────────────────────────

/**
 * sendChatMessage — send a conversation to Groq and get a reply.
 *
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} options — override model, maxTokens, temperature
 * @returns {Promise<string>}
 */
export async function sendChatMessage(messages, options = {}) {
  const {
    model       = DEFAULT_MODEL,
    maxTokens   = DEFAULT_MAX_TOKENS,
    temperature = DEFAULT_TEMP,
  } = options;

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('[groqService] messages must be a non-empty array');
  }

  const completion = await groq.chat.completions.create({
    model,
    messages,
    max_tokens:  maxTokens,
    temperature,
  });

  const reply = completion.choices?.[0]?.message?.content;
  if (!reply) throw new Error('[groqService] Groq returned an empty response');

  return reply.trim();
}

// ─── Retry wrapper ────────────────────────────────────────────────────────────

/**
 * sendChatMessageWithRetry — retries on 429 with proper retry-after handling.
 *
 * Strategy:
 *  1. On 429, read Groq's retry-after header and wait that exact duration.
 *  2. If no header, fall back to exponential backoff (3 s → 6 s → 12 s → 24 s).
 *  3. Add ±500 ms jitter so concurrent users don't all retry simultaneously.
 *  4. On 5xx or connection errors, use the same backoff (these are transient).
 *  5. Fail immediately on 400 / 401 — retrying won't help.
 *
 * @param {Array}  messages
 * @param {object} options  — forwarded to sendChatMessage
 */
export async function sendChatMessageWithRetry(messages, options = {}) {
  const MAX_RETRIES  = 4;
  const BASE_DELAY   = 3000; // ms for attempt 0 fallback
  const MAX_WAIT     = 30_000;

  let lastErr;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await sendChatMessage(messages, options);

    } catch (err) {
      lastErr = err;
      const status = err?.status ?? err?.error?.status ?? err?.response?.status;

      // ── Non-retryable ──────────────────────────────────────────────────
      if (status === 400 || status === 401) {
        throw err;
      }

      // ── Rate limited ───────────────────────────────────────────────────
      if (status === 429) {
        if (attempt === MAX_RETRIES - 1) break; // exhausted

        const retryAfterMs = getRetryAfterMs(err);
        const backoff      = retryAfterMs ?? BASE_DELAY * Math.pow(2, attempt);
        const jitter       = Math.random() * 500;
        const wait         = Math.min(backoff + jitter, MAX_WAIT);

        console.warn(
          `[groqService] 429 rate limit — attempt ${attempt + 1}/${MAX_RETRIES}. ` +
          `Waiting ${Math.round(wait)}ms (retry-after header: ${retryAfterMs ?? 'none'})…`
        );
        await sleep(wait);
        continue;
      }

      // ── Transient server / network errors ─────────────────────────────
      if (status >= 500 || err?.code === 'ECONNRESET' || err?.code === 'ETIMEDOUT') {
        if (attempt === MAX_RETRIES - 1) break;

        const wait = Math.min(BASE_DELAY * Math.pow(2, attempt), MAX_WAIT);
        console.warn(`[groqService] ${status ?? err.code} — retrying in ${wait}ms…`);
        await sleep(wait);
        continue;
      }

      // ── Unknown error — don't retry ────────────────────────────────────
      throw err;
    }
  }

  console.error('[groqService] All retries exhausted:', lastErr?.message);
  throw lastErr;
}