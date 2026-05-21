"use client";

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
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="2" y="6" width="10" height="7" rx="2" stroke="#4a5080" strokeWidth="1.4" />
          <path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke="#4a5080" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="7" cy="9.5" r="1" fill="#4a5080" />
        </svg>
      </span>
      <input
        id={id}
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        className="h-10 w-full rounded-full border border-[#2e3460] bg-[#252a4a] pl-10 pr-10 text-sm text-[#e0e4ff] placeholder-[#4a5080] outline-none transition focus:border-[#4f8ef7]"
      />
      <button
        type="button"
        aria-label={show ? "Hide password" : "Show password"}
        onClick={() => setShow((s) => !s)}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#4a5080] transition hover:text-[#e0e4ff]"
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
  const barColors = ["", "#e24b4a", "#ef9f27", "#4f8ef7"];
  const labels    = ["", "Weak", "Almost there", "Strong ✓"];
  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ background: i <= score ? barColors[score] : "#2e3460" }}
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
              style={{ color: met ? "#4f8ef7" : "#4a5080" }}
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
  };

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-[#0f1123] p-4 sm:p-6">
      <div className="w-full max-w-sm rounded-2xl bg-[#1a1d35] shadow-2xl">

        {/* Top accent bar */}
        <div className="h-1 w-full rounded-t-2xl bg-[#4f8ef7]" />

        <div className="px-6 py-8 sm:px-8">
          {/* Brand */}
          <div className="mb-6 text-sm font-bold tracking-widest text-white">
            PIYU<span className="text-[#4f8ef7]">MART</span>
          </div>

          {/* Google avatar hint */}
          {session?.user?.image && (
            <div className="mb-5 flex items-center gap-3">
              <img
                src={session.user.image}
                alt="avatar"
                className="h-9 w-9 rounded-full border border-[#2e3460]"
              />
              <div>
                <p className="text-xs font-semibold text-[#e0e4ff]">{session.user.name}</p>
                <p className="text-[10px] text-[#4a5080]">Signed in with Google</p>
              </div>
            </div>
          )}

          <h2 className="mb-1 text-base font-bold text-white">Set your password</h2>
          <p className="mb-6 text-[11px] leading-relaxed text-[#4a5080]">
            Create a password so you can also log in with your LSPU email next time.
          </p>

          {/* New password */}
          <div className="mb-3">
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#4a5080]">
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
          <div className="mb-4">
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#4a5080]">
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
                className="mt-1.5 text-right text-[11px]"
                style={{ color: matchOk ? "#4f8ef7" : "#e24b4a" }}
              >
                {matchOk ? "✓ Passwords match" : "✗ Passwords do not match"}
              </p>
            )}
          </div>

          {/* Error / success */}
          {error   && <p className="mb-3 text-center text-[11px] text-red-400">{error}</p>}
          {success && <p className="mb-3 text-center text-[11px] text-green-400">{success}</p>}

          {/* Actions */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="h-10 w-full rounded-full bg-[#4f8ef7] text-xs font-semibold uppercase tracking-widest text-white transition hover:bg-[#3a7de8] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Saving…" : "Set Password"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-3 w-full text-center text-[11px] text-[#4a5080] transition hover:text-[#e0e4ff]"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}