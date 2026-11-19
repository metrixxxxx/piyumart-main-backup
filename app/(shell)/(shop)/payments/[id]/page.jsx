import { redirect } from "next/navigation";
import { getMarketplaceAccount } from "@/lib/seller-access";
import PaymentStatus from "@/components/payments/PaymentStatus";
export default async function PaymentPage({params}){const {id}=await params;const user=await getMarketplaceAccount();if(!user)redirect("/login");return <PaymentStatus id={id}/>;}
