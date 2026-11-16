import BaoHeader from "@/components/bao/BaoHeader";
import SellerApplications from "@/components/bao/SellerApplications";

export default function SellerApplicationsPage() {
  return <main className="min-h-screen bg-slate-100 dark:bg-[#0b1220]"><BaoHeader active="applications" /><SellerApplications /></main>;
}
