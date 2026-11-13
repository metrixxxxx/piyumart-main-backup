"use client";
import { SessionProvider, signOut, useSession } from "next-auth/react";
import { useEffect, useRef } from "react";

function ClearLegacyBaoSession() {
  const { data: session } = useSession();
  const cleanupStarted = useRef(false);

  useEffect(() => {
    if (session?.user?.role !== "bao" || cleanupStarted.current) return;

    cleanupStarted.current = true;
    signOut({ redirect: false }).catch((error) => {
      console.error("Unable to clear legacy BAO marketplace session:", error);
    });
  }, [session?.user?.role]);

  return null;
}

export default function SessionWrapper({ children }) {
  return (
    <SessionProvider>
      <ClearLegacyBaoSession />
      {children}
    </SessionProvider>
  );
}