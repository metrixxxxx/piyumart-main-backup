"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleLogin() {
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    if (data.success) {
      router.push("/dashboard"); // 👈 go to admin dashboard
    } else {
      setError(data.error || "Invalid credentials");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow w-full max-w-80">
        <h1 className="text-2xl font-bold mb-6 text-center">Admin Login</h1>
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <div className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Admin email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="border rounded-lg px-4 py-2"
          />
          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="border rounded-lg px-4 py-2"
          />
          <button
            onClick={handleLogin}
            className="bg-gray-900 text-white py-2 rounded-lg hover:bg-gray-700"
          >
            Login as Admin
          </button>
        </div>
      </div>
    </div>
  );
}
