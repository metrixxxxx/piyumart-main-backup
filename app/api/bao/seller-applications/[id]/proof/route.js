import { getBaoAccess } from "@/lib/bao-access";
import { db } from "@/lib/db";
import { getProofStorage, SELLER_PROOF_BUCKET } from "@/lib/seller-proof";

const privateHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
const contentTypes = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", pdf: "application/pdf" };

export async function GET(req, { params }) {
  try {
    const access = await getBaoAccess();
    if (!access.session) return Response.json({ error: "Forbidden" }, { status: access.status });
    const { id } = await params;
    if (!/^(?:[1-9]\d*|[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})$/i.test(id)) return Response.json({ error: "Invalid application ID." }, { status: 400 });
    const document = new URL(req.url).searchParams.get("document");
    if (document !== null && !["id", "cor"].includes(document)) {
      return Response.json({ error: "Unknown document." }, { status: 400 });
    }
    const [rows] = await db.query("SELECT user_id, id_proof_url, cor_proof_url FROM seller_applications WHERE id = $1", [id]);
    const application = rows[0];
    if (!application) return Response.json({ error: "Application not found." }, { status: 404 });
    const path = document === "cor" ? application.cor_proof_url : application.id_proof_url;
    if (!path) return Response.json({ error: "This document was not submitted." }, { status: 404 });
    if (typeof path !== "string" || !path.startsWith(`${application.user_id}/`) || path.includes("..") || /[\\%?#:]/.test(path)) {
      return Response.json({ error: "Invalid proof document path." }, { status: 409 });
    }
    // Older clients request a JSON link for the original upload.
    if (document === null) {
      return Response.json({ url: `/api/bao/seller-applications/${id}/proof?document=id` }, { headers: privateHeaders });
    }
    const extension = path.split(".").pop().toLowerCase();
    if (!Object.hasOwn(contentTypes, extension)) return Response.json({ error: "Unsupported document format." }, { status: 409 });
    const { data, error } = await getProofStorage().from(SELLER_PROOF_BUCKET).download(path);
    if (Number(error?.statusCode) === 404) return Response.json({ error: "Document not found in storage." }, { status: 404 });
    if (error) throw error;
    return new Response(data, { headers: {
      ...privateHeaders,
      "Content-Type": contentTypes[extension],
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    console.error("Seller document review failed:", error);
    return Response.json({ error: "Unable to open proof document." }, { status: 500 });
  }
}
