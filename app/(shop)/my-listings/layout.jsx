import { redirect } from "next/navigation";
import { getMarketplaceAccount } from "@/lib/seller-access";

export default async function SellerListingsLayout({ children }) {
  const user = await getMarketplaceAccount();
  if (!user) redirect("/login");
  if (user.role !== "seller" || user.status !== "active") redirect("/sell");
  return children;
}
