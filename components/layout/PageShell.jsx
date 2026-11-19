import Link from "next/link";
import SearchAutocomplete from "@/components/SearchAutocomplete";

export function PageHeader({ title, description, actions, variant = "plain" }) {
  const branded = variant === "branded" || variant === "navy";
  if (branded) return (
    <header className="relative z-30 border-b border-[#FABB00]/20 bg-[#131f50] text-white dark:bg-[#0b1230]">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex min-w-0 flex-1 basis-80 items-center gap-3 sm:gap-5">
          <Link href="/" aria-label="PIYUMART home" className="inline-flex shrink-0 items-center gap-2 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FABB00]">
            <svg aria-hidden="true" className="h-7 w-7 text-[#FABB00] sm:h-9 sm:w-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 8h14l-1.5 12h-11L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" />
            </svg>
            <span className="whitespace-nowrap text-lg font-extrabold tracking-tight text-white sm:text-2xl">PIYU<span className="text-[#FABB00]">MART</span></span>
          </Link>
          <span aria-hidden="true" className="h-9 w-px shrink-0 bg-[#FABB00]" />
          <div className="min-w-0">
            <h1 className="truncate text-base font-medium leading-6 sm:text-xl sm:leading-7">{title}</h1>
            {description && <p className="mt-0.5 truncate text-[11px] leading-4 text-white/70">{description}</p>}
          </div>
        </div>
        <div className="min-w-0 flex-1 basis-80 xl:max-w-[620px]">
          <SearchAutocomplete variant="header" />
        </div>
      </div>
      {actions && <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 px-4 py-3 sm:px-6">{actions}</div>}
    </header>
  );
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-[#0e1a3d] dark:text-[#e8edf8]">{title}</h1>
        {description && <p className="mt-1 text-sm text-[#0e1a3d]/60 dark:text-[#e8edf8]/50">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
    </header>
  );
}

export default function PageShell({ title, description, actions, toolbar, children, bare = false, headerVariant = "branded" }) {
  if (bare) return children;
  const branded = headerVariant === "branded" || headerVariant === "navy";

  return (
    <main className="min-h-full min-w-0 bg-[#f0eeff] text-[#0e1a3d] dark:bg-[#070b14] dark:text-[#e8edf8]">
      {branded && <PageHeader title={title} description={description} variant="branded" />}
      <div className="w-full px-4 py-5 sm:px-6 sm:py-6">
        {!branded && <PageHeader title={title} description={description} actions={actions} />}
        {branded && (toolbar || actions) ? (
          <div className={toolbar ? "flex min-w-0 flex-col-reverse gap-3 border-b border-[#c5cfe8] dark:border-white/[0.07] sm:flex-row sm:items-end sm:justify-between" : "mb-5 flex justify-end"}>
            {toolbar && <div className="min-w-0 flex-1">{toolbar}</div>}
            {actions && <div className={`flex flex-wrap justify-end gap-2 sm:shrink-0 ${toolbar ? "pb-2" : ""}`}>{actions}</div>}
          </div>
        ) : toolbar && <div className="mt-5 border-b border-[#c5cfe8] dark:border-white/[0.07]">{toolbar}</div>}
        <div className={branded && !toolbar ? "" : "pt-5"}>{children}</div>
      </div>
    </main>
  );
}
