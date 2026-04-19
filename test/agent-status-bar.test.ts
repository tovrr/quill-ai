import { describe, expect, it } from "vitest";
import {
  AGENT_STATUS_COLORS,
  AGENT_STATUS_MESSAGES,
  getAgentStatusColor,
  getAgentStatusMessage,
  type AgentStatus,
} from "@/components/agent/AgentStatusBar";

describe("agent-status-bar helpers", () => {
  const statuses: AgentStatus[] = ["idle", "thinking", "running", "done", "error"];

  it("returns a message for every status", () => {
    for (const status of statuses) {
      expect(getAgentStatusMessage(status)).toBe(AGENT_STATUS_MESSAGES[status]);
      expect(getAgentStatusMessage(status).length).toBeGreaterThan(0);
    }
  });

  it("returns a color for every status", () => {
    for (const status of statuses) {
      expect(getAgentStatusColor(status)).toBe(AGENT_STATUS_COLORS[status]);
      expect(getAgentStatusColor(status)).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("keeps running and thinking visually distinct", () => {
    expect(getAgentStatusColor("running")).not.toBe(getAgentStatusColor("thinking"));
    expect(getAgentStatusMessage("running")).not.toBe(getAgentStatusMessage("thinking"));
  });
});
