"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function BaoWorkspaceBackGuard() {
  const pathname = usePathname();
  const workspacePath = pathname === "/bao" || pathname.startsWith("/bao/")
    ? "/bao/dashboard"
    : null;

  useEffect(() => {
    if (!workspacePath) return;
    sessionStorage.setItem("piyumart-bao-workspace", workspacePath);

    function returnToWorkspace() {
      if (window.location.pathname === "/") {
        window.history.forward();
        window.setTimeout(() => {
          if (window.location.pathname === "/") {
            window.location.replace(workspacePath);
          }
        }, 100);
      }
    }

    window.addEventListener("popstate", returnToWorkspace, true);
    return () => window.removeEventListener("popstate", returnToWorkspace, true);
  }, [workspacePath]);

  useEffect(() => {
    if (pathname !== "/") return;

    function handleRestoredHome(event) {
      if (!event.persisted) return;
      const savedPath = sessionStorage.getItem("piyumart-bao-workspace");
      const workspacePath = savedPath === "/bao/dashboard" ? "/bao/dashboard" : null;
      if (!workspacePath) return;

      window.history.forward();
      window.setTimeout(() => {
        if (window.location.pathname === "/") {
          window.location.replace(workspacePath);
        }
      }, 100);
    }

    window.addEventListener("pageshow", handleRestoredHome);
    return () => window.removeEventListener("pageshow", handleRestoredHome);
  }, [pathname]);

  return null;
}
