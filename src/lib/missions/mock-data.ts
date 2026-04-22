import type { ActiveMissionSnapshot, Mission } from "@/lib/missions/types";

export const MOCK_MISSIONS: Mission[] = [
  {
    id: "m-001",
    title: "Launch B2B landing page and copy system",
    type: "website",
    status: "running",
    priority: "high",
    ownerAgent: "Code Wizard",
    progressStep: "Building hero and pricing sections",
    runtimeLabel: "9m",
    confidence: 0.86,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "m-002",
    title: "Refactor onboarding flow and analytics events",
    type: "app",
    status: "needs-approval",
    priority: "critical",
    ownerAgent: "Flow Master",
    progressStep: "Waiting on deployment approval",
    runtimeLabel: "14m",
    confidence: 0.78,
    updatedAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
  },
  {
    id: "m-003",
    title: "Generate artifact bundle for investor update",
    type: "document",
    status: "done",
    priority: "normal",
    ownerAgent: "Pen Master",
    progressStep: "Delivered to artifact history",
    runtimeLabel: "6m",
    confidence: 0.91,
    updatedAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
  {
    id: "m-004",
    title: "Migrate project settings and locks",
    type: "project",
    status: "blocked",
    priority: "normal",
    ownerAgent: "Deep Dive",
    progressStep: "Blocked by missing env key",
    runtimeLabel: "4m",
    confidence: 0.64,
    updatedAt: new Date(Date.now() - 1000 * 60 * 150).toISOString(),
  },
];

export const MOCK_ACTIVE_SNAPSHOT: ActiveMissionSnapshot = {
  total: MOCK_MISSIONS.filter((mission) => mission.status === "running" || mission.status === "needs-approval").length,
  running: MOCK_MISSIONS.filter((mission) => mission.status === "running").length,
  waitingApproval: MOCK_MISSIONS.filter((mission) => mission.status === "needs-approval").length,
};

export function findMissionById(id: string): Mission | undefined {
  return MOCK_MISSIONS.find((mission) => mission.id === id);
}
