"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TemplateGallery } from "@/components/templates";
import { Template } from "@/lib/builder/templates";
import { AccountMenu } from "@/components/layout/AccountMenu";

function TemplatesContent() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category") as any || undefined;

  const handleTemplateSelect = (template: Template) => {
    console.log("Selected template:", template);
    // Navigation is handled by the component itself
  };

  return (
    <div className="min-h-screen bg-quill-bg">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-quill-border bg-quill-bg/95 backdrop-blur supports-backdrop-filter:bg-quill-bg/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-quill-muted hover:text-quill-text transition-colors">
              <ArrowLeftIcon className="h-5 w-5" />
              <span className="text-sm font-medium hidden sm:inline">Back to Home</span>
            </Link>
            <div className="h-6 w-px bg-quill-border hidden sm:block" />
            <div>
              <h1 className="text-lg font-semibold">Template Marketplace</h1>
              <p className="text-xs text-quill-muted hidden sm:block">Choose from pre-built templates</p>
            </div>
          </div>
          <AccountMenu />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <TemplateGallery
          onTemplateSelect={handleTemplateSelect}
          selectedCategory={category}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-quill-border px-4 sm:px-6 py-6 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-quill-muted text-center">
            © 2026 Quill AI. Template Marketplace.
          </p>
          <div className="flex gap-4 text-xs text-quill-muted">
            <Link href="/docs" className="hover:text-quill-text transition-colors">
              Documentation
            </Link>
            <Link href="/pricing" className="hover:text-quill-text transition-colors">
              Pricing
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function TemplatesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-quill-bg flex items-center justify-center">
        <div className="text-quill-muted">Loading templates...</div>
      </div>
    }>
      <TemplatesContent />
    </Suspense>
  );
}
