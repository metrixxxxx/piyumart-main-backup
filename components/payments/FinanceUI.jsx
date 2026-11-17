export const financePanel="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-[#111a2b]";
export const financeField="mt-1 w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2.5 text-sm dark:border-slate-600";
export const financeButton="rounded-xl bg-[#1a2a6c] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#24377f] disabled:opacity-50";
export const php=value=>new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP"}).format(Number(value||0));
export const financeDate=value=>value?new Date(value).toLocaleString("en-PH",{timeZone:"Asia/Manila"}):"—";
export const readable=value=>String(value||"").replaceAll("_"," ");
export function TestModeNotice(){return <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Test mode. Wallet amounts track demo earnings; no real money moves. A cashout is complete only after a matching transfer is confirmed.</p>;}
export function MoneyCard({label,value}){return <div className={financePanel}><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p><p className="mt-2 text-2xl font-extrabold text-[#1a2a6c] dark:text-[#e3c36c]">{php(value)}</p></div>;}
export function FinanceStatus({value}){return <span className="inline-block rounded-full bg-[#1a2a6c]/10 px-2.5 py-1 text-xs font-semibold capitalize text-[#1a2a6c] dark:bg-[#c9a028]/15 dark:text-[#e3c36c]">{readable(value)}</span>;}
