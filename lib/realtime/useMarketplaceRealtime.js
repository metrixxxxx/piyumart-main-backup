"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

// Broadcasts only invalidate data. Each page reloads through its authorized API.
export function useMarketplaceRealtime({ enabled = true, identity, audience = "marketplace", onChange }) {
  const callback = useRef(onChange);
  useEffect(() => { callback.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!enabled) return;
    let disposed = false, channel, refreshTimer, retryTimer;
    const controller = new AbortController();
    const refresh = () => {
      if (disposed) return;
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        if (!disposed) Promise.resolve().then(() => callback.current()).catch(console.error);
      }, 150);
    };
    async function connect() {
      try {
        const response = await fetch(`/api/realtime/channel?audience=${audience}`, {
          cache: "no-store", signal: controller.signal,
        });
        if (response.status === 401 || response.status === 403) return;
        if (!response.ok) throw new Error("Live updates could not connect.");
        const { topic } = await response.json();
        if (disposed) return;
        if (!/^marketplace:[0-9a-f-]{36}$/.test(topic || "")) throw new Error("Invalid live update channel.");
        channel = supabase.channel(topic)
          .on("broadcast", { event: "marketplace:changed" }, refresh)
          .subscribe((status) => {
            // Refetch after joining/rejoining to recover changes missed offline.
            if (status === "SUBSCRIBED") refresh();
          });
      } catch (error) {
        if (!disposed && error.name !== "AbortError") {
          console.error("Realtime connection failed:", error);
          retryTimer = setTimeout(connect, 5000);
        }
      }
    }
    const resume = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", refresh);
    connect();
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(refreshTimer);
      clearTimeout(retryTimer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", refresh);
      if (channel) supabase.removeChannel(channel);
    };
  }, [enabled, identity, audience]);
}
