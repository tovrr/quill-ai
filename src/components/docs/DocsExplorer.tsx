"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface DocsArticle {
  title: string;
  desc: string;
  slug: string;
}

export interface DocsSection {
  category: string;
  color: string;
  articles: DocsArticle[];
}

interface DocsExplorerProps {
  sections: DocsSection[];
}

/**
 * Live, case-insensitive filter on article title + description.
 * Matches when ALL whitespace-separated terms appear somewhere in the
 * combined "title desc" string. Empty query returns everything.
 */
function filterArticles(sections: DocsSection[], query: string): DocsSection[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (terms.length === 0) return sections;

  return sections
    .map((section) => ({
      ...section,
      articles: section.articles.filter((article) => {
        const haystack = `${article.title} ${article.desc}`.toLowerCase();
        return terms.every((term) => haystack.includes(term));
      }),
    }))
    .filter((section) => section.articles.length > 0);
}

export function DocsExplorer({ sections }: DocsExplorerProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const filtered = useMemo(() => filterArticles(sections, deferredQuery), [sections, deferredQuery]);

  const totalArticles = useMemo(() => sections.reduce((acc, s) => acc + s.articles.length, 0), [sections]);
  const matchedArticles = useMemo(() => filtered.reduce((acc, s) => acc + s.articles.length, 0), [filtered]);
  const hasQuery = deferredQuery.trim().length > 0;

  return (
    <>
      {/* Search */}
      <div className="mt-6 max-w-md mx-auto">
        <div className="flex items-center gap-3 px-4 py-1 rounded-xl bg-quill-surface border border-quill-border focus-within:border-quill-border-2 focus-within:bg-quill-surface-2 transition-colors">
          <MagnifyingGlassIcon className="h-3.5 w-3.5 shrink-0 text-quill-muted" aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search docs…"
            aria-label="Search documentation"
            className="flex-1 border-0 bg-transparent px-0 focus-visible:ring-0"
          />
          {hasQuery && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="h-7 w-7 p-0 text-quill-muted"
            >
              <XMarkIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
        {hasQuery && (
          <p className="mt-2 text-xs text-quill-muted text-center" aria-live="polite">
            {matchedArticles === 0
              ? "No articles match your search"
              : `${matchedArticles} of ${totalArticles} ${matchedArticles === 1 ? "article" : "articles"}`}
          </p>
        )}
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-sm text-quill-muted">No matches for &ldquo;{deferredQuery}&rdquo;.</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setQuery("")}
            className="mt-3 text-xs text-quill-accent hover:underline"
          >
            Clear search
          </Button>
        </div>
      ) : (
        <div className="space-y-12">
          {filtered.map((section) => (
            <div key={section.category}>
              {/* Section header */}
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-1 h-5 rounded-full" style={{ background: section.color }} />
                <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: section.color }}>
                  {section.category}
                </h2>
              </div>

              {/* Article grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {section.articles.map((article) => (
                  <Link
                    key={article.slug}
                    href={`/docs/${article.slug}`}
                    className="group flex flex-col gap-1.5 p-4 rounded-xl border border-quill-border bg-quill-surface-2 hover:border-quill-border-2 hover:bg-quill-surface transition-all duration-150"
                  >
                    <p className="text-sm font-medium text-quill-text transition-colors leading-snug">
                      {article.title}
                    </p>
                    <p className="text-xs text-quill-muted leading-relaxed">{article.desc}</p>
                    <span className="mt-1 text-[11px]" style={{ color: section.color }}>Read more →</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
