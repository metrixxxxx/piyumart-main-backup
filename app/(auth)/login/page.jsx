"use client";

import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import FeedbackModal from "@/components/ui/FeedbackModal";
import LoadingModal from "@/components/ui/LoadingModal";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.endsWith("@lspu.edu.ph")) {
      const message = "Use your LSPU email only";
      setError(message);
      setFeedback({
        type: "error",
        title: "Invalid email",
        description: message,
      });
      return;
    }

    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      const message = "Invalid email or password";
      setError(message);
      setFeedback({
        type: "error",
        title: "Login failed",
        description: message,
      });
      setLoading(false);
    } else {
      const session = await getSession();
      if (session?.user?.role === "admin") {
        router.push("/admin/dashboard");
      } else {
        router.push("/");
      }
    }
  };

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-[#0f1123] p-4 sm:p-6">
      <div className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl shadow-2xl md:flex-row">

        {/* Left: Login Panel */}
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

          {/* Form */}
          <form onSubmit={handleLogin} className="flex flex-col">

            {/* Email */}
            <div className="relative mb-3">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="3" width="12" height="9" rx="2" stroke="#4a5080" strokeWidth="1.4" />
                <path d="M1 5l6 4 6-4" stroke="#4a5080" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <input
                type="email"
                placeholder="yourname@lspu.edu.ph"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10 w-full rounded-full border border-[#2e3460] bg-[#252a4a] pl-10 pr-4 text-xs text-[#e0e4ff] placeholder-[#4a5080] outline-none transition focus:border-[#4f8ef7]"
              />
            </div>

            {/* Password */}
            <div className="relative mb-3">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="2" y="6" width="10" height="7" rx="2" stroke="#4a5080" strokeWidth="1.4" />
                <path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke="#4a5080" strokeWidth="1.4" strokeLinecap="round" />
                <circle cx="7" cy="9.5" r="1" fill="#4a5080" />
              </svg>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-10 w-full rounded-full border border-[#2e3460] bg-[#252a4a] pl-10 pr-4 text-sm text-[#e0e4ff] placeholder-[#4a5080] outline-none transition focus:border-[#4f8ef7]"
              />
            </div>

            {/* Error */}
            {error && (
              <p className="mb-2 text-center text-[11px] text-red-400">{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="mt-1 h-10 w-full rounded-full bg-[#4f8ef7] text-xs font-semibold uppercase tracking-widest text-white transition hover:bg-[#3a7de8] active:scale-95"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
<button
  type="button"
  onClick={() => {
    setLoading(true);
    signIn("google", { callbackUrl: "/set-password" });
  }}
  disabled={loading}
  className="mt-3 h-10 w-full rounded-full border border-[#4f8ef7] bg-transparent text-xs font-semibold uppercase tracking-widest text-[#4f8ef7] transition hover:bg-[#4f8ef7]/10 active:scale-95"
>
  Sign in with Google
</button>

            {/* Footer */}
            <div className="mt-3 flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-[#4a5080]">
                <input type="checkbox" className="h-3 w-3 accent-[#4f8ef7]" />
                Remember me
              </label>
              
            </div>
          </form>

         

          {/* Dots */}
          <div className="mt-auto flex justify-center gap-1.5 pt-6">
            <div className="h-2 w-5 rounded-full bg-[#4f8ef7]" />
            <div className="h-2 w-2 rounded-full bg-[#2e3460]" />
            <div className="h-2 w-2 rounded-full bg-[#2e3460]" />
          </div>
        </div>

        {/* Right: Hero Panel */}
        <div className="relative hidden flex-1 flex-col overflow-hidden bg-[#13162b] md:flex">
          {/* Nav */}
          <nav className="relative z-10 flex items-center justify-end gap-5 px-5 py-4">
            {["About Us"].map((item) => (
              <span key={item} className="cursor-pointer text-[10px] uppercase tracking-widest text-[#4a5080] hover:text-white">
                {item}
              </span>
            ))}
            <button className="rounded-full bg-[#4f8ef7] px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white hover:bg-[#3a7de8]">
              Sign In
            </button>
          </nav>

          {/* Hero */}
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
      <LoadingModal
        open={loading}
        title="Logging in"
        description="Checking your account and preparing your session."
      />
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
