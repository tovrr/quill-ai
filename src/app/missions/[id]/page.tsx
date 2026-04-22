"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PlayIcon,
} from "@heroicons/react/24/outline";
import { Sidebar } from "@/components/layout/Sidebar";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { findMissionById } from "@/lib/missions/mock-data";

export default function MissionDetailPage() {
  const params = useParams<{ id: string }>();
  const missionId = params?.id;
  const mission = missionId ? findMissionById(missionId) : undefined;

  return (
    <div className="flex h-screen overflow-hidden bg-quill-bg text-quill-text">
      <div className="hidden lg:flex lg:w-72 lg:flex-col lg:shrink-0">
        <Sidebar />
      </div>
      <div className="flex flex-1 min-w-0 flex-col">
        <div className="flex items-center gap-3 border-b border-quill-border px-4 py-3">
          <Link href="/missions" className="rounded-lg p-2 text-quill-muted transition-colors hover:bg-quill-surface hover:text-quill-text">
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold">Mission Detail</h1>
            <p className="truncate text-xs text-quill-muted">Phase 1 shell for orchestration timeline and approvals</p>
          </div>
          <AccountMenu />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!mission ? (
            <div className="rounded-xl border border-quill-border bg-quill-surface p-6 text-center">
              <ExclamationTriangleIcon className="mx-auto h-7 w-7 text-quill-muted" aria-hidden="true" />
              <p className="mt-2 text-sm">Mission not found</p>
              <p className="mt-1 text-xs text-quill-muted">The mission may have completed or been archived.</p>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-4xl space-y-4">
              <section className="rounded-xl border border-quill-border bg-quill-surface p-4">
                <h2 className="text-base font-semibold">{mission.title}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="bg-quill-bg text-[10px] uppercase text-quill-muted">
                    {mission.type}
                  </Badge>
                  <Badge variant="secondary" className="bg-quill-bg text-[10px] uppercase text-quill-muted">
                    {mission.status}
                  </Badge>
                  <span className="text-xs text-quill-muted">Owner: {mission.ownerAgent}</span>
                  <span className="text-xs text-quill-muted">Runtime: {mission.runtimeLabel}</span>
                </div>
              </section>

              <section className="rounded-xl border border-quill-border bg-quill-surface p-4">
                <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-quill-muted">Orchestration Timeline</h3>
                <div className="mt-3 space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <PlayIcon className="mt-0.5 h-4 w-4 text-[#9ff0cd]" aria-hidden="true" />
                    <div>
                      <p className="font-medium">Mission started</p>
                      <p className="text-xs text-quill-muted">Kickoff and context setup completed.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircleIcon className="mt-0.5 h-4 w-4 text-[#b8d3ff]" aria-hidden="true" />
                    <div>
                      <p className="font-medium">Sub-agent handoff</p>
                      <p className="text-xs text-quill-muted">Phase 2 will populate this feed from mission_step records.</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-quill-border bg-quill-surface p-4">
                <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-quill-muted">Linked Outputs</h3>
                <div className="mt-3">
                  <Button asChild type="button" variant="outline" className="border-quill-border text-xs">
                    <Link href="/artifacts" className="inline-flex items-center gap-2">
                      Open artifact history
                      <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
