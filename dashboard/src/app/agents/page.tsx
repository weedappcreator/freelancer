"use client";

import { useEffect, useState } from "react";
import { useStream } from "@/components/hooks";
import { AgentGrid } from "@/components/agent-grid";

interface Agent {
  id: string; name: string; role: string;
  status: "idle" | "working" | "error" | "paused";
  currentTask?: string; tokensUsed: number; lastHeartbeat?: string;
}

export default function AgentsPage() {
  const { agents: liveAgents } = useStream();
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    fetch("/api/agents").then((r) => r.json()).then(setAgents);
  }, []);

  useEffect(() => {
    if (liveAgents.length > 0) setAgents(liveAgents as Agent[]);
  }, [liveAgents]);

  const working = agents.filter((a) => a.status === "working").length;
  const idle = agents.filter((a) => a.status === "idle").length;
  const errored = agents.filter((a) => a.status === "error").length;
  const totalTokens = agents.reduce((sum, a) => sum + a.tokensUsed, 0);

  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: "var(--fg)" }}>
          Agent Roster
        </h1>
        <p className="text-[13px] mt-0.5" style={{ color: "var(--fg-dim)" }}>
          {agents.length} agents registered
        </p>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-6 animate-fade-up stagger-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--green)]" />
          <span className="text-[12px]" style={{ color: "var(--fg-muted)" }}>
            {working} active
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: "var(--fg-dim)" }} />
          <span className="text-[12px]" style={{ color: "var(--fg-muted)" }}>
            {idle} idle
          </span>
        </div>
        {errored > 0 && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--red)]" />
            <span className="text-[12px]" style={{ color: "var(--red)" }}>
              {errored} errors
            </span>
          </div>
        )}
        <div className="ml-auto text-[11px] font-[var(--font-mono)] tabular-nums" style={{ color: "var(--fg-dim)" }}>
          {totalTokens.toLocaleString()} total tokens
        </div>
      </div>

      <AgentGrid agents={agents} />
    </div>
  );
}
