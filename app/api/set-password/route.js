import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

function validatePassword(password) {
  if (!password || password.length < 8)
    return "Password must be at least 8 characters.";
  if (!/[0-9]/.test(password))
    return "Password must include at least one number.";
  if (!/[^a-zA-Z0-9]/.test(password))
    return "Password must include at least one special character.";
  return null; // valid
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session)
    return Response.json({ message: "Unauthorized" }, { status: 401 });

  const { password } = await req.json();

  const error = validatePassword(password);
  if (error)
    return Response.json({ message: error }, { status: 400 });

  const hashed = await bcrypt.hash(password, 10);

  await db.query("UPDATE users SET password=$1 WHERE email=$2", [
    hashed,
    session.user.email,
  ]);

  return Response.json({ message: "Password set successfully" });
}