"use client";

import { useEffect, useState } from "react";
import { getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LoadingModal from "@/components/ui/LoadingModal";

export default function GoogleSignInCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    getSession()
      .then(async (session) => {
        if (!active) return;
        if (!session) {
          setError(true);
          return;
        }

        if (session.user?.isFirstGoogleSignIn) {
          router.replace("/set-password");
          return;
        }

        if (session.user?.role === "admin") {
          const response = await fetch("/api/admin/session", { method: "POST" });
          if (!response.ok) {
            throw new Error("Admin access could not be verified.");
          }
          if (active) router.replace("/dashboard");
          return;
        }

        router.replace(session.user?.role === "bao" ? "/bao/dashboard" : "/");
      })
      .catch((err) => {
        console.error("Google sign-in session check failed:", err);
        if (active) setError(true);
      });

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f0eeff] p-6 dark:bg-[#070b14]">
      {error ? (
        <div role="alert" className="w-full max-w-sm rounded-2xl bg-white p-7 text-center shadow-xl dark:bg-[#111827]">
          <h1 className="text-lg font-bold text-[#11183f] dark:text-white">
            Google sign-in could not be completed
          </h1>
          <p className="mt-2 text-sm text-[#65718f] dark:text-[#aab4cf]">
            Please return to sign in and try again.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-flex rounded-lg bg-[#11183f] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1d285d]"
          >
            Return to sign in
          </Link>
        </div>
      ) : (
        <LoadingModal
          open
          title="Finishing Google sign-in"
          description="Checking your account and preparing the next step."
        />
      )}
    </main>
  );
}
