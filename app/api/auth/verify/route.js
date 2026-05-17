import { db } from "@/lib/db";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) return Response.redirect(new URL("/login?error=invalid_token", req.url));

  const [users] = await db.query(
    `SELECT * FROM users WHERE verification_token=$1`, [token]
  );

  if (users.length === 0) return Response.redirect(new URL("/login?error=token_not_found", req.url));

  const user = users[0];

  if (user.status === "active") return Response.redirect(new URL("/login?verified=already", req.url));

  if (new Date() > new Date(user.token_expires_at)) {
    return Response.redirect(new URL("/login?error=token_expired", req.url));
  }

  await db.query(
    `UPDATE users SET status='active', verification_token=NULL, token_expires_at=NULL WHERE id=$1`,
    [user.id]
  );

  return Response.redirect(new URL("/login?verified=true", req.url));
}