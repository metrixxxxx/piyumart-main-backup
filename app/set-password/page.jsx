"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function SetPasswordPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    // Kung may password na, skip na
    if (session?.user?.hasPassword) router.push("/");
  }, [session, status]);

  const handleSubmit = async () => {
    setError("");
    if (password.length < 6) return setError("At least 6 characters");
    if (password !== confirm) return setError("Passwords do not match");

    const res = await fetch("/api/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    const data = await res.json();
    if (!res.ok) return setError(data.message);

    setSuccess("Password set! Redirecting...");
    setTimeout(() => router.push("/"), 1500);
  };

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-[#0f1123] p-4">
      <div className="w-full max-w-sm rounded-2xl bg-[#1a1d35] p-6 sm:p-8">
        <div className="mb-6 text-sm font-bold tracking-widest text-white">
          PIYU<span className="text-[#4f8ef7]">MART</span>
        </div>
        <h2 className="mb-1 text-base font-bold text-white">Set your app password</h2>
        <p className="mb-6 text-xs text-[#4a5080]">
          Set a password so you can also login manually next time using your LSPU email.
        </p>

        <div className="relative mb-3">
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10 w-full rounded-full border border-[#2e3460] bg-[#252a4a] px-4 text-xs text-[#e0e4ff] placeholder-[#4a5080] outline-none focus:border-[#4f8ef7]"
          />
        </div>
        <div className="relative mb-3">
          <input
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="h-10 w-full rounded-full border border-[#2e3460] bg-[#252a4a] px-4 text-xs text-[#e0e4ff] placeholder-[#4a5080] outline-none focus:border-[#4f8ef7]"
          />
        </div>

        {error && <p className="mb-2 text-center text-xs text-red-400">{error}</p>}
        {success && <p className="mb-2 text-center text-xs text-green-400">{success}</p>}

        <button
          onClick={handleSubmit}
          className="h-10 w-full rounded-full bg-[#4f8ef7] text-xs font-semibold uppercase tracking-widest text-white hover:bg-[#3a7de8] active:scale-95"
        >
          Set Password
        </button>

        <button
          onClick={() => router.push("/")}
          className="mt-3 w-full text-center text-xs text-[#4a5080] hover:text-white"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
