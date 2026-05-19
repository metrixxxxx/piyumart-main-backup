"use client";

import { useState } from "react";

export default function RegisterPage() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    contactNumber: "",
    address: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.email.endsWith("@lspu.edu.ph")) {
      setError("Use your LSPU email only");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        contactNumber: form.contactNumber,
        address: form.address,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.message);
    } else {
      setSuccess("Account created! You can now login.");
    }
  };

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-[#0f1123] p-4 sm:p-6">
      <div className="flex w-full max-w-3xl overflow-hidden rounded-2xl shadow-2xl">

        {/* Left: Hero Panel */}
        <div className="relative hidden flex-col overflow-hidden bg-[#13162b] md:flex md:w-72">
          <nav className="flex items-center justify-end gap-4 px-5 py-4">
            <span className="cursor-pointer text-[10px] uppercase tracking-widest text-[#4a5080] hover:text-white">Home</span>
            <a href="/login" className="rounded-full bg-[#4f8ef7] px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white hover:bg-[#3a7de8]">
              Sign In
            </a>
          </nav>
          <div className="mt-auto p-8">
            <h1 className="mb-3 text-5xl font-bold leading-none tracking-tight text-white">
              Join<span className="text-[#4f8ef7]">.</span>
            </h1>
            <p className="mb-3 max-w-[180px] text-xs leading-relaxed text-[#4a5080]">
              Create your LSPU student account and start exploring campus deals.
            </p>
            <p className="text-[11px] text-[#4a5080]">
              Already have one?{" "}
              <a href="/login" className="text-[#4f8ef7] hover:underline">Sign in here.</a>
            </p>
          </div>
        </div>

        {/* Right: Register Form */}
        <div className="flex flex-1 flex-col bg-[#1a1d35] px-5 py-7 sm:px-8">
          <div className="mb-6 text-sm font-bold tracking-widest text-white">
            PIYU<span className="text-[#4f8ef7]">MART</span>
          </div>

          <h2 className="mb-5 text-base font-semibold text-white">Create your account</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">

            {/* First & Last Name */}
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="5" r="3" stroke="#4a5080" strokeWidth="1.4"/>
                  <path d="M1 13c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="#4a5080" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <input
                  type="text"
                  placeholder="First name"
                  value={form.firstName}
                  onChange={update("firstName")}
                  required
                  className="h-9 w-full rounded-full border border-[#2e3460] bg-[#252a4a] pl-9 pr-3 text-xs text-[#e0e4ff] placeholder-[#4a5080] outline-none transition focus:border-[#4f8ef7]"
                />
              </div>
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="5" r="3" stroke="#4a5080" strokeWidth="1.4"/>
                  <path d="M1 13c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="#4a5080" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <input
                  type="text"
                  placeholder="Last name"
                  value={form.lastName}
                  onChange={update("lastName")}
                  required
                  className="h-9 w-full rounded-full border border-[#2e3460] bg-[#252a4a] pl-9 pr-3 text-xs text-[#e0e4ff] placeholder-[#4a5080] outline-none transition focus:border-[#4f8ef7]"
                />
              </div>
            </div>

            {/* Email */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="13" height="13" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="3" width="12" height="9" rx="2" stroke="#4a5080" strokeWidth="1.4"/>
                <path d="M1 5l6 4 6-4" stroke="#4a5080" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <input
                type="email"
                placeholder="yourname@lspu.edu.ph"
                value={form.email}
                onChange={update("email")}
                required
                className="h-9 w-full rounded-full border border-[#2e3460] bg-[#252a4a] pl-9 pr-4 text-xs text-[#e0e4ff] placeholder-[#4a5080] outline-none transition focus:border-[#4f8ef7]"
              />
            </div>

            

            

            {/* Password & Confirm */}
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <rect x="2" y="6" width="10" height="7" rx="2" stroke="#4a5080" strokeWidth="1.4"/>
                  <path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke="#4a5080" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <input
                  type="password"
                  placeholder="Password"
                  value={form.password}
                  onChange={update("password")}
                  required
                  className="h-9 w-full rounded-full border border-[#2e3460] bg-[#252a4a] pl-9 pr-3 text-xs text-[#e0e4ff] placeholder-[#4a5080] outline-none transition focus:border-[#4f8ef7]"
                />
              </div>
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <rect x="2" y="6" width="10" height="7" rx="2" stroke="#4a5080" strokeWidth="1.4"/>
                  <path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke="#4a5080" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <input
                  type="password"
                  placeholder="Confirm"
                  value={form.confirmPassword}
                  onChange={update("confirmPassword")}
                  required
                  className="h-9 w-full rounded-full border border-[#2e3460] bg-[#252a4a] pl-9 pr-3 text-xs text-[#e0e4ff] placeholder-[#4a5080] outline-none transition focus:border-[#4f8ef7]"
                />
              </div>
            </div>

            {/* Error / Success */}
            {error && <p className="text-center text-[11px] text-red-400">{error}</p>}
            {success && <p className="text-center text-[11px] text-green-400">{success}</p>}

            {/* Submit */}
            <button
              type="submit"
              className="h-10 w-full rounded-full bg-[#4f8ef7] text-xs font-semibold uppercase tracking-widest text-white transition hover:bg-[#3a7de8] active:scale-95"
            >
              Create Account
            </button>

            <p className="text-center text-[11px] text-[#4a5080]">
              Already have an account?{" "}
              <a href="/login" className="text-[#4f8ef7] hover:underline">Sign in</a>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
