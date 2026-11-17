"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ActionFeedback from "@/components/ui/ActionFeedback";

export default function BaoLogoutButton() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleLogout() {
    if (loading) return;
    setConfirmOpen(false);
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/bao/logout", { method: "POST" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Unable to log out.");
      }

      router.replace("/admin/login");
      router.refresh();
    } catch (logoutError) {
      console.error("BAO logout failed:", logoutError);
      setError(logoutError.message || "Unable to log out.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start">
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={loading}
        className="rounded-lg px-3 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Signing out..." : "Log out"}
      </button>
      {error ? (
        <p role="alert" className="px-3 py-1 text-xs text-red-200">
          {error}
        </p>
      ) : null}
      <ConfirmModal open={confirmOpen} title="Log out of BAO?" description="Your session will end. You can sign in again whenever you need to return." confirmText="Log out" cancelText="Stay signed in" onCancel={() => setConfirmOpen(false)} onConfirm={handleLogout} loadingText="Signing you out" />
      <ActionFeedback pending={loading} error={error} showLoading={false} errorTitle="Unable to log out" />
    </div>
  );
}
