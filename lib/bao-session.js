import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const BAO_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;
const BAO_SESSION_MAX_AGE_MS = BAO_SESSION_MAX_AGE_SECONDS * 1000;
const BAO_SESSION_COOKIE = "bao_session";
const BAO_SESSION_SIGNATURE_COOKIE = "bao_session_signature";

function getSignature(value) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for BAO sessions.");
  return createHmac("sha256", secret).update(value).digest("hex");
}

export async function setBaoSession(bao) {
  const id = Number(bao.id);
  if (bao.role !== "bao" || bao.status !== "active" || !Number.isSafeInteger(id) || id < 1) {
    throw new Error("Only active BAO accounts can start a BAO session.");
  }

  const value = JSON.stringify({ id, role: "bao", issuedAt: Date.now() });
  const signature = getSignature(value);
  const cookieStore = await cookies();
  const options = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: BAO_SESSION_MAX_AGE_SECONDS,
  };

  cookieStore.set(BAO_SESSION_COOKIE, value, options);
  cookieStore.set(BAO_SESSION_SIGNATURE_COOKIE, signature, options);
}

export async function getBaoSession() {
  const cookieStore = await cookies();
  const value = cookieStore.get(BAO_SESSION_COOKIE)?.value;
  const signature = cookieStore.get(BAO_SESSION_SIGNATURE_COOKIE)?.value;
  if (!value || !signature || !/^[a-f0-9]{64}$/i.test(signature)) {
    return { session: null, status: 401 };
  }

  const expected = Buffer.from(getSignature(value), "hex");
  const actual = Buffer.from(signature, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return { session: null, status: 401 };
  }

  let token;
  try {
    token = JSON.parse(value);
  } catch {
    return { session: null, status: 401 };
  }

  const now = Date.now();
  if (
    !token ||
    token.role !== "bao" ||
    !Number.isSafeInteger(token.id) ||
    token.id < 1 ||
    !Number.isSafeInteger(token.issuedAt) ||
    token.issuedAt > now + 30_000 ||
    now - token.issuedAt > BAO_SESSION_MAX_AGE_MS
  ) {
    return { session: null, status: 401 };
  }

  const [rows] = await db.query(
    `SELECT id, name, email, role, status
     FROM users
     WHERE id = $1`,
    [token.id]
  );
  const bao = rows[0];
  if (!bao || bao.role !== "bao" || bao.status !== "active") {
    return { session: null, status: 403 };
  }

  return {
    session: {
      user: {
        id: bao.id,
        name: bao.name,
        email: bao.email,
        role: "bao",
      },
    },
    status: 200,
  };
}

export async function clearBaoSession() {
  const cookieStore = await cookies();
  cookieStore.delete(BAO_SESSION_COOKIE);
  cookieStore.delete(BAO_SESSION_SIGNATURE_COOKIE);
}
