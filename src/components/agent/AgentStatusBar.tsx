"use client";

export type AgentStatus = "idle" | "thinking" | "running" | "done" | "error";

interface AgentStatusBarProps {
  status: AgentStatus;
  taskTitle?: string;
  stepCount?: number;
  totalSteps?: number;
}

const statusMessages: Record<AgentStatus, string> = {
  idle: "Ready",
  thinking: "Thinking...",
  running: "Working on it...",
  done: "Task complete",
  error: "Something went wrong",
};

const statusColors: Record<AgentStatus, string> = {
  idle: "#6b6b8a",
  thinking: "#a78bfa",
  running: "#7c6af7",
  done: "#34d399",
  error: "#f87171",
};

export function AgentStatusBar({
  status,
  taskTitle,
  stepCount,
  totalSteps,
}: AgentStatusBarProps) {
  const color = statusColors[status];
  const message = statusMessages[status];
  const progress =
    stepCount && totalSteps ? Math.round((stepCount / totalSteps) * 100) : null;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-[#0d0d15] border-b border-[#1e1e2e]">
      {/* Status dot */}
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${
            status === "running" || status === "thinking" ? "animate-pulse" : ""
          }`}
          style={{ background: color }}
        />
        <span className="text-xs font-medium" style={{ color }}>
          {message}
        </span>
      </div>

      {/* Task title */}
      {taskTitle && (
        <>
          <span className="text-[#2a2a3e]">·</span>
          <span className="text-xs text-[#6b6b8a] truncate max-w-xs">
            {taskTitle}
          </span>
        </>
      )}

      {/* Step counter */}
      {stepCount !== undefined && totalSteps !== undefined && (
        <span className="ml-auto text-xs text-[#6b6b8a] shrink-0">
          Step {stepCount}/{totalSteps}
        </span>
      )}

      {/* Progress bar */}
      {progress !== null && (
        <div className="w-20 h-1 bg-[#1e1e2e] rounded-full overflow-hidden shrink-0">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, background: color }}
          />
        </div>
      )}
    </div>
  );
}
