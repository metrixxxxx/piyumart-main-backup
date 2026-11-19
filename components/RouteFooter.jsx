"use client";

import { usePathname } from "next/navigation";
import Footer from "@/components/Footer";

export default function RouteFooter() {
  const pathname = usePathname();

  return pathname === "/" ? <Footer /> : null;
}
