import { getAdminAccess } from "@/lib/admin-session";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const access = await getAdminAccess();
  if (!access.admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: access.status });
  }

  try {
    const [[{ totalUsers }]]      = await db.query(`SELECT COUNT(*) AS totalUsers FROM users WHERE role != 'admin'`);
    const [[{ totalSellers }]]    = await db.query(`SELECT COUNT(*) AS totalSellers FROM users WHERE role = 'seller' AND status = 'active'`);
    const [[{ pendingSellers }]]  = await db.query(`SELECT COUNT(*) AS pendingSellers FROM users WHERE role = 'seller' AND status = 'pending'`);
    const [[{ totalProducts }]]   = await db.query(`SELECT COUNT(*) AS totalProducts FROM products WHERE status = 'approved'`);
    const [[{ pendingProducts }]] = await db.query(`SELECT COUNT(*) AS pendingProducts FROM products WHERE status = 'pending'`);
    const [[{ totalOrders }]]     = await db.query(`SELECT COUNT(*) AS totalOrders FROM orders`);
    const [[{ totalRevenue }]]    = await db.query(`SELECT SUM(total) AS totalRevenue FROM orders WHERE status = 'delivered'`);

    return NextResponse.json({
      totalUsers,
      totalSellers,
      pendingSellers,
      totalProducts,
      pendingProducts,
      totalOrders,
      totalRevenue: totalRevenue || 0,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function toggleFeatured(id) {
  await fetch("/api/products/feature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });

  // refresh page or re-fetch products
  window.location.reload();
}