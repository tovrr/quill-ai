"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
      console.error("Google sign in error:", error);
      setIsLoading(false);
    }
  };

  return (
    <Button
      size={size}
      variant="outline"
      className={`flex items-center gap-2 ${className}`}
      onClick={handleGoogleSignIn}
      disabled={isLoading}
    >
      {isLoading ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <span>Continue with Google</span>}
    </Button>
  );
}
