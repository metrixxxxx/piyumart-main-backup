import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getMarketplaceAccount } from "@/lib/seller-access";
import SellManager from "@/components/SellManager";
import BecomeSeller from "@/components/BecomeSeller";

export default async function SellPage() {
  const user = await getMarketplaceAccount();
  if (!user) redirect("/login");
  if (user.role === "seller" && user.status === "active") return <SellManager />;
  if (user.role !== "user" || user.status !== "active") {
    return <p role="alert" className="p-10 text-center">An active verified seller account is required to manage listings.</p>;
  }
  const [rows] = await db.query(
    `SELECT id, department, status, remarks FROM seller_applications
     WHERE user_id = $1 ORDER BY submitted_at DESC, id DESC LIMIT 1`, [user.id]
  );
  return <BecomeSeller initialApplication={rows[0] || null} />;
}
