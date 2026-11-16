import { getBaoAccess } from "@/lib/bao-access";
import { reviewSellerApplication } from "@/lib/seller-applications";

export async function PATCH(req, { params }) {
  try {
    const access = await getBaoAccess();
    if (!access.session) return Response.json({ error: "Forbidden" }, { status: access.status });
    const { id } = await params;
    if (!/^(?:[1-9]\d*|[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})$/i.test(id)) return Response.json({ error: "Invalid application ID." }, { status: 400 });
    const body = await req.json();
    const action = body?.action;
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    if (!["approve", "reject"].includes(action)) return Response.json({ error: "Invalid action." }, { status: 400 });
    if (action === "reject" && !reason) return Response.json({ error: "A rejection reason is required." }, { status: 400 });
    if (reason.length > 1000) return Response.json({ error: "Reason must be 1,000 characters or fewer." }, { status: 400 });
    return Response.json(await reviewSellerApplication({ id, actorId: access.session.user.id, action, reason }));
  } catch (error) {
    console.error("Seller application review failed:", error);
    return Response.json({ error: error.status ? error.message : "Unable to review application." }, { status: error.status || (error instanceof SyntaxError ? 400 : 500) });
  }
}
