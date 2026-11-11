import { NextResponse } from "next/server";
import { getBaoAccess } from "@/lib/bao-access";
import { db } from "@/lib/db";
import {
  broadcastNotification,
  createNotificationRecord,
} from "@/lib/notify";

const REPORT_STATUSES = new Set([
  "pending",
  "under_investigation",
  "resolved",
  "rejected",
]);
const STATUS_LABELS = {
  pending: "Pending",
  under_investigation: "Under investigation",
  resolved: "Resolved",
  rejected: "Rejected",
};
const REPORT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getReportId(params) {
  const { id } = await params;
  return REPORT_ID_PATTERN.test(id) ? id : null;
}

export async function GET(_req, { params }) {
  try {
    const access = await getBaoAccess();
    if (!access.session) {
      return NextResponse.json(
        { error: access.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: access.status }
      );
    }

    const reportId = await getReportId(params);
    if (!reportId) {
      return NextResponse.json({ error: "Invalid report ID." }, { status: 400 });
    }

    const [reportRows, updates] = await Promise.all([
      db.query(
        `SELECT
           r.*,
           reporter.name AS reporter_name,
           reporter.last_name AS reporter_last_name,
           reporter.email AS reporter_email,
           assignee.name AS assignee_name,
           assignee.last_name AS assignee_last_name,
           assignee.role AS assignee_role,
           assignee.status AS assignee_status,
           product.name AS product_name,
           product.description AS product_description,
           product.status AS product_status,
           product.price AS product_price,
           product.image_url AS product_image_url,
           seller.name AS seller_name,
           seller.last_name AS seller_last_name,
           seller.email AS seller_email,
           seller.status AS seller_status,
           related_order.status AS order_status,
           related_order.total AS order_total,
           related_order.created_at AS order_created_at,
           COALESCE(related_order.seller_id, order_seller.seller_id) AS order_seller_id,
           order_seller_user.name AS order_seller_name,
           order_seller_user.last_name AS order_seller_last_name
         FROM marketplace_reports AS r
         JOIN users AS reporter ON reporter.id = r.reporter_id
         LEFT JOIN users AS assignee ON assignee.id = r.assigned_to
         LEFT JOIN products AS product ON product.id = r.related_product_id
         LEFT JOIN users AS seller ON seller.id = r.related_seller_id
         LEFT JOIN orders AS related_order ON related_order.id = r.related_order_id
         LEFT JOIN LATERAL (
           SELECT
             CASE WHEN COUNT(DISTINCT p.seller_id) = 1 THEN MIN(p.seller_id) END AS seller_id
           FROM order_items AS oi
           JOIN products AS p ON p.id = oi.product_id
           WHERE oi.order_id = related_order.id
         ) AS order_seller ON true
         LEFT JOIN users AS order_seller_user
           ON order_seller_user.id = COALESCE(related_order.seller_id, order_seller.seller_id)
         WHERE r.id = $1`,
        [reportId]
      ),
      db.query(
        `SELECT
           report_update.id, report_update.report_id, report_update.updated_by,
           report_update.previous_status, report_update.new_status,
           report_update.notes, report_update.created_at,
           actor.name AS actor_name, actor.last_name AS actor_last_name
         FROM marketplace_report_updates AS report_update
         JOIN users AS actor ON actor.id = report_update.updated_by
         WHERE report_update.report_id = $1
         ORDER BY report_update.created_at DESC, report_update.id DESC`,
        [reportId]
      ),
    ]);

    if (!reportRows[0].length) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    return NextResponse.json(
      { report: reportRows[0][0], updates: updates[0] },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("BAO report detail request failed:", error);
    return NextResponse.json({ error: "Unable to load report details." }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const access = await getBaoAccess();
    if (!access.session) {
      return NextResponse.json(
        { error: access.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: access.status }
      );
    }

    const reportId = await getReportId(params);
    if (!reportId) {
      return NextResponse.json({ error: "Invalid report ID." }, { status: 400 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid report update." }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid report update." }, { status: 400 });
    }

    const hasStatus = Object.prototype.hasOwnProperty.call(body, "status");
    const hasAssignee = Object.prototype.hasOwnProperty.call(body, "assigned_to");
    const hasResolution = Object.prototype.hasOwnProperty.call(body, "resolution");
    const hasNotes = Object.prototype.hasOwnProperty.call(body, "notes");
    if (!hasStatus && !hasAssignee && !hasResolution && !hasNotes) {
      return NextResponse.json({ error: "No report changes were provided." }, { status: 400 });
    }

    if (hasStatus && (typeof body.status !== "string" || !REPORT_STATUSES.has(body.status))) {
      return NextResponse.json({ error: "Invalid report status." }, { status: 400 });
    }
    if (hasNotes && typeof body.notes !== "string") {
      return NextResponse.json({ error: "Investigation notes must be text." }, { status: 400 });
    }
    if (hasResolution && typeof body.resolution !== "string" && body.resolution !== null) {
      return NextResponse.json({ error: "Resolution must be text." }, { status: 400 });
    }

    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    const requestedResolution =
      typeof body.resolution === "string" ? body.resolution.trim() : null;
    if (notes.length > 4000 || (requestedResolution && requestedResolution.length > 4000)) {
      return NextResponse.json(
        { error: "Notes and resolutions must be 4,000 characters or fewer." },
        { status: 400 }
      );
    }

    let requestedAssignee = null;
    if (hasAssignee && body.assigned_to !== null && body.assigned_to !== "") {
      if (
        typeof body.assigned_to !== "number" &&
        (typeof body.assigned_to !== "string" || !/^\d+$/.test(body.assigned_to))
      ) {
        return NextResponse.json({ error: "Invalid report assignee." }, { status: 400 });
      }
      requestedAssignee = Number(body.assigned_to);
      if (!Number.isInteger(requestedAssignee) || requestedAssignee < 1) {
        return NextResponse.json({ error: "Invalid report assignee." }, { status: 400 });
      }
    }

    const result = await db.transaction(async (client) => {
      const { rows } = await client.query(
        `SELECT id, reporter_id, status, assigned_to, resolution
         FROM marketplace_reports
         WHERE id = $1
         FOR UPDATE`,
        [reportId]
      );
      const report = rows[0];
      if (!report) return { error: "Report not found.", status: 404 };

      const nextStatus = hasStatus ? body.status : report.status;
      let nextAssignee = hasAssignee ? requestedAssignee : report.assigned_to;
      let nextResolution = hasResolution ? requestedResolution : report.resolution;
      if (nextStatus !== "resolved") {
        if (hasResolution && requestedResolution) {
          return {
            error: "A resolution can only be recorded for a resolved report.",
            status: 400,
          };
        }
        if (report.status === "resolved") nextResolution = null;
      }
      if (nextStatus === "resolved" && !nextResolution) {
        return { error: "A resolution is required when resolving a report.", status: 400 };
      }

      const statusChanged = nextStatus !== report.status;
      const assigneeChanged = Number(nextAssignee || 0) !== Number(report.assigned_to || 0);
      const resolutionChanged = (nextResolution || "") !== (report.resolution || "");
      const hasInvestigationNotes = notes.length > 0;
      if (!statusChanged && !assigneeChanged && !resolutionChanged && !hasInvestigationNotes) {
        return { error: "No report changes were provided.", status: 400 };
      }
      if (
        statusChanged &&
        !hasInvestigationNotes &&
        !(nextStatus === "resolved" && nextResolution)
      ) {
        return {
          error: "Add an investigation note or resolution to explain the status change.",
          status: 400,
        };
      }

      let assigneeName = null;
      if (assigneeChanged && nextAssignee !== null) {
        const { rows: assignees } = await client.query(
          `SELECT id, name, last_name
           FROM users
           WHERE id = $1 AND role IN ('admin', 'bao') AND status = 'active'`,
          [nextAssignee]
        );
        if (!assignees[0]) {
          return {
            error: "Reports can only be assigned to active BAO or admin personnel.",
            status: 400,
          };
        }
        assigneeName = [assignees[0].name, assignees[0].last_name]
          .filter(Boolean)
          .join(" ");
      }

      const { rows: updatedRows } = await client.query(
        `UPDATE marketplace_reports
         SET status = $2,
             assigned_to = $3,
             resolution = $4,
             resolved_at = CASE
               WHEN $2::varchar = 'resolved' THEN COALESCE(resolved_at, NOW())
               ELSE NULL
             END
         WHERE id = $1
         RETURNING *`,
        [reportId, nextStatus, nextAssignee, nextResolution]
      );

      const historyNotes = [
        notes,
        resolutionChanged && nextResolution ? `Resolution: ${nextResolution}` : "",
        assigneeChanged
          ? `Assignment: ${assigneeName || "unassigned"}`
          : "",
        report.status === "resolved" && nextStatus !== "resolved"
          ? "Previous resolution cleared when the report was reopened."
          : "",
      ]
        .filter(Boolean)
        .join("\n");
      await client.query(
        `INSERT INTO marketplace_report_updates
           (report_id, updated_by, previous_status, new_status, notes)
         VALUES ($1, $2, $3, $4, NULLIF($5, ''))`,
        [reportId, access.session.user.id, report.status, nextStatus, historyNotes]
      );

      const auditReason = notes || (nextStatus === "resolved" ? nextResolution : null);
      if (statusChanged) {
        await client.query(
          `INSERT INTO bao_audit_logs
             (actor_id, action, entity_type, entity_id, reason, metadata)
           VALUES (
             $1, 'complaint_status_changed', 'marketplace_report', $2, $3,
             jsonb_build_object('previous_status', $4::text, 'new_status', $5::text)
           )`,
          [
            access.session.user.id,
            reportId,
            auditReason,
            report.status,
            nextStatus,
          ]
        );
      }
      if (nextStatus === "resolved" && (statusChanged || resolutionChanged)) {
        await client.query(
          `INSERT INTO bao_audit_logs
             (actor_id, action, entity_type, entity_id, reason, metadata)
           VALUES (
             $1, 'complaint_resolved', 'marketplace_report', $2, $3,
             jsonb_build_object('previous_status', $4::text, 'new_status', $5::text)
           )`,
          [
            access.session.user.id,
            reportId,
            nextResolution,
            report.status,
            nextStatus,
          ]
        );
      }
      if (assigneeChanged) {
        await client.query(
          `INSERT INTO bao_audit_logs
             (actor_id, action, entity_type, entity_id, reason, metadata)
           VALUES (
             $1, 'complaint_assigned', 'marketplace_report', $2, $3,
             jsonb_build_object('previous_assignee', $4::integer, 'new_assignee', $5::integer)
           )`,
          [
            access.session.user.id,
            reportId,
            notes || null,
            report.assigned_to,
            nextAssignee,
          ]
        );
      }
      if (
        hasInvestigationNotes &&
        !statusChanged &&
        !assigneeChanged &&
        !resolutionChanged
      ) {
        await client.query(
          `INSERT INTO bao_audit_logs
             (actor_id, action, entity_type, entity_id, reason, metadata)
           VALUES (
             $1, 'complaint_investigation_note_added', 'marketplace_report', $2, $3,
             jsonb_build_object('status', $4::text)
           )`,
          [access.session.user.id, reportId, notes, nextStatus]
        );
      }

      const notifications = new Map();
      const actorId = Number(access.session.user.id);
      if (
        statusChanged ||
        resolutionChanged ||
        hasInvestigationNotes
      ) {
        notifications.set(Number(report.reporter_id), {
          userId: report.reporter_id,
          type: "marketplace_report_update",
          message:
            nextStatus === "resolved"
              ? "Your marketplace report has been resolved."
              : statusChanged
                ? `Your marketplace report status is now "${STATUS_LABELS[nextStatus]}".`
                : "A BAO update was added to your marketplace report.",
        });
      }
      if (assigneeChanged && nextAssignee !== null) {
        notifications.set(Number(nextAssignee), {
          userId: nextAssignee,
          type: "marketplace_report_assigned",
          message: "A marketplace report has been assigned to you.",
        });
      }

      const notificationRecords = [];
      for (const notification of notifications.values()) {
        if (Number(notification.userId) === actorId) continue;
        notificationRecords.push(
          await createNotificationRecord(notification, client)
        );
      }

      return { report: updatedRows[0], notifications: notificationRecords };
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await Promise.all(result.notifications.map(broadcastNotification));
    return NextResponse.json(
      { success: true, report: result.report },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("BAO report update failed:", error);
    return NextResponse.json({ error: "Unable to update the report." }, { status: 500 });
  }
}
