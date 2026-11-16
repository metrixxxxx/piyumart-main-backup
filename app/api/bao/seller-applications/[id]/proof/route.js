import { getBaoAccess } from "@/lib/bao-access";
import { db } from "@/lib/db";
import { getProofStorage, SELLER_PROOF_BUCKET } from "@/lib/seller-proof";

export async function GET(_req, { params }) {
  try {
    const access = await getBaoAccess();
    if (!access.session) return Response.json({ error: "Forbidden" }, { status: access.status });
    const { id } = await params;
    if (!/^(?:[1-9]\d*|[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})$/i.test(id)) return Response.json({ error: "Invalid application ID." }, { status: 400 });
    const [rows] = await db.query("SELECT user_id, id_proof_url FROM seller_applications WHERE id = $1", [id]);
    if (!rows[0]) return Response.json({ error: "Application not found." }, { status: 404 });
    const path = rows[0].id_proof_url;
    // Store object keys, never a public URL or a client-selected path.
    if (typeof path !== "string" || !path.startsWith(`${rows[0].user_id}/`) || path.includes("..") || path.includes("://")) {
      return Response.json({ error: "Invalid proof document path." }, { status: 409 });
    }
    const { data, error } = await getProofStorage().from(SELLER_PROOF_BUCKET).createSignedUrl(path, 60);
    if (error) throw error;
    return Response.json({ url: data.signedUrl, expiresIn: 60 }, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error) {
    console.error("Proof URL creation failed:", error);
    return Response.json({ error: "Unable to open proof document." }, { status: 500 });
  }
}
