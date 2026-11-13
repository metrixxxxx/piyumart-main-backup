import { getAdminAccess } from "@/lib/admin-session";

export async function requireAdmin() {
  const access = await getAdminAccess();
  return access.status === 200 ? access.admin : null;
}