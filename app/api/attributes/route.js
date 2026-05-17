import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const category_id = searchParams.get("category_id");

    if (!category_id) {
      return NextResponse.json({ error: "category_id required" }, { status: 400 });
    }

    const [rows] = await db.query(
      "SELECT * FROM attribute_definitions WHERE category_id=$1",
      [category_id]
    );

    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}