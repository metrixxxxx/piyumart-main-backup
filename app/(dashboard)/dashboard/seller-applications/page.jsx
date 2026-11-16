import Link from "next/link";
import { redirect } from "next/navigation";
import { getBaoAccess } from "@/lib/bao-access";
import SellerApplications from "@/components/bao/SellerApplications";

export default async function SellerApplicationsPage() {
  const access = await getBaoAccess();
  if (!access.session) redirect(access.status === 401 ? "/admin/login" : "/");
  return <main className="min-h-screen bg-[#f0eeff] dark:bg-[#070b14]">
    <header className="bg-[#1a2a6c] px-6 py-4 text-white"><Link href={access.session.user.role === "bao" ? "/bao/dashboard" : "/dashboard"} className="text-sm font-bold">Back to dashboard</Link></header>
    <SellerApplications />
  </main>;
}
