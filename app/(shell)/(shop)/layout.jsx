import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import MarketplaceRoleGate from "@/components/MarketplaceRoleGate";

export default async function ShopLayout({ children }) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role === "admin") redirect("/bao/dashboard");

  return (
    <MarketplaceRoleGate>
      <main>{children}</main>
    </MarketplaceRoleGate>
  );
}
