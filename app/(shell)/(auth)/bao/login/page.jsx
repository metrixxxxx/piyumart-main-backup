"use client";

import ActionFeedback from "@/components/ui/ActionFeedback";
import BaoLoginCard from "@/components/bao/BaoLoginCard";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function BaoLoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(event) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);

    let navigating = false;
    try {
      const response = await fetch("/api/bao/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (response.ok) {
        navigating = true;
        router.replace("/bao/dashboard");
        return;
      }

      setError(data.error || "Unable to sign in. Please check your credentials.");
    } catch (loginError) {
      setError(loginError.message || "Unable to sign in. Please try again.");
    } finally {
      if (!navigating) setLoading(false);
    }
  }

  return (
    <BaoLoginCard>
      <form onSubmit={handleLogin} className="flex flex-col gap-5">
        <div>
          <label htmlFor="bao-login-email" className="mb-1.5 block text-sm font-medium text-slate-700">
            School email
          </label>
          <input
            id="bao-login-email"
            type="email"
            autoComplete="username"
            required
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#1a2a6c] focus:ring-2 focus:ring-[#1a2a6c]/15"
            placeholder="name@lspu.edu.ph"
          />
        </div>

        <div>
          <label htmlFor="bao-login-password" className="mb-1.5 block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id="bao-login-password"
            type="password"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#1a2a6c] focus:ring-2 focus:ring-[#1a2a6c]/15"
            placeholder="Enter your password"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="h-12 rounded-lg bg-[#FABB00] px-4 font-bold text-[#131f50] transition hover:bg-[#e2a800] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#131f50] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-slate-500">
        BAO staff continue to the shared administration workspace.
      </p>
      <ActionFeedback pending={loading} error={error} pendingTitle="Signing you in" pendingDescription="Verifying your account and opening your dashboard." errorTitle="Sign-in unsuccessful" />
    </BaoLoginCard>
  );
}
