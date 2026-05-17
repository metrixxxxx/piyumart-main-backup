import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    const [rows] = await db.query(
      "SELECT * FROM users WHERE email = $1", [email]
    );

    if (rows.length === 0) {
      return Response.json({ error: "User not found" }, { status: 401 });
    }

    const user = rows[0];

    if (user.role !== "admin") {
      return Response.json({ error: "Access denied — not an admin" }, { status: 403 });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return Response.json({ error: "Wrong password" }, { status: 401 });
    }

    const cookieStore = await cookies();
    cookieStore.set("admin_session", JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    }), {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    return Response.json({ success: true });
  } catch (err) {
    console.error("Admin login error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}