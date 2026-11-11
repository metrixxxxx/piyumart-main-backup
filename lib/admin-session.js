import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;
const ADMIN_SESSION_MAX_AGE_MS = ADMIN_SESSION_MAX_AGE_SECONDS * 1000;
const ADMIN_SESSION_COOKIE = "admin_session";
const ADMIN_SESSION_SIGNATURE_COOKIE = "admin_session_signature";

function getSignature(value) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for admin sessions.");
  return createHmac("sha256", secret).update(value).digest("hex");
}

export async function setAdminSession(admin) {
  if (
    admin.role !== "admin" ||
    admin.status !== "active" ||
    admin.is_verified !== true
  ) {
    throw new Error("Only active, verified admins can start an admin session.");
  }

  const value = JSON.stringify({
    id: Number(admin.id),
    name: admin.name,
    email: admin.email,
    role: "admin",
    issuedAt: Date.now(),
  });
  const signature = getSignature(value);
  const cookieStore = await cookies();
  const options = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  };

  cookieStore.set(ADMIN_SESSION_COOKIE, value, options);
  cookieStore.set(ADMIN_SESSION_SIGNATURE_COOKIE, signature, options);
}

export async function getAdminAccess() {
  const cookieStore = await cookies();
  const value = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const signature = cookieStore.get(ADMIN_SESSION_SIGNATURE_COOKIE)?.value;
  if (!value || !signature || !/^[a-f0-9]{64}$/i.test(signature)) {
    return { admin: null, status: 401 };
  }

  const expected = Buffer.from(getSignature(value), "hex");
  const actual = Buffer.from(signature, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return { admin: null, status: 401 };
  }

  let session;
  try {
    session = JSON.parse(value);
  } catch {
    return { admin: null, status: 401 };
  }

  const now = Date.now();
  if (
    !session ||
    session.role !== "admin" ||
    !Number.isSafeInteger(session.id) ||
    session.id < 1 ||
    !Number.isSafeInteger(session.issuedAt) ||
    session.issuedAt > now + 30_000 ||
    now - session.issuedAt > ADMIN_SESSION_MAX_AGE_MS
  ) {
    return { admin: null, status: 401 };
  }

  const [rows] = await db.query(
    `SELECT id, name, email, role, status, is_verified
     FROM users
     WHERE id = $1`,
    [session.id]
  );
  const admin = rows[0];
  if (
    !admin ||
    admin.role !== "admin" ||
    admin.status !== "active" ||
    admin.is_verified !== true
  ) {
    return { admin: null, status: 403 };
  }

  return { admin, status: 200 };
}
