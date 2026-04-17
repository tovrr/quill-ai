type AuditAction =
  | "artifact.version.created"
  | "artifact.version.deleted"
  | "mcp.server.created"
  | "mcp.server.updated"
  | "mcp.server.deleted"
  | "mcp.server.connected"
  | "google.connection.created"
  | "google.connection.deleted"
  | "google.drive.created"
  | "google.drive.updated"
  | "google.drive.deleted"
  | "google.docs.created"
  | "google.docs.updated"
  | "google.workspace.rollback"
  | "skill.installed"
  | "skill.uninstalled"
  | "skill.config_updated";

export function logAuditEvent(input: {
  action: AuditAction;
  userId: string;
  requestId?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}): void {
  console.info(
    JSON.stringify({
      event: "audit.log",
      action: input.action,
      userId: input.userId,
      requestId: input.requestId,
      targetId: input.targetId,
      metadata: input.metadata,
      at: new Date().toISOString(),
    })
  );
}