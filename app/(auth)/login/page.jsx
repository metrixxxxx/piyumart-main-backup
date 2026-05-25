"use client";

import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import FeedbackModal from "@/components/ui/FeedbackModal";
import LoadingModal from "@/components/ui/LoadingModal";

// ── Password validation rules ──────────────────────────────────────────────
const RULES = [
  { id: "len", label: "At least 8 characters",      test: (v) => v.length >= 8 },
  { id: "num", label: "At least 1 number",           test: (v) => /[0-9]/.test(v) },
  { id: "spc", label: "At least 1 special character",test: (v) => /[^a-zA-Z0-9]/.test(v) },
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
          // eye-off
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <path d="M17.94 17.94A10.94 10.94 0 0112 20C7 20 2.73 16.39 1 12a10.94 10.94 0 012.06-3.94M6.53 6.53A10.94 10.94 0 0112 4c5 0 9.27 3.61 11 8a10.94 10.94 0 01-4.12 5.37" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          // eye
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
  const colors = ["", "#e24b4a", "#ef9f27", "#4f8ef7"];
  const labels = ["", "Weak", "Almost there", "Strong"];
  return (
    <div className="mt-2 space-y-2">
      {/* bars */}
      <div className="flex gap-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ background: i <= score ? colors[score] : "#2e3460" }}
          />
        ))}
      </div>
      {/* rules */}
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
        <p className="text-right text-[10px]" style={{ color: colors[score] }}>
          {labels[score]}
        </p>
      )}
    </div>
  );
}

export default function LoginPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [feedback, setFeedback] = useState(null);
  // "none" | "email" — controls which sub-form is open
  const [mode, setMode]         = useState("none");
  const router = useRouter();

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const pwValid    = pwScore(password) === 3;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.endsWith("@lspu.edu.ph")) {
      const msg = "Use your LSPU email only (@lspu.edu.ph)";
      setError(msg);
      setFeedback({ type: "error", title: "Invalid email", description: msg });
      return;
    }

    if (!pwValid) {
      const msg = "Password must be 8+ characters with a number and special character.";
      setError(msg);
      setFeedback({ type: "error", title: "Weak password", description: msg });
      return;
    }

    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });

    if (res?.error) {
      const msg = "Invalid email or password";
      setError(msg);
      setFeedback({ type: "error", title: "Login failed", description: msg });
      setLoading(false);
    } else {
      const session = await getSession();
      router.push(session?.user?.role === "admin" ? "/admin/dashboard" : "/");
    }
  };

  const handleGoogleSignIn = () => {
    setLoading(true);
    signIn("google", { callbackUrl: "/set-password" });
  };

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-[#0f1123] p-4 sm:p-6">
      <div className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl shadow-2xl md:flex-row">

        {/* ── Left: Login Panel ─────────────────────────────────────────── */}
        <div className="flex w-full flex-shrink-0 flex-col bg-[#1a1d35] px-6 py-8 sm:px-8 md:w-80 md:py-9">

          {/* Brand */}
          <div className="mb-8 text-sm font-bold tracking-widest text-white">
            PIYU<span className="text-[#4f8ef7]">MART</span>
          </div>

          {/* Avatar */}
          <div className="mb-7 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#252a4a]">
              <svg width="34" height="34" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="12" r="6" fill="#4f8ef7" opacity="0.8" />
                <path d="M3 28c0-7.18 5.82-13 13-13s13 5.82 13 13" stroke="#4f8ef7" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          {/* Headline */}
          <h1 className="mb-1 text-center text-base font-bold text-white">Sign in</h1>
          <p className="mb-6 text-center text-[11px] text-[#4a5080]">Choose how you want to continue</p>

          {/* ── Option A: Google ── */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="mb-3 flex h-10 w-full items-center justify-center gap-2.5 rounded-full border border-[#2e3460] bg-[#252a4a] text-xs font-semibold text-[#e0e4ff] tracking-wide transition hover:border-[#4f8ef7] hover:bg-[#1e2340] active:scale-95 disabled:opacity-50"
          >
            {/* Google G */}
            <svg width="16" height="16" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className="mb-3 flex items-center gap-2">
            <div className="h-px flex-1 bg-[#2e3460]" />
            <span className="text-[10px] text-[#4a5080]">or</span>
            <div className="h-px flex-1 bg-[#2e3460]" />
          </div>

          {/* ── Option B: Email toggle ── */}
         <button
            type="button"
            onClick={() => setMode((m) => (m === "email" ? "none" : "email"))}
            disabled={loading}
            className="flex h-10 w-full items-center justify-center rounded-full border border-[#2e3460] bg-[#252a4a] px-4 text-xs font-semibold tracking-wide text-[#e0e4ff] transition hover:border-[#4f8ef7] hover:bg-[#1e2340] active:scale-95 disabled:opacity-50"
          >
            <div className="flex w-full items-center justify-center gap-2.5">
              {/* Email icon */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 14 14"
                fill="none"
                className="shrink-0"
              >
                <rect
                  x="1"
                  y="3"
                  width="12"
                  height="9"
                  rx="2"
                  stroke="#4a5080"
                  strokeWidth="1.4"
                />
                <path
                  d="M1 5l6 4 6-4"
                  stroke="#4a5080"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>

              <span>Continue with email</span>

              {/* Chevron */}
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                className="shrink-0 transition-transform duration-200"
                style={{
                  transform:
                    mode === "email" ? "rotate(180deg)" : "rotate(0deg)",
                }}
              >
                <path
                  d="M2 4l4 4 4-4"
                  stroke="#4a5080"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </button>

          {/* ── Email + Password form (collapsible) ── */}
          {mode === "email" && (
            <form onSubmit={handleLogin} className="mt-4 flex flex-col gap-3">

              {/* Email */}
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="1" y="3" width="12" height="9" rx="2" stroke="#4a5080" strokeWidth="1.4" />
                    <path d="M1 5l6 4 6-4" stroke="#4a5080" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  type="email"
                  placeholder="yourname@lspu.edu.ph"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  required
                  autoComplete="email"
                  className="h-10 w-full rounded-full border border-[#2e3460] bg-[#252a4a] pl-10 pr-4 text-xs text-[#e0e4ff] placeholder-[#4a5080] outline-none transition focus:border-[#4f8ef7]"
                />
              </div>

              {/* Password */}
              <div>
                <PasswordInput
                  id="login-pw"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  autoComplete="current-password"
                />
                <StrengthMeter value={password} />
              </div>

              {/* Error */}
              {error && (
                <p className="text-center text-[11px] text-red-400">{error}</p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !emailValid || !pwValid}
                className="h-10 w-full rounded-full bg-[#4f8ef7] text-xs font-semibold uppercase tracking-widest text-white transition hover:bg-[#3a7de8] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? "Logging in…" : "Login"}
              </button>

              {/* Remember me */}
              <label className="flex cursor-pointer items-center justify-center gap-1.5 text-[11px] text-[#4a5080]">
                <input type="checkbox" className="h-3 w-3 accent-[#4f8ef7]" />
                Remember me
              </label>
            </form>
          )}

          {/* Dots */}
          <div className="mt-auto flex justify-center gap-1.5 pt-6">
            <div className="h-2 w-5 rounded-full bg-[#4f8ef7]" />
            <div className="h-2 w-2 rounded-full bg-[#2e3460]" />
            <div className="h-2 w-2 rounded-full bg-[#2e3460]" />
          </div>
        </div>

        {/* ── Right: Hero Panel ──────────────────────────────────────────── */}
        <div className="relative hidden flex-1 flex-col overflow-hidden bg-[#13162b] md:flex">
          <nav className="relative z-10 flex items-center justify-end gap-5 px-5 py-4">
            <span className="cursor-pointer text-[10px] uppercase tracking-widest text-[#4a5080] hover:text-white">
              About Us
            </span>
            <button className="rounded-full bg-[#4f8ef7] px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white hover:bg-[#3a7de8]">
              Sign In
            </button>
          </nav>

          <div className="relative z-10 mt-auto p-8">
            <h1 className="mb-3 text-4xl font-bold leading-none tracking-tight text-white lg:text-6xl">
              Welcome<span className="text-[#4f8ef7]">.</span>
            </h1>
            <p className="mb-3 max-w-[200px] text-xs leading-relaxed text-[#4a5080]">
              Discover student deals on campus. Sign in with your LSPU email.
            </p>
          </div>
        </div>
      </div>

      <LoadingModal open={loading} title="Logging in" description="Checking your account and preparing your session." />
      <FeedbackModal
        open={Boolean(feedback)}
        type={feedback?.type}
        title={feedback?.title}
        description={feedback?.description}
        onClose={() => setFeedback(null)}
      />
    </div>
  );
}