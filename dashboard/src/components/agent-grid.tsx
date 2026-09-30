"use client";

interface Agent {
  id: string;
  name: string;
  role: string;
  status: "idle" | "working" | "error" | "paused";
  currentTask?: string;
  tokensUsed: number;
  lastHeartbeat?: string;
}

const STATUS = {
  idle:    { color: "var(--fg-dim)", bg: "transparent", label: "Idle", glow: "" },
  working: { color: "var(--green)", bg: "var(--green-glow)", label: "Active", glow: "green-glow" },
  error:   { color: "var(--red)", bg: "var(--red-glow)", label: "Error", glow: "" },
  paused:  { color: "var(--yellow)", bg: "var(--yellow-glow)", label: "Paused", glow: "" },
};

export function AgentGrid({ agents }: { agents: Agent[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {agents.map((agent, i) => {
        const s = STATUS[agent.status] || STATUS.idle;
        return (
          <div
            key={agent.id}
            className={`glass-card p-3.5 animate-fade-up stagger-${Math.min(i + 1, 8)}`}
            style={{ borderLeftWidth: 2, borderLeftColor: s.color }}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="min-w-0">
                <h3 className="text-[13px] font-semibold truncate" style={{ color: "var(--fg)" }}>
                  {agent.name}
                </h3>
                <p className="text-[11px]" style={{ color: "var(--fg-dim)" }}>
                  {agent.role}
                </p>
              </div>
              <span
                className="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full shrink-0 ml-2"
                style={{ color: s.color, background: s.bg }}
              >
                {agent.status === "working" && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full mr-1 pulse-live" style={{ background: s.color }} />
                )}
                {s.label}
              </span>
            </div>

            {agent.currentTask && (
              <p className="text-[11px] truncate mb-2" style={{ color: "var(--fg-muted)" }}>
                {agent.currentTask}
              </p>
            )}

            <div className="flex items-center justify-between text-[10px]" style={{ color: "var(--fg-dim)" }}>
              <span className="font-[var(--font-mono)] tabular-nums">
                {agent.tokensUsed.toLocaleString()} tok
              </span>
              {agent.lastHeartbeat && (
                <span>{new Date(agent.lastHeartbeat).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
