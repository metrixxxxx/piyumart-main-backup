import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/admin-session";
import { db } from "@/lib/db";

const USER_ID_PATTERN = /^\d+$/;
const BAO_EMAIL_DOMAIN = "@lspu.edu.ph";

export async function PATCH(req, { params }) {
  try {
    const access = await getAdminAccess();
    if (!access.admin) {
      return NextResponse.json(
        { error: access.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: access.status }
      );
    }

    const { id } = await params;
    if (!USER_ID_PATTERN.test(id || "")) {
      return NextResponse.json({ error: "Invalid user ID." }, { status: 400 });
    }
    const userId = Number(id);
    if (!Number.isSafeInteger(userId) || userId < 1) {
      return NextResponse.json({ error: "Invalid user ID." }, { status: 400 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid BAO account action." }, { status: 400 });
    }
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      !["assign", "revoke"].includes(body.action)
    ) {
      return NextResponse.json({ error: "Invalid BAO account action." }, { status: 400 });
    }

    const result = await db.transaction(async (client) => {
      const { rows: actors } = await client.query(
        `SELECT id
         FROM users
         WHERE id = $1 AND role = 'admin' AND status = 'active'
           AND is_verified IS TRUE
         FOR SHARE`,
        [access.admin.id]
      );
      if (!actors[0]) {
        return { error: "Forbidden", status: 403 };
      }

      const { rows } = await client.query(
        `SELECT id, name, last_name, email, role, status, is_verified
         FROM users
         WHERE id = $1
         FOR UPDATE`,
        [userId]
      );
      const target = rows[0];
      if (!target) {
        return { error: "User not found.", status: 404 };
      }

      let action;
      let nextRole;
      if (body.action === "assign") {
        if (target.role === "admin") {
          return { error: "Admin accounts cannot be assigned the BAO role.", status: 400 };
        }
        if (target.role !== "user") {
          return {
            error: "Only regular user accounts can be assigned the BAO role.",
            status: 400,
          };
        }
        if (target.status !== "active") {
          return {
            error: "Only already-active accounts are eligible. Account status was not changed.",
            status: 400,
          };
        }
        if (target.is_verified !== true) {
          return {
            error: "The account must complete email verification before BAO access can be granted.",
            status: 400,
          };
        }
        if (!target.email?.toLowerCase().endsWith(BAO_EMAIL_DOMAIN)) {
          return {
            error: "BAO accounts must use an LSPU email supported by the existing login.",
            status: 400,
          };
        }

        action = "bao_access_granted";
        nextRole = "bao";
      } else {
        if (target.role !== "bao") {
          return { error: "This account does not currently have BAO access.", status: 409 };
        }
        action = "bao_access_revoked";
        nextRole = "user";
      }

      const { rows: updatedRows } = await client.query(
        `UPDATE users
         SET role = $2
         WHERE id = $1
         RETURNING id, name, last_name, email, role, status, is_verified`,
        [userId, nextRole]
      );
      await client.query(
        `INSERT INTO bao_audit_logs
           (actor_id, action, entity_type, entity_id, reason, metadata)
         VALUES (
           $1, $2, 'user', $3, NULL,
           jsonb_build_object(
             'previous_role', $4::text,
             'new_role', $5::text,
             'status', $6::text,
             'is_verified', $7::boolean
           )
         )`,
        [
          access.admin.id,
          action,
          String(userId),
          target.role,
          nextRole,
          target.status,
          target.is_verified,
        ]
      );

      return { user: updatedRows[0] };
    });

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({ success: true, user: result.user });
  } catch (error) {
    console.error("Admin BAO account update failed:", error);
    return NextResponse.json(
      { error: "Unable to update BAO access." },
      { status: 500 }
    );
  }
}
