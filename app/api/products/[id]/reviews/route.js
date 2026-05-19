// app/api/products/[id]/reviews/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { db } from "@/lib/db";

// GET /api/products/[id]/reviews - Get all reviews for a product
export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const { sortBy = "recent" } = Object.fromEntries(new URL(req.url).searchParams);

    let sortOrder = "pr.created_at DESC";
    if (sortBy === "highest_rated") sortOrder = "pr.rating DESC, pr.created_at DESC";
    if (sortBy === "lowest_rated") sortOrder = "pr.rating ASC, pr.created_at DESC";

    let reviews = [];
    let productStats = { total_reviews: 0, average_rating: null };

    try {
      const [reviewResults] = await db.query(
        `SELECT 
          pr.id, 
          pr.rating, 
          pr.comment, 
          pr.created_at,
          u.name as user_name,
          u.avatar as user_avatar
        FROM product_reviews pr
        JOIN users u ON pr.user_id = u.id
        WHERE pr.product_id = $1
        ORDER BY ${sortOrder}`,
        [id]
      );
      reviews = reviewResults || [];
    } catch (dbErr) {
      // Table might not exist yet - return empty reviews gracefully
      console.warn("product_reviews table might not exist:", dbErr.message);
      reviews = [];
    }

    try {
      const [statsResults] = await db.query(
        `SELECT 
          COUNT(*) as total_reviews,
          AVG(rating) as average_rating
        FROM product_reviews
        WHERE product_id = $1`,
        [id]
      );
      productStats = statsResults[0] || { total_reviews: 0, average_rating: null };
    } catch (dbErr) {
      // Table might not exist yet
      console.warn("product_reviews table might not exist:", dbErr.message);
      productStats = { total_reviews: 0, average_rating: null };
    }

    return NextResponse.json({
      reviews,
      stats: productStats,
    });
  } catch (err) {
    console.error("GET reviews error:", err.message);
    return NextResponse.json({
      reviews: [],
      stats: { total_reviews: 0, average_rating: null },
    }, { status: 200 });
  }
}

// POST /api/products/[id]/reviews - Add a review
export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { rating, comment } = await req.json();

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 }
      );
    }

    // Check if user has purchased this product
    const [purchaseCheck] = await db.query(
      `SELECT oi.id 
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.user_id = $1 AND oi.product_id = $2 AND o.status = 'completed'
       LIMIT 1`,
      [session.user.id, id]
    );

    if (purchaseCheck.length === 0) {
      return NextResponse.json(
        { error: "You can only review products you have purchased" },
        { status: 403 }
      );
    }

    // Check if product exists
    const [productCheck] = await db.query(
      `SELECT id FROM products WHERE id = $1`,
      [id]
    );
    if (productCheck.length === 0) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Insert or update review (upsert)
    const [result] = await db.query(
      `INSERT INTO product_reviews (product_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (product_id, user_id) 
       DO UPDATE SET rating = $3, comment = $4, updated_at = CURRENT_TIMESTAMP
       RETURNING id, rating, comment, created_at`,
      [id, session.user.id, rating, comment || null]
    );

    // Update product average rating and total ratings
    const [stats] = await db.query(
      `SELECT 
        COUNT(*) as total_ratings,
        AVG(rating) as average_rating
       FROM product_reviews
       WHERE product_id = $1`,
      [id]
    );

    await db.query(
      `UPDATE products 
       SET average_rating = $1, total_ratings = $2
       WHERE id = $3`,
      [
        stats[0].average_rating ? Math.round(stats[0].average_rating * 100) / 100 : null,
        stats[0].total_ratings,
        id,
      ]
    );

    return NextResponse.json({
      success: true,
      review: result[0],
      stats: stats[0],
    });
  } catch (err) {
    console.error("POST review error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/products/[id]/reviews - Delete user's review
export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const [result] = await db.query(
      `DELETE FROM product_reviews 
       WHERE product_id = $1 AND user_id = $2
       RETURNING id`,
      [id, session.user.id]
    );

    if (result.length === 0) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // Update product average rating and total ratings
    const [stats] = await db.query(
      `SELECT 
        COUNT(*) as total_ratings,
        AVG(rating) as average_rating
       FROM product_reviews
       WHERE product_id = $1`,
      [id]
    );

    await db.query(
      `UPDATE products 
       SET average_rating = $1, total_ratings = $2
       WHERE id = $3`,
      [
        stats[0].total_ratings > 0 ? Math.round(stats[0].average_rating * 100) / 100 : null,
        stats[0].total_ratings,
        id,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE review error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
