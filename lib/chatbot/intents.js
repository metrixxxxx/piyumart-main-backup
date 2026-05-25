/**
 * detectMarketplaceIntent
 * Parses a user message and returns a structured intent object
 * used by productRetriever and searchSuggestions.
 *
 * Supports English, Filipino, and Taglish.
 *
 * @param {string} message
 * @returns {{ type: string, keywords: string[] }}
 */
export function detectMarketplaceIntent(message = '') {
  const input = message.toLowerCase();

  // ── Electronics / Gadgets ─────────────────────────────────────
  if (
    input.includes('laptop') ||
    input.includes('computer') ||
    input.includes('pc') ||
    input.includes('programming') ||
    input.includes('tablet') ||
    input.includes('ipad') ||
    input.includes('monitor') ||
    input.includes('keyboard') ||
    input.includes('mouse') ||
    input.includes('usb') ||
    input.includes('charger') ||
    input.includes('gadget') ||
    input.includes('electronic')
  ) {
    return {
      type: 'electronics',
      keywords: ['laptop', 'computer', 'tablet', 'gadget', 'electronic'],
    };
  }

  // ── Phones / Mobile ───────────────────────────────────────────
  if (
    input.includes('phone') ||
    input.includes('iphone') ||
    input.includes('android') ||
    input.includes('samsung') ||
    input.includes('cellphone') ||
    input.includes('telepono') ||
    input.includes('mobile') ||
    input.includes('smartphone') ||
    input.includes('power bank') ||
    input.includes('powerbank')
  ) {
    return {
      type: 'electronics',
      keywords: ['phone', 'smartphone', 'mobile', 'cellphone'],
    };
  }

  // ── Books / Academic ──────────────────────────────────────────
  if (
    input.includes('book') ||
    input.includes('textbook') ||
    input.includes('reviewer') ||
    input.includes('module') ||
    input.includes('notes') ||
    input.includes('libro') ||        // Filipino
    input.includes('aklat') ||        // Filipino
    input.includes('notebook') ||
    input.includes('reading')
  ) {
    return {
      type: 'books',
      keywords: ['book', 'textbook', 'reviewer', 'notebook', 'module'],
    };
  }

  // ── School Supplies ───────────────────────────────────────────
  if (
    input.includes('calculator') ||
    input.includes('casio') ||
    input.includes('pen') ||
    input.includes('pencil') ||
    input.includes('school supply') ||
    input.includes('supplies') ||
    input.includes('papel') ||         // Filipino
    input.includes('ballpen') ||
    input.includes('highlighter') ||
    input.includes('folder') ||
    input.includes('binder')
  ) {
    return {
      type: 'school supplies',
      keywords: ['calculator', 'pen', 'school supply', 'supplies'],
    };
  }

  // ── Fashion / Clothing ────────────────────────────────────────
  if (
    input.includes('shirt') ||
    input.includes('clothes') ||
    input.includes('damit') ||         // Filipino
    input.includes('uniform') ||
    input.includes('polo') ||
    input.includes('pants') ||
    input.includes('shoes') ||
    input.includes('fashion') ||
    input.includes('bag') ||
    input.includes('backpack') ||
    input.includes('lspu uniform')
  ) {
    return {
      type: 'fashion',
      keywords: ['shirt', 'clothes', 'uniform', 'fashion', 'bag'],
    };
  }

  // ── Audio / Accessories ───────────────────────────────────────
  if (
    input.includes('headset') ||
    input.includes('headphone') ||
    input.includes('earphone') ||
    input.includes('speaker') ||
    input.includes('microphone') ||
    input.includes('earbuds') ||
    input.includes('audio')
  ) {
    return {
      type: 'electronics',
      keywords: ['headset', 'earphone', 'headphone', 'speaker', 'audio'],
    };
  }

  // ── Furniture / Room ──────────────────────────────────────────
  if (
    input.includes('chair') ||
    input.includes('table') ||
    input.includes('desk') ||
    input.includes('furniture') ||
    input.includes('lamp') ||
    input.includes('shelf') ||
    input.includes('upuan') ||         // Filipino
    input.includes('mesa')             // Filipino
  ) {
    return {
      type: 'furniture',
      keywords: ['chair', 'table', 'desk', 'furniture'],
    };
  }

  // ── Camera / Photography ──────────────────────────────────────
  if (
    input.includes('camera') ||
    input.includes('dslr') ||
    input.includes('tripod') ||
    input.includes('lens') ||
    input.includes('vlog') ||
    input.includes('photo')
  ) {
    return {
      type: 'electronics',
      keywords: ['camera', 'dslr', 'tripod', 'lens'],
    };
  }

  // ── General / Unknown ─────────────────────────────────────────
  return {
    type: 'general',
    keywords: [],
  };
}