import Link from "next/link";
import { QuillLogo } from "@/components/ui/QuillLogo";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-quill-bg flex items-center justify-center px-4">
      <div className="flex flex-col items-center gap-6 text-center max-w-md">
        <div className="w-14 h-14 rounded-2xl bg-quill-surface border border-quill-border flex items-center justify-center">
          <QuillLogo size={30} />
        </div>

        <div>
          <p className="text-6xl font-bold text-quill-border mb-4 select-none">404</p>
          <h1 className="text-2xl font-bold text-quill-text mb-2">Page not found</h1>
          <p className="text-sm text-quill-muted leading-relaxed">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/agent"
            className="px-5 py-2.5 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white text-sm font-medium transition-colors"
          >
            Open Quill
          </Link>
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
