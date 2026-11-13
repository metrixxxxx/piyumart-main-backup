"use client";

import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (response.ok) {
        router.replace("/dashboard");
        return;
      }

      if (data.role === "bao") {
        const result = await signIn("credentials", {
          email: form.email,
          password: form.password,
          redirect: false,
        });
        if (result?.error) {
          setError("Invalid email or password.");
          return;
        }

        const session = await getSession();
        if (session?.user?.role === "bao") {
          router.replace("/bao/dashboard");
          return;
        }

        setError("This page is for authorized Admin and BAO accounts.");
        return;
      }

      setError(data.error || "Unable to sign in. Please check your credentials.");
    } catch (loginError) {
      setError(loginError.message || "Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#eef2f7] px-4 py-10 dark:bg-[#070b14]">
      <section className="w-full max-w-md rounded-2xl bg-white p-7 shadow-xl dark:bg-[#111827] sm:p-9">
        <div className="mb-8 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#c9a028]">PIYUMART</p>
          <h1 className="mt-3 text-2xl font-bold text-[#1a2a6c] dark:text-white">
            Admin &amp; BAO Login
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Sign in with your authorized administrator or BAO account.
          </p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div>
            <label htmlFor="admin-login-email" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
              School email
            </label>
            <input
              id="admin-login-email"
              type="email"
              autoComplete="username"
              required
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#1a2a6c] focus:ring-2 focus:ring-[#1a2a6c]/15 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              placeholder="name@lspu.edu.ph"
            />
          </div>

          <div>
            <label htmlFor="admin-login-password" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Password
            </label>
            <input
              id="admin-login-password"
              type="password"
              autoComplete="current-password"
              required
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#1a2a6c] focus:ring-2 focus:ring-[#1a2a6c]/15 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-12 rounded-lg bg-[#1a2a6c] px-4 font-semibold text-white transition hover:bg-[#243987] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
          Admins continue to the Admin Panel. BAO accounts continue to the BAO dashboard.
        </p>
      </section>
    </main>
  );
}
