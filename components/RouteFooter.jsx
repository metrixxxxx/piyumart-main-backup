"use client";

import { usePathname } from "next/navigation";
import Footer from "@/components/Footer";

export default function RouteFooter() {
  const pathname = usePathname();
  const hideFooter =
    pathname === "/admin/login" ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/bao" ||
    pathname.startsWith("/bao/");

  return hideFooter ? null : <Footer />;
}
