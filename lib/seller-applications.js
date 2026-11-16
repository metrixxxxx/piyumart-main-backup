import "server-only";

import { db } from "@/lib/db";
import { createNotificationRecord, broadcastNotification } from "@/lib/notify";

export function applicationError(message, status) {
  return Object.assign(new Error(message), { status });
}

export async function reviewSellerApplication({ id, actorId, action, reason }) {
  if (!["approve", "reject"].includes(action)) throw applicationError("Invalid action.", 400);
  reason = typeof reason === "string" ? reason.trim() : "";
  if ((action === "reject" && !reason) || reason.length > 1000) throw applicationError("Provide a rejection reason of up to 1,000 characters.", 400);
  const result = await db.transaction(async (client) => {
    // Recheck the reviewer's current role inside the same transaction.
    const { rows: actors } = await client.query(
      "SELECT role, status FROM users WHERE id = $1 FOR SHARE", [actorId]
    );
    if (!["bao", "admin"].includes(actors[0]?.role) || actors[0]?.status !== "active") {
      throw applicationError("Forbidden", 403);
    }
    const { rows } = await client.query(
      "SELECT id, user_id, department, status FROM seller_applications WHERE id = $1 FOR UPDATE", [id]
    );
    const application = rows[0];
    if (!application) throw applicationError("Application not found.", 404);
    if (application.status !== "pending") throw applicationError("This application has already been reviewed.", 409);
    const { rows: applicants } = await client.query(
      "SELECT role, status FROM users WHERE id = $1 FOR UPDATE", [application.user_id]
    );
    if (applicants[0]?.role !== "user" || applicants[0]?.status !== "active") {
      throw applicationError("Only an active buyer account can be verified as a seller.", 409);
    }
    const status = action === "approve" ? "approved" : "rejected";
    await client.query(
      `UPDATE seller_applications SET status = $1, remarks = $2, reviewed_by = $3, reviewed_at = NOW()
       WHERE id = $4`, [status, reason || null, actorId, id]
    );
    if (action === "approve") {
      await client.query(
        "UPDATE users SET role = 'seller', department = $1 WHERE id = $2",
        [application.department, application.user_id]
      );
    }
    const notification = await createNotificationRecord({
      userId: application.user_id,
      type: "seller_application",
      message: action === "approve"
        ? "Your seller application was approved. You can now create listings from Sell."
        : `Your seller application was rejected: ${reason}. You can re-apply from Become a seller.`,
    }, client);
    await client.query(
      `INSERT INTO bao_audit_logs (actor_id, action, entity_type, entity_id, reason, metadata)
       VALUES ($1, $2, 'seller_application', $3, $4, $5::jsonb)`,
      [actorId, `seller_application_${status}`, String(id), reason || null,
        JSON.stringify({ user_id: application.user_id, department: application.department, previous_status: "pending", new_status: status })]
    );
    return { status, notification };
  });
  // A realtime failure cannot roll back or obscure the committed decision.
  await broadcastNotification(result.notification);
  return { success: true, status: result.status };
}
