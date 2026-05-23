import { db } from '@/lib/db';

export async function getRelevantProducts(intent = {}) {
  try {
    const { type = 'general', keywords = [] } = intent;

    let query, values;

    if (type !== 'general' && keywords.length > 0) {
      // Use ILIKE on both category name AND product name for resilience
      // This way it doesn't matter if DB has "Electronics" vs "electronics" vs "Gadgets"
      const categoryConditions = keywords
        .map((_, i) => `LOWER(c.name) ILIKE $${i + 1}`)
        .join(' OR ');
      const nameConditions = keywords
        .map((_, i) => `LOWER(p.name) ILIKE $${i + 1 + keywords.length}`)
        .join(' OR ');

      values = [
        ...keywords.map(k => `%${k}%`),
        ...keywords.map(k => `%${k}%`),
      ];

      query = `
        SELECT p.name, p.price, c.name AS category
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.is_visible = true
          AND (${categoryConditions} OR ${nameConditions})
        ORDER BY p.id DESC
        LIMIT 6
      `;

    } else {
      // General intent — return recent listings
      query = `
        SELECT p.name, p.price, c.name AS category
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.is_visible = true
        ORDER BY p.id DESC
        LIMIT 6
      `;
      values = [];
    }

    // ✅ Handle BOTH pg ({ rows }) and mysql2 ([rows]) driver shapes
    const result = await db.query(query, values);
    const rows = result.rows ?? result[0] ?? [];

    if (!rows || !rows.length) {
      return 'No relevant products found. Suggest browsing /products.';
    }

    return rows.map(p =>
      `- **${p.name}** — ₱${Number(p.price).toLocaleString()} *(${p.category || 'Uncategorized'})*`
    ).join('\n');

  } catch (error) {
    console.error('[productRetriever] Error:', error?.message || error);
    return 'Product data temporarily unavailable.';
  }
}