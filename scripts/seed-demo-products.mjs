import pg from "pg";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { Pool } = pg;
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(projectRoot, ".env.local"), quiet: true });

const products = [
  { name: "Calculus: Early Transcendentals, 8th Ed.", description: "Used for one semester. Clean pages with light cover wear; no missing pages.", price: 850, stock: 1, category: "Books", image: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=640&q=80" },
  { name: "Casio fx-991ES Plus Scientific Calculator", description: "Fully working, with hard case and fresh battery. Small scratches on the back.", price: 650, stock: 1, category: "Electronics", image: "https://images.unsplash.com/photo-1587145820266-a5951ee6f620?auto=format&fit=crop&w=640&q=80" },
  { name: "Heather Gray Campus Hoodie, Size M", description: "Pre-loved and freshly washed. Soft fleece lining; fits true to size.", price: 450, stock: 1, category: "Clothing", image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=640&q=80" },
  { name: "Chicken Teriyaki Bento", description: "Grilled chicken, rice, and vegetables. Prepared fresh for lunchtime pickup.", price: 125, stock: 7, category: "Food & Drinks", image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=640&q=80" },
  { name: "Yonex Badminton Racket with Cover", description: "Lightweight beginner racket in good condition. Grip recently replaced.", price: 550, stock: 1, category: "Sports", image: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=640&q=80" },
  { name: "LED Study Lamp with USB Port", description: "Three brightness levels and flexible neck. Works perfectly; includes USB cable.", price: 275, stock: 1, category: "Home & Living", image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=640&q=80" },
  { name: "Natural Canvas Book Tote", description: "Roomy, sturdy tote with reinforced handles. Lightly used and freshly cleaned.", price: 180, stock: 1, category: "Clothing", image: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=640&q=80" },
  { name: "Wireless Earbuds with Charging Case", description: "Bluetooth earbuds with charging case and extra silicone tips. Tested and working.", price: 790, stock: 1, category: "Electronics", image: "https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?auto=format&fit=crop&w=640&q=80" },
  { name: "Biology Reviewer: Cell Biology", description: "Neatly organized reviewer with diagrams and chapter summaries. Printed and bound.", price: 120, stock: 1, category: "Books", image: "https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&w=640&q=80" },
  { name: "Fresh Mango Graham Shake, 16 oz", description: "Made to order with ripe mango and chilled milk. Best enjoyed the same day.", price: 75, stock: 6, category: "Food & Drinks", image: "https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=640&q=80" },
  { name: "Molten Volleyball, Size 5", description: "Good grip with no air leaks. Used for a few PE classes; still in great shape.", price: 390, stock: 1, category: "Sports", image: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=640&q=80" },
  { name: "Potted Mini Succulent", description: "Easy-care live succulent in a small ceramic pot. Great for a desk or windowsill.", price: 110, stock: 4, category: "Home & Living", image: "https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=640&q=80" },
  { name: "Compact Folding Pocket Mirror", description: "Clean, scratch-free double-sided mirror with a slim case that fits in a pouch.", price: 85, stock: 1, category: "Beauty", image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=640&q=80" },
  { name: "A5 Grid Notebook, 3-Pack", description: "Three barely used notebooks with squared pages. No writing or torn sheets.", price: 90, stock: 3, category: "Books", image: "https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=640&q=80" },
  { name: "Bamboo Desk Organizer", description: "Keeps pens, sticky notes, and clips in one place. A few light surface marks.", price: 150, stock: 1, category: "Home & Living", image: "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=640&q=80" },
  { name: "Chicken Rice Bowl with Garlic Sauce", description: "Grilled chicken over steamed rice with vegetables and house-made garlic sauce.", price: 110, stock: 9, category: "Food & Drinks", image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=640&q=80" },
  { name: "Nike Revolution Running Shoes, Size 8", description: "Pre-loved pair with clean insoles and plenty of tread left. No tears or loose seams.", price: 850, stock: 1, category: "Clothing", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=640&q=80" },
  { name: "Braided USB-C Charging Cable, 1 m", description: "Fast-charging cable with a braided outer layer. Tested with Android phones and tablets.", price: 130, stock: 2, category: "Electronics", image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=640&q=80" },
  { name: "Medical Terminology Flashcards", description: "Color-coded study cards with clear notes. Complete set in a reusable storage box.", price: 90, stock: 1, category: "Books", image: "https://images.unsplash.com/photo-1456324504439-367cee3b3c32?auto=format&fit=crop&w=640&q=80" },
  { name: "Stainless Steel Insulated Tumbler, 500 ml", description: "Double-wall tumbler with a leak-resistant lid. Keeps drinks cold; no dents.", price: 260, stock: 1, category: "Home & Living", image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=640&q=80" },
];

function getArgs(args) {
  const sellerIndex = args.indexOf("--seller-id");
  const sellerId = sellerIndex >= 0 ? args[sellerIndex + 1] : null;
  if (args.includes("--help")) {
    console.log("Usage: npm run seed:demo -- --seller-id <existing-user-id> [--apply] [--publish]");
    console.log("Without --apply, the script only previews what it would do.");
    console.log("--publish makes newly seeded listings visible in the storefront.");
    process.exit(0);
  }
  if (!sellerId || !/^\d+$/.test(sellerId)) {
    throw new Error("Pass an existing numeric user ID with --seller-id <id>. Use --help for usage.");
  }
  if (args.includes("--publish") && !args.includes("--apply")) {
    throw new Error("--publish requires --apply.");
  }
  return {
    sellerId,
    apply: args.includes("--apply"),
    publish: args.includes("--publish"),
  };
}

async function main() {
  const options = getArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. Set it in .env.local or the current environment.");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  let client;

  try {
    client = await pool.connect();
    const sellerResult = await client.query(
      "SELECT id, name, role FROM users WHERE id = $1",
      [options.sellerId]
    );
    const seller = sellerResult.rows[0];
    if (!seller) {
      throw new Error(`No user found with ID ${options.sellerId}. No products were added.`);
    }
    if (String(seller.role).toLowerCase() === "admin") {
      throw new Error("Choose a non-admin seller account for the sample listings.");
    }

    const categoryResult = await client.query("SELECT id, name FROM categories");
    const categoryIds = new Map(
      categoryResult.rows.map((category) => [category.name.toLowerCase(), category.id])
    );
    const missingCategories = [...new Set(products.map((product) => product.category))]
      .filter((name) => !categoryIds.has(name.toLowerCase()));
    if (missingCategories.length) {
      throw new Error(`Missing categories in the database: ${missingCategories.join(", ")}. No products were added.`);
    }

    console.log(`Seller: ${seller.name} (user ${seller.id})`);
    console.log(`Mode: ${options.apply ? (options.publish ? "publish visible listings" : "insert hidden listings") : "preview only"}`);

    if (options.apply) await client.query("BEGIN");
    try {
      let inserted = 0;
      let existing = 0;

      for (const product of products) {
        const description = `[DEMO SAMPLE] ${product.description}`;
        const categoryId = categoryIds.get(product.category.toLowerCase());
        const existingResult = await client.query(
          "SELECT id FROM products WHERE seller_id = $1 AND name = $2 AND description = $3 LIMIT 1",
          [seller.id, product.name, description]
        );

        if (existingResult.rowCount > 0) {
          existing += 1;
          if (options.apply && options.publish) {
            await client.query(
              "UPDATE products SET is_visible = true, status = 'approved' WHERE id = $1",
              [existingResult.rows[0].id]
            );
          }
          continue;
        }

        if (options.apply) {
          await client.query(
            `INSERT INTO products
              (name, description, price, image_url, seller_id, seller_name, category_id,
               stock, is_visible, is_featured, status, sold_count, average_rating, total_ratings)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, 'approved', 0, NULL, 0)`,
            [
              product.name,
              description,
              product.price,
              product.image,
              seller.id,
              seller.name,
              categoryId,
              product.stock,
              options.publish,
            ]
          );
        }
        inserted += 1;
      }

      if (options.apply) await client.query("COMMIT");
      console.log(`${options.apply ? "Inserted" : "Would insert"}: ${inserted}`);
      console.log(`Already present: ${existing}`);
      if (!options.apply) {
        console.log("Preview only; add --apply to write. Add --publish as well to show listings on the storefront.");
      } else if (!options.publish) {
        console.log("Listings were inserted as hidden. Rerun with --apply --publish to make them visible.");
      }
    } catch (error) {
      if (options.apply) await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Demo product seed failed: ${error.message}`);
  process.exitCode = 1;
});
