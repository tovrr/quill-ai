"use client";

import Link from "next/link";
import {
  ArrowTopRightOnSquareIcon,
  BoltIcon,
  ClockIcon,
  CpuChipIcon,
  FolderIcon,
  RectangleGroupIcon,
} from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type SecondaryRightRailProps = {
  modeLabel: string;
  outputFormatLabel: string;
  isCanvasOpen: boolean;
  isWorking: boolean;
  activeSessions: number;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-quill-border bg-quill-surface/70 p-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-quill-muted">{title}</h3>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

export function SecondaryRightRail({
  modeLabel,
  outputFormatLabel,
  isCanvasOpen,
  isWorking,
  activeSessions,
}: SecondaryRightRailProps) {
  return (
    <aside className="hidden xl:flex h-full w-[320px] shrink-0 flex-col border-l border-quill-border bg-[#0f1218] p-3">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-quill-text">Operations</h2>
        <Link href="/missions" className="text-xs text-quill-muted hover:text-quill-text">
          Mission Inbox
        </Link>
      </div>

      <div className="space-y-3 overflow-y-auto pr-1">
        <Section title="Output">
          <div className="flex items-center gap-2 text-xs text-quill-muted">
            <RectangleGroupIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Format</span>
            <Badge variant="secondary" className="ml-auto bg-quill-surface-2 text-[10px] text-quill-text">
              {outputFormatLabel}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-quill-muted">
            <span>Mode</span>
            <Badge variant="secondary" className="ml-auto bg-quill-surface-2 text-[10px] text-quill-text">
              {modeLabel}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-quill-muted">
            <span>Preview</span>
            <Badge variant="secondary" className="ml-auto bg-quill-surface-2 text-[10px] text-quill-text">
              {isCanvasOpen ? "Open" : "Closed"}
            </Badge>
          </div>
        </Section>

        <Section title="Active Sessions">
          <div className="flex items-center gap-2 text-xs text-quill-muted">
            <BoltIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Running now</span>
            <Badge variant="secondary" className="ml-auto bg-quill-surface-2 text-[10px] text-quill-text">
              {activeSessions}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-quill-muted">
            <ClockIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Status</span>
            <Badge
              variant="secondary"
              className={`ml-auto text-[10px] ${isWorking ? "bg-[rgba(239,68,68,0.15)] text-[#f7b0b0]" : "bg-quill-surface-2 text-quill-text"}`}
            >
              {isWorking ? "Running" : "Idle"}
            </Badge>
          </div>
          <Button asChild type="button" variant="outline" className="w-full justify-between border-quill-border text-xs">
            <Link href="/missions">
              Open mission queue
              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </Button>
        </Section>

        <Section title="Artifacts">
          <Button asChild type="button" variant="outline" className="w-full justify-between border-quill-border text-xs">
            <Link href="/artifacts">
              Browse delivered output
              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </Button>
        </Section>

        <Section title="Memory & Source">
          <Button asChild type="button" variant="outline" className="w-full justify-between border-quill-border text-xs">
            <Link href="/skills">
              Skills and tools
              <CpuChipIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild type="button" variant="outline" className="w-full justify-between border-quill-border text-xs">
            <Link href="/settings">
              Profile and memory
              <FolderIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </Button>
        </Section>
      </div>
    </aside>
  );
}
