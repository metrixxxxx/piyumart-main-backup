"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BaoLogoutButton from "@/components/bao/BaoLogoutButton";

const links = [
  { href: "/bao/dashboard", label: "Overview", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { href: "/bao/orders", label: "Orders", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  { href: "/bao/products", label: "Products", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
  { href: "/bao/users", label: "Users", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
  { href: "/bao/sellers", label: "Sellers", icon: "M12 4a4 4 0 100 8 4 4 0 000-8zm-8 16a8 8 0 0116 0H4z" },
  { href: "/bao/seller-applications", label: "Seller Applications", icon: "M9 12l2 2 4-4M5 3h14v18H5z" },
  { href: "/bao/commissions", label: "Commissions", icon: "M12 8c-2.2 0-4 .9-4 2s1.8 2 4 2 4 .9 4 2-1.8 2-4 2m0-8V6m0 12v-2m8-4a8 8 0 11-16 0 8 8 0 0116 0z" },
  { href: "/bao/finance", label: "Payments & cashouts", icon: "M3 7h18v14H3zM3 7l12-4v4m-2 6h8" },
  { href: "/bao/reports", label: "Complaints & reports", icon: "M4 4h16v16H4zM8 9h8m-8 4h8m-8 4h5" },
  { href: "/bao/audit", label: "Audit log", icon: "M5 3h14v18H5zM9 8h6m-6 4h6m-6 4h4" },
];

export default function BaoWorkspace({ children }) {
  const pathname = usePathname();
  const activeLink = links.find(({ href }) => pathname === href || pathname.startsWith(`${href}/`)) || links[0];

  return (
    <div className="bao-surface flex min-h-dvh flex-col md:flex-row">
      <aside className="flex max-h-52 w-full shrink-0 flex-col border-b border-[#FABB00]/25 bg-[#131f50] text-white md:sticky md:top-0 md:h-dvh md:max-h-none md:w-56 md:border-b-0 md:border-r">
        <Link href="/bao/dashboard" className="border-b border-white/15 px-5 py-4 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[#FABB00]">
          <span className="block text-2xl font-extrabold tracking-tight">PIYU<span className="text-[#FABB00]">MART</span></span>
          <span className="mt-0.5 block text-xs text-white/75">Administration Panel</span>
        </Link>

        <nav aria-label="BAO navigation" className="flex flex-1 gap-1 overflow-x-auto px-3 py-3 md:flex-col md:overflow-x-visible md:overflow-y-auto md:py-4">
          {links.map(({ href, label, icon }) => {
            const active = activeLink.href === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FABB00] md:w-full ${
                  active ? "bg-[#FABB00] text-[#131f50]" : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                </svg>
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/15 px-3 py-3 md:mt-auto md:py-4">
          <div className="mb-2 hidden items-center gap-3 px-3 py-2 md:flex">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FABB00]/15 text-xs font-bold text-[#FABB00]">B</div>
            <div className="overflow-hidden">
              <p className="truncate text-xs font-medium">BAO</p>
              <p className="text-xs text-white/70">Staff</p>
            </div>
          </div>
          <BaoLogoutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center border-b border-[#c5cfe8] bg-white px-4 sm:px-6">
          <h1 className="border-l-4 border-[#FABB00] pl-3 text-base font-bold tracking-tight text-[#131f50]">{activeLink.label}</h1>
        </header>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
