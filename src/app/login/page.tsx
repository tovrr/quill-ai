"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { QuillLogo } from "@/components/ui/QuillLogo";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email: email.trim(),
      password: "demo",
      redirect: false,
    });

    if (result?.error) {
      setError("Sign in failed. Please try again.");
      setLoading(false);
    } else {
      router.push("/agent");
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      {/* Background glow */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-15 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(124,106,247,0.8) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#111118] border border-[#1e1e2e] flex items-center justify-center mb-4">
            <QuillLogo size={28} />
          </div>
          <h1 className="text-2xl font-bold gradient-text">Welcome to Quill</h1>
          <p className="text-sm text-[#6b6b8a] mt-1">
            Your personal AI agent
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#0d0d15] border border-[#1e1e2e] rounded-2xl p-6">
          <h2 className="text-base font-semibold text-[#e8e8f0] mb-5">
            Sign in to continue
          </h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#6b6b8a]">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-[#111118] border border-[#1e1e2e] rounded-xl px-4 py-2.5 text-sm text-[#e8e8f0] placeholder-[#6b6b8a] outline-none focus:border-[rgba(124,106,247,0.5)] focus:shadow-[0_0_0_3px_rgba(124,106,247,0.1)] transition-all"
              />
            </div>

            {error && (
              <p className="text-xs text-[#f87171] bg-[rgba(248,113,113,0.1)] rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full py-2.5 rounded-xl bg-[#7c6af7] hover:bg-[#6b58e8] text-white text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-[rgba(124,106,247,0.25)] active:scale-[0.98]"
            >
              {loading ? "Signing in..." : "Continue with email"}
            </button>
          </form>

          <p className="text-xs text-[#6b6b8a] text-center mt-4">
            No password needed — enter any email to get started.
          </p>
        </div>

        {/* Skip / guest */}
        <div className="flex items-center justify-center mt-4">
          <Link
            href="/agent"
            className="text-xs text-[#6b6b8a] hover:text-[#a8a8c0] transition-colors"
          >
            Continue without signing in →
          </Link>
        </div>
      </div>
    </div>
  );
}
