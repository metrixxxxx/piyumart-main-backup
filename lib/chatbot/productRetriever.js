// lib/chatbot/productRetriever.js

import { db } from '@/lib/db';

export async function getRelevantProducts(intent = {}) {
  try {
    const { type = 'general', keywords = [] } = intent;

    let query, values;

    if (type !== 'general' && keywords.length > 0) {
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
        SELECT p.id, p.name, p.price, p.stock, c.name AS category,
               u.name AS seller_name
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN users u ON u.id = p.seller_id
        WHERE p.is_visible = true
          AND p.stock > 0
          AND (${categoryConditions} OR ${nameConditions})
        ORDER BY p.id DESC
        LIMIT 6
      `;
    } else {
      query = `
        SELECT p.id, p.name, p.price, p.stock, c.name AS category,
               u.name AS seller_name
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN users u ON u.id = p.seller_id
        WHERE p.is_visible = true
          AND p.stock > 0
        ORDER BY p.id DESC
        LIMIT 6
      `;
      values = [];
    }

    // Handle BOTH pg ({ rows }) and mysql2 ([rows]) driver shapes
    const result = await db.query(query, values);
    const rows = result.rows ?? result[0] ?? [];

    if (!rows || !rows.length) {
      return 'No relevant products found. Suggest browsing /products.';
    }

    return rows.map(p =>
      `- [${p.name}](/products/${p.id}) — ₱${Number(p.price).toLocaleString()} ` +
      `*(${p.category || 'Uncategorized'})* — ${p.stock} in stock — Seller: ${p.seller_name || 'Unknown'}`
    ).join('\n');

  } catch (error) {
    console.error('[productRetriever] Error:', error?.message || error);
    return 'Product data temporarily unavailable.';
  }
}