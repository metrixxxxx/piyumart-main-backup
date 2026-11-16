import Link from "next/link";
import { redirect } from "next/navigation";
import { getBaoAccess } from "@/lib/bao-access";
import BaoFinance from "@/components/payments/BaoFinance";
export default async function FinancePage(){const access=await getBaoAccess();if(!access.session)redirect("/admin/login");return <main className="min-h-screen bg-[#eef2f7] dark:bg-[#090e1b]"><header className="bg-[#1a2a6c] px-6 py-4 text-white"><Link href="/dashboard" className="text-sm font-bold">Back to dashboard</Link></header><BaoFinance/></main>;}
