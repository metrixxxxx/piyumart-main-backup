// lib/chatbot/scamDetection.js

/**
 * Scam pattern list — phrases, not isolated words.
 * Each entry must be a multi-word phrase or a very specific term
 * to minimize false positives.
 *
 * ⚠️ NEVER use single generic words like 'otp', 'telegram', 'cheap'
 * as they trigger false positives on legitimate user questions.
 */
const SCAM_PATTERNS = [
  // Payment redirection
  'pay outside',
  'bayad sa labas',
  'gcash sa labas',
  'send gcash',
  'personal gcash',
  'personal paymaya',
  'bank transfer sa akin',
  'outside the app',
  'outside the platform',
  'outside piyumart',
  'pay me directly',
  'bayad directly',

  // Credential harvesting — specific phrases only
  'send your otp',
  'ipadala otp',
  'share otp',
  'give me your otp',
  'ibigay otp',
  'bank password',
  'atm password',
  'ibigay password',

  // Urgency / pressure tactics
  'rush payment',
  'send money first',
  'mag-send muna',
  'bayad muna bago',
  'today only limited',
  'mag-expire na',
  'pag hindi ka nagbayad',

  // Offsite communication — specific platform redirect requests
  'message me on facebook',
  'contact me on messenger',
  'telegram nalang',
  'whatsapp nalang',
  'discord nalang tayo',
  'facebook only',
  'no meetup',
  'no meet up',
  'no face to face',
  'hindi mag-meetup',

  // Investment / doubling scams
  'palakihin pera',
  'double your money',
  'investment opportunity',
  'guaranteed return',
  'mag-invest ka',

  // Advance-fee / deposit
  'deposit first',
  'downpayment muna',
  'reservation fee muna',
  'advance payment',
];

/**
 * detectScamSignals
 * Scans a message for scam-related phrase patterns.
 *
 * @param {string} message - sanitized user input
 * @returns {{ flagged: boolean, matches: string[] }}
 */
export function detectScamSignals(message = '') {
  if (!message || typeof message !== 'string') {
    return { flagged: false, matches: [] };
  }

  const input = message.toLowerCase();
  const matches = SCAM_PATTERNS.filter(pattern => input.includes(pattern));

  return {
    flagged: matches.length > 0,
    matches,
  };
}