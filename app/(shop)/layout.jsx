import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import MarketplaceRoleGate from "@/components/MarketplaceRoleGate";
import Navbar from "@/components/ui/navbar";

export default async function ShopLayout({ children }) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role === "admin") redirect("/dashboard");
  if (session?.user?.role === "bao") redirect("/bao/dashboard");

  return (
    <MarketplaceRoleGate>
      <Navbar />
      <main>{children}</main>
    </MarketplaceRoleGate>
  );
}