import "server-only";

import { getAdminAccess } from "@/lib/admin-session";
import { getBaoSession } from "@/lib/bao-session";

export async function getBaoAccess() {
  const baoAccess = await getBaoSession();
  if (baoAccess.session) return baoAccess;

  const adminAccess = await getAdminAccess();
  if (adminAccess.admin) {
    return { session: { user: adminAccess.admin }, status: 200 };
  }

  return {
    session: null,
    status:
      adminAccess.status === 403 || baoAccess.status === 403 ? 403 : 401,
  };
}
