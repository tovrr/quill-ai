import type { SessionSource } from "@/db/schema";

export const AGENT_MISSION_SOURCES = ["hermes", "openclaw", "agent", "custom"] as const;
export type AgentMissionSource = (typeof AGENT_MISSION_SOURCES)[number];

export function isAgentMissionSource(source: string): source is AgentMissionSource {
  return (AGENT_MISSION_SOURCES as readonly string[]).includes(source);
}

export function isAgentMissionSessionSource(source: SessionSource): source is AgentMissionSource {
  return (AGENT_MISSION_SOURCES as readonly string[]).includes(source);
}