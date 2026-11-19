import { redirect } from "next/navigation";
import { getMarketplaceAccount } from "@/lib/seller-access";
import SellerWallet from "@/components/payments/SellerWallet";
export default async function WalletPage(){const user=await getMarketplaceAccount();if(!user)redirect("/login");if(user.role!=="seller"||user.status!=="active")redirect("/sell");return <SellerWallet/>;}
