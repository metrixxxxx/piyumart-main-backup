import Sidebar from "@/components/Sidebar";

export default function ShellLayout({ children }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#f0eeff] dark:bg-[#070b14] md:flex-row">
      <Sidebar />
      <div id="shell-content" className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
