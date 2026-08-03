"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GoogleLogo } from "@/components/ui/GoogleLogo";
import { authClient } from "@/lib/auth/client";
import { ArrowPathIcon } from "@heroicons/react/24/outline";

interface GoogleSignInButtonProps {
  size?: "default" | "sm";
  className?: string;
  redirectPath?: string;
}

export function GoogleSignInButton({ size = "default", className, redirectPath = "/" }: GoogleSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);

    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: `${window.location.origin}${redirectPath}`,
      });
    } catch (error) {
      // Better-auth surfaces Google's raw 401 invalid_client etc. as a
      // thrown error. Log it for debugging; the user will see Google's
      // own error page (which is correct — the fix is on the deploy side:
      // GOOGLE_CLIENT_ID/SECRET in Vercel + redirect URI in Google Cloud
      // Console).
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Google sign-in failed:", message);
      setIsLoading(false);
    }
  };

  return (
    <Button
      size={size}
      variant="outline"
      className={`flex items-center gap-2.5 ${className}`}
      onClick={handleGoogleSignIn}
      disabled={isLoading}
    >
      {isLoading ? (
        <ArrowPathIcon className="h-4 w-4 animate-spin" />
      ) : (
        <GoogleLogo className="h-4 w-4 shrink-0" />
      )}
      <span>Continue with Google</span>
    </Button>
  );
}
