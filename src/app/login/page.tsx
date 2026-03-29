"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { QuillLogo } from "@/components/ui/QuillLogo";
import { authClient } from "@/lib/auth/client";
import Link from "next/link";

type Tab = "signin" | "signup";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/agent";

  const [tab, setTab] = useState<Tab>("signin");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleTabChange = (t: Tab) => {
    setTab(t);
    setError("");
    setSuccess("");
    setEmail("");
    setName("");
    setPassword("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (tab === "signup") {
        const { error: signUpError } = await authClient.signUp.email({
          email: email.trim(),
          name: name.trim() || email.split("@")[0],
          password,
        });

        if (signUpError) {
          setError(signUpError.message ?? "Registration failed. Please try again.");
          setLoading(false);
          return;
        }
        setSuccess("Account created! Signing you in…");
      }

      const { error: signInError } = await authClient.signIn.email({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(signInError.message ?? "Sign in failed. Please check your credentials and try again.");
        setLoading(false);
      } else {
        router.push(callbackUrl);
      }
    } catch (err) {
      console.error("Auth error:", err);
      setError(err instanceof Error ? err.message : "Something went wrong. Check your connection and try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      {/* Background glow */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-15 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, rgba(239,68,68,0.8) 0%, transparent 70%)", filter: "blur(60px)" }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#111118] border border-[#1e1e2e] flex items-center justify-center mb-4">
            <QuillLogo size={28} />
          </div>
          <h1 className="text-2xl font-bold gradient-text">Welcome to Quill</h1>
          <p className="text-sm text-[#6b6b8a] mt-1 text-center">Your personal AI agent</p>
        </div>

        {/* Card */}
        <div className="bg-[#0d0d15] border border-[#1e1e2e] rounded-2xl p-6">
          {/* Tab switcher */}
          <div className="flex rounded-xl bg-[#111118] p-1 mb-5">
            {(["signin", "signup"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleTabChange(t)}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  tab === t ? "bg-[#1e1e2e] text-[#e8e8f0] shadow-sm" : "text-[#6b6b8a] hover:text-[#a8a8c0]"
                }`}
              >
                {t === "signin" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {tab === "signup" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#6b6b8a]">
                  Name <span className="text-[#3a3a5a]">(optional)</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-[#111118] border border-[#1e1e2e] rounded-xl px-4 py-2.5 text-sm text-[#e8e8f0] placeholder-[#6b6b8a] outline-none focus:border-[rgba(239,68,68,0.5)] focus:shadow-[0_0_0_3px_rgba(239,68,68,0.1)] transition-all"
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#6b6b8a]">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                className="w-full bg-[#111118] border border-[#1e1e2e] rounded-xl px-4 py-2.5 text-sm text-[#e8e8f0] placeholder-[#6b6b8a] outline-none focus:border-[rgba(239,68,68,0.5)] focus:shadow-[0_0_0_3px_rgba(239,68,68,0.1)] transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#6b6b8a]">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                className="w-full bg-[#111118] border border-[#1e1e2e] rounded-xl px-4 py-2.5 text-sm text-[#e8e8f0] placeholder-[#6b6b8a] outline-none focus:border-[rgba(239,68,68,0.5)] focus:shadow-[0_0_0_3px_rgba(239,68,68,0.1)] transition-all"
              />
            </div>

            {error && (
              <p className="text-xs text-[#f87171] bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.2)] rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            {success && (
              <p className="text-xs text-[#34d399] bg-[rgba(52,211,153,0.1)] border border-[rgba(52,211,153,0.2)] rounded-lg px-3 py-2">
                {success}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim() || !password.trim()}
              className="w-full py-2.5 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-[rgba(239,68,68,0.25)] active:scale-[0.98]"
            >
              {loading
                ? tab === "signup" ? "Creating account…" : "Signing in…"
                : tab === "signup" ? "Create account" : "Continue with email"}
            </button>
          </form>

          <p className="text-xs text-[#6b6b8a] text-center mt-4">
            {tab === "signin"
              ? "Enter your email and password to sign in."
              : "Free to use. No credit card required."}
          </p>
        </div>

        {/* Guest */}
        <div className="flex items-center justify-center mt-4">
          <Link href="/agent" className="text-xs text-[#6b6b8a] hover:text-[#a8a8c0] transition-colors">
            Continue without signing in →
          </Link>
        </div>
      </div>
    </div>
  );
}
