export type MissionType = "app" | "website" | "project" | "document";

export type MissionStatus =
  | "new"
  | "running"
  | "needs-approval"
  | "blocked"
  | "done"
  | "failed"
  | "paused";

export type MissionPriority = "critical" | "high" | "normal" | "low";

export interface Mission {
  id: string;
  title: string;
  type: MissionType;
  status: MissionStatus;
  priority: MissionPriority;
  ownerAgent: string;
  progressStep: string;
  runtimeLabel: string;
  confidence: number;
  updatedAt: string;
}

export interface MissionFilters {
  status?: MissionStatus;
  type?: MissionType;
  query?: string;
}

export interface ActiveMissionSnapshot {
  total: number;
  running: number;
  waitingApproval: number;
}
