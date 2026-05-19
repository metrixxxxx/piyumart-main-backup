import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { db } from "@/lib/db";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(req.url);
    const sortBy = searchParams.get("sortBy") || "newest";
    const category = searchParams.get("category");

    // Determine sort order
    let orderByClause = "p.id DESC"; // default newest
    if (sortBy === "best_rated") {
      orderByClause = "p.average_rating DESC NULLS LAST, p.id DESC";
    } else if (sortBy === "most_sold") {
      orderByClause = "p.sold_count DESC, p.id DESC";
    } else if (sortBy === "price_low") {
      orderByClause = "p.price ASC, p.id DESC";
    } else if (sortBy === "price_high") {
      orderByClause = "p.price DESC, p.id DESC";
    }

    // Build WHERE clause
    let whereConditions = ["p.is_visible = true"];
    let params = [];

    if (session?.user?.id) {
      whereConditions.push("p.seller_id != $1");
      params.push(session.user.id);
    }

    if (category) {
      whereConditions.push(`p.category = $${params.length + 1}`);
      params.push(category);
    }

    const whereClause = whereConditions.join(" AND ");

    const [rows] = await db.query(
      `SELECT p.*, 
        COALESCE(p.average_rating, 0) as average_rating,
        COALESCE(p.total_ratings, 0) as total_ratings,
        COALESCE(p.sold_count, 0) as sold_count
       FROM products p 
       WHERE ${whereClause}
       ORDER BY ${orderByClause}`,
      params
    );

    return NextResponse.json(rows);
  } catch (err) {
    console.error("Products GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}