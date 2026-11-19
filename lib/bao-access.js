import "server-only";

import { getBaoSession } from "@/lib/bao-session";

export async function getBaoAccess() {
  return getBaoSession();
}
