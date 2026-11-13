import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { setAdminSession } from "@/lib/admin-session";
import { setBaoSession } from "@/lib/bao-session";

export async function POST(req) {
  try {
    const { email, password } = await req.json();
    if (typeof email !== "string" || typeof password !== "string") {
      return Response.json({ error: "Invalid credentials" }, { status: 400 });
    }

    const [rows] = await db.query(
      "SELECT id, name, email, password, role, status, is_verified FROM users WHERE LOWER(email) = $1",
      [email.trim().toLowerCase()]
    );

    if (rows.length === 0) {
      return Response.json({ error: "User not found" }, { status: 401 });
    }

    const user = rows[0];
    if (typeof user.password !== "string") {
      return Response.json({ error: "Wrong password" }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return Response.json({ error: "Wrong password" }, { status: 401 });
    }

    if (user.role === "bao") {
      if (user.status !== "active") {
        return Response.json(
          { error: "BAO access requires an active account." },
          { status: 403 }
        );
      }

      await setBaoSession(user);
      return Response.json({ success: true, role: "bao" });
    }

    if (user.role !== "admin") {
      return Response.json(
        { error: "Access denied — not an admin" },
        { status: 403 }
      );
    }
    if (user.status !== "active" || user.is_verified !== true) {
      return Response.json(
        { error: "Admin access requires an active, verified account." },
        { status: 403 }
      );
    }

    await setAdminSession(user);

    return Response.json({ success: true, role: "admin" });
  } catch (err) {
    console.error("Admin login error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}