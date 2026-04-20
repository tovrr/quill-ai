"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/stripe/types";

const PLAN_CONFIG = {
  pro: PLANS.PRO,
  team: PLANS.TEAM,
} as const;

interface CheckoutButtonProps {
  plan: "pro" | "team";
  size?: "default" | "sm";
  className?: string;
}

export function CheckoutButton({ plan, size = "sm", className }: CheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan }),
      });

      const payload = (await response.json()) as { error?: string; url?: string };

      if (response.status === 401) {
        window.location.href = `/login?callbackUrl=${encodeURIComponent("/pricing")}`;
        return;
      }

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Failed to create checkout session");
      }

      window.location.href = payload.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create checkout session");
      console.error("Checkout error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={className}>
      <Button
        type="button"
        size={size}
        className={`w-full ${isLoading ? "opacity-70 cursor-not-allowed" : ""}`}
        disabled={isLoading}
        onClick={handleCheckout}
      >
        {isLoading ? "Processing..." : `Start ${PLAN_CONFIG[plan].name}`}
      </Button>
      {error && <div className="text-red-400 text-sm mt-2">{error}</div>}
    </div>
  );
}
