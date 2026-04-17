"use client";

export type AgentStatus = "idle" | "thinking" | "running" | "done" | "error";

interface AgentStatusBarProps {
  status: AgentStatus;
  taskTitle?: string;
  stepCount?: number;
  totalSteps?: number;
  compact?: boolean;
}

const statusMessages: Record<AgentStatus, string> = {
  idle: "Ready",
  thinking: "Planning...",
  running: "Building...",
  done: "Done — ready to review",
  error: "Ran into an issue",
};

const statusColors: Record<AgentStatus, string> = {
  idle: "#838387",
  thinking: "#F87171",
  running: "#EF4444",
  done: "#34d399",
  error: "#f87171",
};

export function AgentStatusBar({
  status,
  taskTitle,
  stepCount,
  totalSteps,
  compact = false,
}: AgentStatusBarProps) {
  const color = statusColors[status];
  const message = statusMessages[status];
  const hasStepData =
    typeof stepCount === "number" &&
    typeof totalSteps === "number" &&
    totalSteps > 0;
  const progress = hasStepData ? Math.round((stepCount / totalSteps) * 100) : null;

  return (
    <div className={`flex items-center gap-3 bg-[#0d0d15] border-b border-quill-border ${compact ? "px-3 py-1.5" : "px-4 py-2.5"}`}>
      {/* Status dot */}
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${
            status === "running" || status === "thinking" ? "animate-pulse" : ""
          }`}
          style={{ background: color }}
        />
        <span className={`${compact ? "text-[11px]" : "text-xs"} font-medium`} style={{ color }}>
          {message}
        </span>
      </div>

      {/* Task title */}
      {!compact && taskTitle && (
        <>
          <span className="text-quill-border-2">·</span>
          <span className="text-xs text-quill-muted truncate max-w-xs">
            {taskTitle}
          </span>
        </>
      )}

      {/* Step counter */}
      {!compact && stepCount !== undefined && totalSteps !== undefined && (
        <span className="ml-auto text-xs text-quill-muted shrink-0">
          Step {stepCount}/{totalSteps}
        </span>
      )}

      {/* Progress bar */}
      {!compact && progress !== null && (
        <div className="w-20 h-1 bg-quill-border rounded-full overflow-hidden shrink-0">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, background: color }}
          />
        </div>
      )}
    </div>
  );
}
