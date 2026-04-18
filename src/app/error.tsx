"use client";

import { useEffect } from "react";
import Link from "next/link";
import { QuillLogo } from "@/components/ui/QuillLogo";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to an error reporting service in production
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-quill-bg flex items-center justify-center px-4">
      <div className="flex flex-col items-center gap-6 text-center max-w-md">
        <div className="w-14 h-14 rounded-2xl bg-quill-surface border border-quill-border flex items-center justify-center">
          <QuillLogo size={30} />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-quill-text mb-2">Something went wrong</h1>
          <p className="text-sm text-quill-muted leading-relaxed">
            An unexpected error occurred. If this keeps happening, please reach out to support.
          </p>
          {error.digest && (
            <p className="mt-2 text-[11px] text-quill-border-2 font-mono">
              Error ID: {error.digest}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={reset}
            className="h-auto rounded-xl bg-[#EF4444] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#DC2626]"
          >
            Try again
          </Button>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl border border-quill-border hover:border-quill-border-2 text-quill-muted hover:text-quill-text text-sm font-medium transition-all"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
