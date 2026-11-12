import Link from "next/link";

const links = [
  { href: "/bao/dashboard", label: "Overview", key: "overview" },
  { href: "/bao/products", label: "Product moderation", key: "products" },
  { href: "/bao/sellers", label: "Sellers", key: "sellers" },
  { href: "/bao/commissions", label: "Commissions", key: "commissions" },
  { href: "/bao/reports", label: "Complaints & reports", key: "reports" },
  { href: "/bao/audit", label: "Audit log", key: "audit" },
];

export default function BaoHeader({ active }) {
  return (
    <header className="bg-[#1a2a6c] text-white shadow-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center gap-4">
          <Link href="/bao/dashboard" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#c9a028] text-sm font-black text-[#1a2a6c]">
              PM
            </span>
            <span className="text-sm font-bold tracking-wide sm:text-base">
              PIYUMART <span className="font-medium text-white/70">| BAO</span>
            </span>
          </Link>
        </div>

        <nav aria-label="BAO navigation" className="flex flex-wrap items-center gap-2">
          {links.map((link) => {
            const isActive = active === link.key;
            return (
              <Link
                key={link.key}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "bg-white text-[#1a2a6c]"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
