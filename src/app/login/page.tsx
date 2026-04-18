"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { QuillLogo } from "@/components/ui/QuillLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const callbackUrl = (() => {
    const raw = searchParams.get("callbackUrl") ?? "/agent";
    // Only allow same-origin relative paths (no protocol-relative or external URLs)
    if (!raw.startsWith("/") || raw.startsWith("//") || raw === "/login") {
      return "/agent";
    }
    return raw;
  })();

  const [tab, setTab] = useState<Tab>("signin");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    authClient.getSession().then((session) => {
      if (cancelled) return;
      if (session?.data?.user) {
        router.replace(callbackUrl);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [callbackUrl, router]);

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
    <div className="min-h-screen bg-quill-bg flex items-center justify-center px-4">
      {/* Background glow */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-150 h-100 rounded-full opacity-15 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, rgba(239,68,68,0.8) 0%, transparent 70%)", filter: "blur(60px)" }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-quill-surface border border-quill-border flex items-center justify-center mb-4">
            <QuillLogo size={28} />
          </div>
          <h1 className="text-2xl font-bold gradient-text">Welcome to Quill</h1>
          <p className="text-sm text-quill-muted mt-1 text-center">Your personal AI agent</p>
        </div>

        {/* Card */}
        <div className="bg-[#0d0d15] border border-quill-border rounded-2xl p-6">
          {/* Tab switcher */}
          <div className="flex rounded-xl bg-quill-surface p-1 mb-5">
            {(["signin", "signup"] as Tab[]).map((t) => (
              <Button
                key={t}
                type="button"
                variant="ghost"
                onClick={() => handleTabChange(t)}
                className={`h-auto flex-1 py-1.5 rounded-lg text-sm font-medium ${
                  tab === t ? "bg-quill-border text-quill-text shadow-sm" : "text-quill-muted hover:text-[#A1A7B0]"
                }`}
              >
                {t === "signin" ? "Sign in" : "Sign up"}
              </Button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {tab === "signup" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-quill-muted">
                  Name <span className="text-[#3a3a5a]">(optional)</span>
                </label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-xl border-quill-border bg-quill-surface px-4 py-2.5 text-sm text-quill-text placeholder-quill-muted"
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-quill-muted">Email address</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                className="w-full rounded-xl border-quill-border bg-quill-surface px-4 py-2.5 text-sm text-quill-text placeholder-quill-muted"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-quill-muted">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                className="w-full rounded-xl border-quill-border bg-quill-surface px-4 py-2.5 text-sm text-quill-text placeholder-quill-muted"
              />
            </div>

            {error && (
              <p className="text-xs text-[#f87171] bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.2)] rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            {success && (
              <p className="text-xs text-quill-green bg-[rgba(52,211,153,0.1)] border border-[rgba(52,211,153,0.2)] rounded-lg px-3 py-2">
                {success}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading || !email.trim() || !password.trim()}
              className="h-auto w-full rounded-xl bg-[#EF4444] py-2.5 text-sm font-semibold text-white shadow-lg shadow-[rgba(239,68,68,0.25)] hover:bg-[#DC2626] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading
                ? tab === "signup" ? "Creating account…" : "Signing in…"
                : tab === "signup" ? "Create account" : "Continue with email"}
            </Button>
          </form>

          <p className="text-xs text-quill-muted text-center mt-4">
            {tab === "signin"
              ? "Enter your email and password to sign in."
              : "Free to use. No credit card required."}
          </p>
        </div>

        {/* Guest */}
        <div className="flex items-center justify-center mt-4">
          <Link href="/agent" className="text-xs text-quill-muted hover:text-[#A1A7B0] transition-colors">
            Continue without signing in →
          </Link>
        </div>
      </div>
    </div>
  );
}
