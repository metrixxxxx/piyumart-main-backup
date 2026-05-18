import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const { password } = await req.json();
  if (!password || password.length < 6)
    return Response.json({ message: "Password too short" }, { status: 400 });

  const hashed = await bcrypt.hash(password, 10);

  await db.query("UPDATE users SET password=$1 WHERE email=$2", [
    hashed,
    session.user.email,
  ]);

  return Response.json({ message: "Password set successfully" });
}