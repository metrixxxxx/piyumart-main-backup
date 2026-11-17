"use client";

import ActionFeedback from "@/components/ui/ActionFeedback";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

// ── Shared validation ──────────────────────────────────────────────────────
const RULES = [
  { id: "len", label: "At least 8 characters",       test: (v) => v.length >= 8 },
  { id: "num", label: "At least 1 number",            test: (v) => /[0-9]/.test(v) },
  { id: "spc", label: "At least 1 special character", test: (v) => /[^a-zA-Z0-9]/.test(v) },
];

function pwScore(v) {
  return RULES.filter((r) => r.test(v)).length;
}

function PasswordInput({ id, value, onChange, placeholder = "••••••••", autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        className="h-11 w-full rounded-lg border border-[#b8bfd7] bg-white px-3 pr-10 text-sm text-[#11183f] placeholder-[#7180a3] outline-none transition focus:border-[#e5a51b] focus:ring-2 focus:ring-[#e5a51b]/20"
      />
      <button
        type="button"
        aria-label={show ? "Hide password" : "Show password"}
        onClick={() => setShow((s) => !s)}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#65718f] transition hover:text-[#11183f]"
      >
        {show ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <path d="M17.94 17.94A10.94 10.94 0 0112 20C7 20 2.73 16.39 1 12a10.94 10.94 0 012.06-3.94M6.53 6.53A10.94 10.94 0 0112 4c5 0 9.27 3.61 11 8a10.94 10.94 0 01-4.12 5.37" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <path d="M1 12C2.73 7.61 7 4 12 4s9.27 3.61 11 8c-1.73 4.39-6 8-11 8S2.73 16.39 1 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}

function StrengthMeter({ value }) {
  if (!value) return null;
  const score = pwScore(value);
  const barColors = ["", "#e24b4a", "#ef9f27", "#e6a51a"];
  const labels    = ["", "Weak", "Almost there", "Strong ✓"];
  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ background: i <= score ? barColors[score] : "#d9ddec" }}
          />
        ))}
      </div>
      <ul className="space-y-1">
        {RULES.map((r) => {
          const met = r.test(value);
          return (
            <li
              key={r.id}
              className="flex items-center gap-1.5 text-[11px] transition-colors"
              style={{ color: met ? "#b77900" : "#7180a3" }}
            >
              <span className="text-[10px]">{met ? "✓" : "○"}</span>
              {r.label}
            </li>
          );
        })}
      </ul>
      {value.length > 0 && (
        <p className="text-right text-[10px]" style={{ color: barColors[score] }}>
          {labels[score]}
        </p>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function SetPasswordPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (session?.user?.hasPassword) router.push("/");
  }, [session, status]);

  const pwOk      = pwScore(password) === 3;
  const matchOk   = password === confirm && confirm.length > 0;
  const canSubmit = pwOk && matchOk && !loading;

  const handleSubmit = async () => {
    if (loading) return;
    setError("");
    if (!pwOk) {
      setError("Password must be 8+ characters, include a number and a special character.");
      return;
    }
    if (!matchOk) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
    const res  = await fetch("/api/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.message || "Something went wrong.");
      setLoading(false);
      return;
    }

    setSuccess("Password set! Redirecting…");
    setTimeout(() => router.push("/"), 1500);
    } catch { setError("Unable to save your password. Check your connection and try again."); setLoading(false); }
  };

  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-[radial-gradient(ellipse_at_18%_22%,#252d74_0%,#1a2057_46%,#101436_100%)] px-5 py-8 sm:px-8">
      <section className="w-full max-w-[460px] rounded-[20px] bg-white px-7 py-8 text-[#11183f] shadow-[0_24px_70px_rgba(4,8,35,0.28)] sm:px-9 sm:py-9">
          <div className="mb-7 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#e6a51a]">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 8h14l-1.5 12h-11L5 8Z" stroke="#11183f" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M9 8V6a3 3 0 0 1 6 0v2" stroke="#11183f" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <p className="text-[20px] font-black tracking-[2px]">
              PIYU<span className="text-[#e6a51a]">MART</span>
            </p>
          </div>

          {/* Google avatar hint */}
          {session?.user?.image && (
            <div className="mb-6 flex items-center gap-3 rounded-xl bg-[#f5f6fa] p-3">
              <img
                src={session.user.image}
                alt="avatar"
                className="h-10 w-10 rounded-full border border-[#d9ddec]"
              />
              <div>
                <p className="text-sm font-semibold text-[#11183f]">{session.user.name}</p>
                <p className="mt-0.5 text-xs text-[#65718f]">Signed in with Google</p>
              </div>
            </div>
          )}

          <h1 className="text-[26px] font-bold leading-tight">Set your password</h1>
          <p className="mb-7 mt-1.5 text-sm leading-relaxed text-[#65718f]">
            Create a password so you can also log in with your LSPU email next time.
          </p>

          {/* New password */}
          <div className="mb-4">
            <label htmlFor="set-pw" className="mb-1.5 block text-[13px] font-medium">
              New password
            </label>
            <PasswordInput
              id="set-pw"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              autoComplete="new-password"
            />
            <StrengthMeter value={password} />
          </div>

          {/* Confirm password */}
          <div className="mb-5">
            <label htmlFor="confirm-pw" className="mb-1.5 block text-[13px] font-medium">
              Confirm password
            </label>
            <PasswordInput
              id="confirm-pw"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setError(""); }}
              autoComplete="new-password"
            />
            {/* match indicator */}
            {confirm.length > 0 && (
              <p
                className="mt-1.5 text-right text-xs"
                style={{ color: matchOk ? "#9a6800" : "#dc2626" }}
              >
                {matchOk ? "✓ Passwords match" : "✗ Passwords do not match"}
              </p>
            )}
          </div>

          {/* Error / success */}
          {error   && <p role="alert" className="mb-3 text-center text-sm text-red-600">{error}</p>}
          {success && <p className="mb-3 text-center text-sm text-green-700">{success}</p>}

          {/* Actions */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="h-12 w-full rounded-lg bg-[#11183f] text-sm font-bold text-white transition hover:bg-[#1d285d] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {loading ? "Saving…" : "Set Password"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-4 w-full text-center text-sm font-medium text-[#9a6800] transition hover:text-[#704b00]"
          >
            Skip for now
          </button>
      </section>
    <ActionFeedback pending={loading && !success} error={error} success={success} pendingTitle="Securing your account" successTitle="Password saved" />
      </main>
  );
}
