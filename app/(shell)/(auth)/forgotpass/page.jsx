"use client";

import ActionFeedback from "@/components/ui/ActionFeedback";
import { useState } from "react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true); setError(""); setMessage("");

    try {
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Unable to send a reset link. Please try again.");
    setMessage(data.message || "If the account exists, a reset link will be sent to your email.");
    } catch (failure) { setError(failure.message || "Unable to send a reset link. Check your connection."); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <h1>Forgot Password</h1>

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Enter email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <button type="submit" disabled={loading}>{loading ? "Sending..." : "Send Reset Link"}</button>
      </form>

      <p>{message}</p>
    <ActionFeedback pending={loading} error={error} success={message} pendingTitle="Sending your reset link" successTitle="Check your email" />
      </div>
  );
}
