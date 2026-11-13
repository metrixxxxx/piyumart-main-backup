import { clearBaoSession } from "@/lib/bao-session";

export async function POST() {
  await clearBaoSession();
  return Response.json({ success: true });
}
