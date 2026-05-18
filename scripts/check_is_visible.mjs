import { db } from '../lib/db.js';

(async () => {
  try {
    const [rows] = await db.query('SELECT id, seller_id, is_visible FROM products ORDER BY id DESC LIMIT 50');
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('ERROR', err.message || err);
    process.exit(1);
  }
})();
