/**
 * Suggestion map — each entry maps an intent type to display-ready
 * search suggestion strings. URLs use category slugs; update these
 * to match your actual DB category names or route structure.
 */
const SUGGESTION_MAP = {
  electronics: {
    links: [
      '/products?category=electronics',
      '/products?search=laptop',
      '/products?search=tablet',
      '/products?search=charger',
    ],
  },
  books: {
    links: [
      '/products?category=books',
      '/products?search=textbook',
      '/products?search=reviewer',
      '/products?search=module',
    ],
  },
  'school supplies': {
    links: [
      '/products?category=school+supplies',
      '/products?search=calculator',
      '/products?search=ballpen',
      '/products?search=notebook',
    ],
  },
  fashion: {
    links: [
      '/products?category=fashion',
      '/products?search=uniform',
      '/products?search=backpack',
      '/products?search=shoes',
    ],
  },
  furniture: {
    links: [
      '/products?category=furniture',
      '/products?search=study+table',
      '/products?search=chair',
      '/products?search=desk+lamp',
    ],
  },
  general: {
    links: [
      '/products',
      '/products?category=electronics',
      '/products?category=books',
    ],
  },
};

/**
 * generateSearchSuggestions
 * Returns a formatted search suggestion string for injection into the system prompt.
 * Accepts either a raw message string or a pre-computed intent type string.
 *
 * @param {string} message - the sanitized user message
 * @param {string} [intentType] - optional: pass intent.type directly to avoid re-parsing
 * @returns {string}
 */
export function generateSearchSuggestions(message = '', intentType = null) {
  // If an intent type is passed directly, use it. Otherwise derive from message.
  let type = intentType;

  if (!type) {
    const input = message.toLowerCase();

    if (
      input.includes('laptop') || input.includes('computer') || input.includes('pc') ||
      input.includes('tablet') || input.includes('phone') || input.includes('telepono') ||
      input.includes('headset') || input.includes('camera') || input.includes('charger') ||
      input.includes('gadget') || input.includes('electronic') || input.includes('programming')
    ) {
      type = 'electronics';
    } else if (
      input.includes('book') || input.includes('textbook') || input.includes('reviewer') ||
      input.includes('module') || input.includes('libro') || input.includes('aklat') ||
      input.includes('notes') || input.includes('reading')
    ) {
      type = 'books';
    } else if (
      input.includes('calculator') || input.includes('casio') || input.includes('pen') ||
      input.includes('ballpen') || input.includes('highlighter') || input.includes('supplies') ||
      input.includes('folder') || input.includes('binder') || input.includes('papel')
    ) {
      type = 'school supplies';
    } else if (
      input.includes('shirt') || input.includes('clothes') || input.includes('uniform') ||
      input.includes('damit') || input.includes('bag') || input.includes('backpack') ||
      input.includes('shoes') || input.includes('fashion') || input.includes('polo')
    ) {
      type = 'fashion';
    } else if (
      input.includes('chair') || input.includes('table') || input.includes('desk') ||
      input.includes('furniture') || input.includes('upuan') || input.includes('mesa')
    ) {
      type = 'furniture';
    } else {
      type = 'general';
    }
  }

  const suggestion = SUGGESTION_MAP[type] || SUGGESTION_MAP.general;

  return suggestion.links.map(l => `- ${l}`).join('\n');
}