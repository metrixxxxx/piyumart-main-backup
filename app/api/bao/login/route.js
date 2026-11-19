import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { setBaoSession } from "@/lib/bao-session";

export async function POST(req) {
  try {
    const { email, password } = await req.json();
    if (typeof email !== "string" || typeof password !== "string") {
      return Response.json({ error: "Invalid credentials." }, { status: 400 });
    }

    const [rows] = await db.query(
      `SELECT id, name, email, password, role, status
       FROM users
       WHERE LOWER(email) = $1`,
      [email.trim().toLowerCase()]
    );
    const user = rows[0];
    if (!user || typeof user.password !== "string" || !(await bcrypt.compare(password, user.password))) {
      return Response.json({ error: "Invalid email or password." }, { status: 401 });
    }
    if (user.role !== "bao" || user.status !== "active") {
      return Response.json({ error: "An active BAO account is required." }, { status: 403 });
    }

    await setBaoSession(user);
    return Response.json({ success: true });
  } catch (error) {
    console.error("BAO login failed:", error);
    return Response.json({ error: "Unable to sign in. Please try again." }, { status: 500 });
  }
}
