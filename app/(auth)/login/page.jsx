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

export default function LoginPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [feedback, setFeedback] = useState(null);
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
      if (session?.user?.role === "admin") {
        try {
          const adminSession = await fetch("/api/admin/session", { method: "POST" });
          if (!adminSession.ok) {
            const data = await adminSession.json();
            throw new Error(data.error || "Unable to open the admin dashboard.");
          }
          router.push("/dashboard");
        } catch (sessionError) {
          const msg = sessionError.message || "Unable to open the admin dashboard.";
          setError(msg);
          setFeedback({ type: "error", title: "Admin access unavailable", description: msg });
          setLoading(false);
        }
      } else {
        router.push(session?.user?.role === "bao" ? "/bao/dashboard" : "/");
      }
    }
  };

  const handleGoogleSignIn = () => {
  sessionStorage.removeItem("pm_shuffle_seed"); // ← add
  setLoading(true);
    signIn("google", { callbackUrl: "/auth/google-callback" });
};
  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-[radial-gradient(ellipse_at_18%_22%,#252d74_0%,#1a2057_46%,#101436_100%)] px-5 py-10 sm:px-8 lg:px-12">
      <div className="grid w-full max-w-[1280px] items-center gap-10 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(420px,460px)] min-[900px]:gap-12">
        <section className="mx-auto w-full max-w-[620px] text-white min-[900px]:mx-0">
          <div className="mb-8 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#e6a51a]">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 8h14l-1.5 12h-11L5 8Z" stroke="#11183f" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M9 8V6a3 3 0 0 1 6 0v2" stroke="#11183f" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <p className="text-[20px] font-black tracking-[2px]">
              PIYU<span className="text-[#e6a51a]">MART</span>
            </p>
          </div>

          <h1 className="max-w-[600px] text-[40px] font-extrabold leading-[1.08] tracking-tight sm:text-[52px]">
            The campus marketplace, <span className="text-[#e6a51a]">made for students.</span>
          </h1>
          <p className="mt-6 max-w-[520px] text-[16px] leading-[1.65] text-[#e1e5ff] sm:text-[17px]">
            Buy, sell and swap with verified LSPU students. Textbooks, gadgets, uniforms, food and services, all in one place.
          </p>

          <div className="mt-8 grid max-w-[440px] grid-cols-3 gap-3">
            {[
              {
                label: "Books",
                icon: <path d="M5 4.5h12a2 2 0 0 1 2 2v13H7a2 2 0 0 1-2-2v-13Zm0 13a2 2 0 0 1 2-2h12" />,
              },
              {
                label: "Gadgets",
                icon: <><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 18h2" /></>,
              },
              {
                label: "Uniforms",
                icon: <path d="m9 4 3 2 3-2 5 3-2 4-2-1v10H8V10l-2 1-2-4 5-3Z" />,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex min-h-[128px] flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.07] text-center"
              >
                <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="#e6a51a" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {item.icon}
                </svg>
                <span className="text-[13px] font-semibold text-white">{item.label}</span>
              </div>
            ))}
          </div>

          <p className="mt-6 flex items-center gap-2 text-[13px] text-[#e1e5ff]">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 1.5 13 3.5v4c0 3.1-2.1 5.5-5 7-2.9-1.5-5-3.9-5-7v-4l5-2Z" stroke="#e6a51a" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="m6 7.5 1.3 1.3L10 6" stroke="#e6a51a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Student-only: sign-in is checked against @lspu.edu.ph
          </p>
        </section>

        <section className="mx-auto w-full max-w-[460px] rounded-[20px] bg-white px-7 py-8 text-[#11183f] shadow-[0_24px_70px_rgba(4,8,35,0.28)] sm:px-9 sm:py-9">
          <h2 className="text-[26px] font-bold leading-tight">Sign in</h2>
          <p className="mt-1.5 text-[13px] text-[#65718f]">LSPU students only · @lspu.edu.ph</p>

          <div className="mt-4 flex items-center gap-2 text-[12px] text-[#465275]">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#11183f] text-[10px] font-bold text-white">1</span>
            <span className="whitespace-nowrap">Verify with Google</span>
            <span className="h-px flex-1 bg-[#d9ddec]" />
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e9ecf5] text-[10px] font-bold text-[#35405f]">2</span>
            <span className="whitespace-nowrap">Set a password</span>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#e6a51a] text-[14px] font-bold text-[#11183f] transition hover:bg-[#d9960d] active:scale-[0.99] disabled:opacity-50"
          >
            <svg width="15" height="15" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            First time? Continue with Google
          </button>

          <div className="my-5 flex items-center gap-2">
            <span className="h-px flex-1 bg-[#d9ddec]" />
            <span className="text-[12px] text-[#65718f]">returning user</span>
            <span className="h-px flex-1 bg-[#d9ddec]" />
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-[13px] font-medium">School email</label>
              <input
                id="login-email"
                type="email"
                placeholder="yourname@lspu.edu.ph"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                required
                autoComplete="email"
                className="h-11 w-full rounded-lg border border-[#b8bfd7] bg-white px-3 text-sm text-[#11183f] placeholder-[#7180a3] outline-none transition focus:border-[#e5a51b] focus:ring-2 focus:ring-[#e5a51b]/20"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label htmlFor="login-pw" className="text-[13px] font-medium">Password</label>
                <Link href="/forgotpass" className="text-[13px] text-[#9a6800] underline underline-offset-2 hover:text-[#704b00]">
                  Forgot password?
                </Link>
              </div>
              <PasswordInput
                id="login-pw"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p role="alert" className="text-center text-[11px] text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !emailValid || !pwValid}
              className="mt-0.5 h-12 w-full rounded-lg bg-[#11183f] text-sm font-bold text-white transition hover:bg-[#1d285d] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {loading ? "Logging in…" : "Sign in"}
            </button>
          </form>
        </section>
      </div>

      <LoadingModal open={loading} title="Logging in" description="Checking your account and preparing your session." />
      <FeedbackModal
        open={Boolean(feedback)}
        type={feedback?.type}
        title={feedback?.title}
        description={feedback?.description}
        onClose={() => setFeedback(null)}
      />
    </main>
  );
}