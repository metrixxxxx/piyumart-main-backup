import { getAdminAccess } from "@/lib/admin-session";

export async function GET() {
  try {
    const access = await getAdminAccess();
    return Response.json(
      { admin: access.admin },
      { status: access.status === 403 ? 403 : 200 }
    );
  } catch (err) {
    console.error("Admin session check failed:", err);
    return Response.json({ admin: null }, { status: 500 });
  }
}