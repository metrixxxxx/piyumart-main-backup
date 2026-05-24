"use client";

import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import FeedbackModal from "@/components/ui/FeedbackModal";
import LoadingModal from "@/components/ui/LoadingModal";
import Link from "next/link";

// ── Password validation rules ──────────────────────────────────────────────
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
          <rect x="2" y="6" width="10" height="7" rx="2" stroke="#6b73b0" strokeWidth="1.4" />
          <path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke="#6b73b0" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="7" cy="9.5" r="1" fill="#6b73b0" />
        </svg>
      </span>
      <input
        id={id}
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        className="h-10 w-full rounded-full border border-[#2a3272] bg-[#1c2260] pl-10 pr-10 text-sm text-[#e8ecff] placeholder-[#6b73b0] outline-none transition focus:border-[#c9922a]"
      />
      <button
        type="button"
        aria-label={show ? "Hide password" : "Show password"}
        onClick={() => setShow((s) => !s)}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6b73b0] transition hover:text-[#e8ecff]"
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
  const colors = ["", "#e24b4a", "#ef9f27", "#c9922a"];
  const labels = ["", "Weak", "Almost there", "Strong"];
  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ background: i <= score ? colors[score] : "#2a3272" }}
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
              style={{ color: met ? "#c9922a" : "#6b73b0" }}
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

    sessionStorage.removeItem("pm_shuffle_seed"); // ← add
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
  sessionStorage.removeItem("pm_shuffle_seed"); // ← add
  setLoading(true);
  signIn("google", { callbackUrl: "/set-password" });
};
  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-[#0e1140] p-4 sm:p-6">
      <div className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#2a2f6e] shadow-2xl md:flex-row">

        {/* ── Left: Login Panel ─────────────────────────────────────────── */}
        <div className="flex w-full flex-shrink-0 flex-col bg-[#151a4e] px-6 py-8 sm:px-8 md:w-80 md:py-9">

          {/* Brand */}
          <div className="mb-8 text-sm font-black tracking-[3px] text-white">
            PIYU<span className="text-[#c9922a]">MART</span>
          </div>

          {/* Avatar */}
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#2a3070] bg-[#1e2460]">
              <svg width="34" height="34" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="12" r="6" fill="#c9922a" opacity="0.85" />
                <path d="M3 28c0-7.18 5.82-13 13-13s13 5.82 13 13" stroke="#c9922a" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          {/* Headline */}
          <h1 className="mb-1 text-center text-base font-bold text-white">Sign in</h1>
          <p className="mb-5 text-center text-[10px] tracking-[0.5px] text-[#6b73b0]">
            LSPU students only · @lspu.edu.ph
          </p>

          {/* ── Steps card ── */}
          <div className="mb-4 rounded-[14px] border border-[#2a3272] bg-[#1c2260] p-4">
            {[
              { n: 1, title: "First time? Sign in with Google", desc: "Use your LSPU Google account (@lspu.edu.ph) to verify you're a real student.", active: true },
              { n: 2, title: "Set your password",               desc: "After Google sign-in, you'll be asked to create a password for future logins.", active: false },
              { n: 3, title: "Next time, use email + password", desc: 'Once your password is set, just use "Continue with email" below.', active: false },
            ].map((step, i) => (
              <div key={step.n}>
                <div className="flex gap-2.5">
                  <div
                    className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{
                      background: step.active ? "#c9922a" : "#2a3272",
                      color: step.active ? "#fff" : "#6b73b0",
                      boxShadow: step.active ? "0 0 0 3px rgba(201,146,42,0.2)" : "none",
                    }}
                  >
                    {step.n}
                  </div>
                  <div className="flex-1">
                    <p className="text-[11px] font-bold text-[#e8ecff]">{step.title}</p>
                    <p className="mt-0.5 text-[10px] leading-[1.4] text-[#6b73b0]">{step.desc}</p>
                  </div>
                </div>
                {i < 2 && <div className="ml-[9px] my-1 h-2.5 w-px bg-[#2a3272]" />}
              </div>
            ))}
          </div>

          {/* ── Google button ── */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="mb-3 flex h-10 w-full items-center justify-center gap-2.5 rounded-full border border-[#2a3272] bg-[#1c2260] text-xs font-semibold tracking-wide text-[#e8ecff] transition hover:border-[#c9922a] hover:bg-[#1a1f56] active:scale-95 disabled:opacity-50"
          >
            <svg width="15" height="15" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            First time? Continue with Google
          </button>

          {/* Divider */}
          <div className="mb-3 flex items-center gap-2">
            <div className="h-px flex-1 bg-[#2a3272]" />
            <span className="text-[10px] text-[#6b73b0]">returning user</span>
            <div className="h-px flex-1 bg-[#2a3272]" />
          </div>

          {/* ── Email toggle button ── */}
          <button
            type="button"
            onClick={() => setMode((m) => (m === "email" ? "none" : "email"))}
            disabled={loading}
            className="relative flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[#2a3272] bg-[#1c2260] text-xs font-semibold tracking-wide text-[#e8ecff] transition hover:border-[#c9922a] hover:bg-[#1a1f56] active:scale-95 disabled:opacity-50"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="3" width="12" height="9" rx="2" stroke="#6b73b0" strokeWidth="1.4" />
              <path d="M1 5l6 4 6-4" stroke="#6b73b0" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            Sign in with email &amp; password
            <svg
              width="12" height="12" viewBox="0 0 12 12" fill="none"
              className="absolute right-3.5 transition-transform duration-200"
              style={{ transform: mode === "email" ? "rotate(180deg)" : "rotate(0deg)" }}
            >
              <path d="M2 4l4 4 4-4" stroke="#6b73b0" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* ── Email + Password form ── */}
          {mode === "email" && (
            <form onSubmit={handleLogin} className="mt-4 flex flex-col gap-3">
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="1" y="3" width="12" height="9" rx="2" stroke="#6b73b0" strokeWidth="1.4" />
                    <path d="M1 5l6 4 6-4" stroke="#6b73b0" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  type="email"
                  placeholder="yourname@lspu.edu.ph"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  required
                  autoComplete="email"
                  className="h-10 w-full rounded-full border border-[#2a3272] bg-[#1c2260] pl-10 pr-4 text-xs text-[#e8ecff] placeholder-[#6b73b0] outline-none transition focus:border-[#c9922a]"
                />
              </div>

              <div>
                <PasswordInput
                  id="login-pw"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  autoComplete="current-password"
                />
                <StrengthMeter value={password} />
              </div>

              {error && (
                <p className="text-center text-[11px] text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !emailValid || !pwValid}
                className="h-10 w-full rounded-full bg-[#c9922a] text-xs font-bold uppercase tracking-widest text-white transition hover:bg-[#b5821f] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? "Logging in…" : "Login"}
              </button>

              <label className="flex cursor-pointer items-center justify-center gap-1.5 text-[11px] text-[#6b73b0]">
                <input type="checkbox" className="h-3 w-3 accent-[#c9922a]" />
                Remember me
              </label>
            </form>
          )}

          {/* Dots */}
          <div className="mt-auto flex justify-center gap-1.5 pt-6">
            <div className="h-2 w-5 rounded-full bg-[#c9922a]" />
            <div className="h-2 w-2 rounded-full bg-[#2a3272]" />
            <div className="h-2 w-2 rounded-full bg-[#2a3272]" />
          </div>
        </div>

        {/* ── Right: Hero Panel ──────────────────────────────────────────── */}
        <div className="relative hidden flex-1 flex-col overflow-hidden bg-[#1a1f5e] md:flex">

          {/* Grid bg */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(rgba(201,146,42,0.07) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(201,146,42,0.07) 1px, transparent 1px)`,
              backgroundSize: "32px 32px",
              maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)",
              WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)",
            }}
          />

          {/* Decorative rings */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#c9922a26]" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#c9922a1a]" />

          {/* Nav */}
          <nav className="relative z-10 flex items-center justify-end gap-5 px-5 py-4">
            <Link
              href="/about-us"
              className="text-[10px] uppercase tracking-widest text-[#6b73b0] hover:text-white"
            >
              About Us
            </Link>
            <button className="rounded-full bg-[#c9922a] px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-[#b5821f]">
              Sign In
            </button>
          </nav>

          {/* Center logo lockup */}
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-0 px-6 py-4">
            {/* Icon */}
            <div
              className="relative mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-[#c9922a]"
              style={{ boxShadow: "0 8px 32px rgba(201,146,42,0.3)" }}
            >
              <div className="pointer-events-none absolute inset-[-4px] rounded-[24px] border border-[#c9922a59]" />
              <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
                <path d="M8 13h22l-2.5 16H10.5L8 13z" fill="rgba(255,255,255,0.2)" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"/>
                <path d="M14 13v-3a5 5 0 0110 0v3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
                <circle cx="15" cy="20" r="1.2" fill="#fff"/>
                <circle cx="23" cy="20" r="1.2" fill="#fff"/>
              </svg>
            </div>

            {/* Wordmark */}
            <p className="mb-1 text-[28px] font-black tracking-[4px] text-white">
              PIYU<span className="text-[#c9922a]">MART</span>
            </p>
            <p className="mb-5 text-[10px] uppercase tracking-[2px] text-[#6b73b0]">
              Student Marketplace · LSPU
            </p>

            {/* Gold line */}
            <div className="mb-5 h-0.5 w-10 rounded-full bg-[#c9922a]" />

            {/* Badge */}
            <div className="flex items-center gap-1.5 rounded-full border border-[#c9922a40] bg-white/5 px-3.5 py-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-[#c9922a]" />
              <span className="text-[10px] tracking-[0.5px] text-[#b0b8e8]">
                LSPU SPCC Campus · Est. 2024
              </span>
            </div>
          </div>

          {/* Bottom welcome */}
          <div className="relative z-10 p-6 pb-7">
            <h1 className="mb-1.5 text-[30px] font-black leading-none tracking-tight text-white">
              Welcome<span className="text-[#c9922a]">.</span>
            </h1>
            <p className="max-w-[160px] text-[11px] leading-relaxed text-[#6b73b0]">
              Discover student deals on campus. Sign in with your LSPU Google account to get started.
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