import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { getMarketplaceAccount } from "@/lib/seller-access";
import { LSPU_DEPARTMENTS } from "@/lib/campus";
import { getProofStorage, readProof, SELLER_PROOF_BUCKET } from "@/lib/seller-proof";
import { applicationError } from "@/lib/seller-applications";

export async function GET() {
  try {
    const user = await getMarketplaceAccount();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!["user", "seller"].includes(user.role) || user.status !== "active") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const [rows] = await db.query(
      `SELECT id, department, note, status, remarks, submitted_at, reviewed_at
       FROM seller_applications WHERE user_id = $1 ORDER BY submitted_at DESC, id DESC LIMIT 1`, [user.id]
    );
    return Response.json({ application: rows[0] || null, role: user.role }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Seller application lookup failed:", error);
    return Response.json({ error: "Unable to load your application." }, { status: 500 });
  }
}

export async function POST(req) {
  let uploadedPath;
  let bucket;
  try {
    const user = await getMarketplaceAccount();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "user" || user.status !== "active") return Response.json({ error: "Only active buyer accounts can apply." }, { status: 403 });
    const form = await req.formData();
    const department = form.get("department");
    const note = typeof form.get("note") === "string" ? form.get("note").trim() : "";
    if (!LSPU_DEPARTMENTS.includes(department)) return Response.json({ error: "Choose a valid department." }, { status: 400 });
    if (note.length > 1000) return Response.json({ error: "Note must be 1,000 characters or fewer." }, { status: 400 });
    const file = form.get("id_proof");
    const { bytes, extension } = await readProof(file);
    bucket = getProofStorage().from(SELLER_PROOF_BUCKET);
    const application = await db.transaction(async (client) => {
      // Serializes simultaneous submissions even before the unique index is checked.
      const { rows: accounts } = await client.query("SELECT role, status FROM users WHERE id = $1 FOR UPDATE", [user.id]);
      if (accounts[0]?.role !== "user" || accounts[0]?.status !== "active") throw applicationError("Forbidden", 403);
      const { rows: pending } = await client.query("SELECT id FROM seller_applications WHERE user_id = $1 AND status = 'pending'", [user.id]);
      if (pending.length) throw applicationError("Your application is already under review.", 409);
      const path = `${user.id}/${randomUUID()}.${extension}`;
      const { error } = await bucket.upload(path, bytes, { contentType: file.type, upsert: false, cacheControl: "0" });
      if (error) throw new Error("Unable to upload your proof document.", { cause: error });
      uploadedPath = path;
      const { rows } = await client.query(
        `INSERT INTO seller_applications (user_id, department, id_proof_url, note, status, submitted_at)
         VALUES ($1, $2, $3, $4, 'pending', NOW()) RETURNING id, department, status, submitted_at`,
        [user.id, department, path, note || null]
      );
      return rows[0];
    });
    return Response.json({ application }, { status: 201 });
  } catch (error) {
    if (uploadedPath && bucket) {
      try { await bucket.remove([uploadedPath]); } catch (cleanupError) { console.error("Proof cleanup failed:", cleanupError); }
    }
    console.error("Seller application submission failed:", error);
    const status = error.code === "23505" ? 409 : error.status || 500;
    return Response.json({ error: status === 500 ? "Unable to submit your application. Please try again." : error.code === "23505" ? "Your application is already under review." : error.message }, { status });
  }
}
