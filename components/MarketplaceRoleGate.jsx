"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function MarketplaceRoleGate({ children }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = session?.user?.role;
  const destination =
    role === "admin"
      ? "/dashboard"
      : role === "bao"
        ? "/bao/dashboard"
        : null;

  useEffect(() => {
    if (destination) router.replace(destination);
  }, [destination, router]);

  useEffect(() => {
    if (!destination) return;

    const leaveMarketplace = () => window.location.replace(destination);
    window.addEventListener("pageshow", leaveMarketplace);
    window.addEventListener("popstate", leaveMarketplace);
    return () => {
      window.removeEventListener("pageshow", leaveMarketplace);
      window.removeEventListener("popstate", leaveMarketplace);
    };
  }, [destination]);

  if (status === "authenticated" && destination) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#eef2f7] text-sm text-[#1a2a6c]">
        Redirecting to your administration workspace...
      </main>
    );
  }

  return children;
}
