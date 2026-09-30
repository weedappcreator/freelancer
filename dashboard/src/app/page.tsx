"use client";

import { useEffect, useState } from "react";
import { useStream } from "@/components/hooks";
import { StatCard, StatCardText } from "@/components/stat-card";
import { AgentGrid } from "@/components/agent-grid";
import { PipelineFunnel } from "@/components/pipeline-funnel";
import { EventFeed } from "@/components/event-feed";

interface PipelineData {
  totals: { companies: number; contacts: number; revenue: number };
  contactStages: { stage: string; count: number }[];
  dealStages: { stage: string; count: number; value: number }[];
  recentCompanies: { id: string; name: string; domain: string; industry: string; composite_score: number; stage: string }[];
}

interface Agent {
  id: string; name: string; role: string;
  status: "idle" | "working" | "error" | "paused";
  currentTask?: string; tokensUsed: number; lastHeartbeat?: string;
}

export default function Overview() {
  const { events: streamEvents, agents: liveAgents, connected } = useStream();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [pipeline, setPipeline] = useState<PipelineData | null>(null);
  const [dbEvents, setDbEvents] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    fetch("/api/agents").then((r) => r.json()).then(setAgents);
    fetch("/api/pipeline").then((r) => r.json()).then(setPipeline);
    fetch("/api/events?limit=20").then((r) => r.json()).then(setDbEvents);
  }, []);

  useEffect(() => {
    if (liveAgents.length > 0) setAgents(liveAgents as Agent[]);
  }, [liveAgents]);

  const working = agents.filter((a) => a.status === "working").length;
  const errored = agents.filter((a) => a.status === "error").length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: "var(--fg)" }}>
            Control Center
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: "var(--fg-dim)" }}>
            What needs attention now?
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-[6px] h-[6px] rounded-full ${connected ? "bg-[var(--green)] pulse-live" : "bg-[var(--red)]"}`} />
          <span className="text-[11px] font-medium" style={{ color: "var(--fg-dim)" }}>
            {connected ? "Live" : "Reconnecting"}
          </span>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-up stagger-2">
        <StatCard label="Companies" value={pipeline?.totals.companies || 0} sub="discovered" accentColor="var(--blue)" />
        <StatCard label="Contacts" value={pipeline?.totals.contacts || 0} sub="in pipeline" accentColor="var(--purple)" />
        <StatCard label="Revenue" value={pipeline?.totals.revenue || 0} prefix="$" sub="won deals" accentColor="var(--green)" />
        <StatCardText
          label="Agents"
          value={`${working} active`}
          sub={errored > 0 ? `${errored} errors` : `${agents.length} total`}
          accentColor={errored > 0 ? "var(--red)" : "var(--accent)"}
        />
      </div>

      {/* Agent Roster */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--fg-dim)" }}>
          Agent Roster
        </h2>
        <AgentGrid agents={agents} />
      </section>

      {/* Pipeline + Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="glass-panel p-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--fg-dim)" }}>
            Deal Pipeline
          </h2>
          <PipelineFunnel stages={pipeline?.dealStages || []} />
        </section>

        <section className="glass-panel p-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--fg-dim)" }}>
            Activity Feed
          </h2>
          <EventFeed
            events={[
              ...streamEvents.map((e) => ({
                type: (e.data as Record<string, unknown>)?.eventType as string,
                ...(e.data as Record<string, unknown>),
              })),
              ...dbEvents,
            ]}
          />
        </section>
      </div>

      {/* Recent Companies */}
      {pipeline?.recentCompanies && pipeline.recentCompanies.length > 0 && (
        <section className="glass-panel p-5 animate-fade-up">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--fg-dim)" }}>
            Recent Companies
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr style={{ color: "var(--fg-dim)" }} className="border-b border-[var(--glass-border)]">
                  <th className="text-left py-2.5 px-3 font-medium uppercase tracking-wider text-[10px]">Name</th>
                  <th className="text-left py-2.5 px-3 font-medium uppercase tracking-wider text-[10px]">Domain</th>
                  <th className="text-left py-2.5 px-3 font-medium uppercase tracking-wider text-[10px]">Industry</th>
                  <th className="text-left py-2.5 px-3 font-medium uppercase tracking-wider text-[10px]">Score</th>
                  <th className="text-left py-2.5 px-3 font-medium uppercase tracking-wider text-[10px]">Stage</th>
                </tr>
              </thead>
              <tbody>
                {pipeline.recentCompanies.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-[var(--glass-border)]"
                    style={{ transition: "background 150ms ease" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td className="py-2.5 px-3 font-medium" style={{ color: "var(--fg)" }}>{c.name || "\u2014"}</td>
                    <td className="py-2.5 px-3" style={{ color: "var(--fg-muted)" }}>{c.domain || "\u2014"}</td>
                    <td className="py-2.5 px-3" style={{ color: "var(--fg-muted)" }}>{c.industry || "\u2014"}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className="font-[var(--font-mono)] text-[11px] px-1.5 py-0.5 rounded tabular-nums"
                        style={{
                          color: (c.composite_score || 0) >= 70 ? "var(--green)" : (c.composite_score || 0) >= 40 ? "var(--yellow)" : "var(--fg-dim)",
                          background: (c.composite_score || 0) >= 70 ? "var(--green-glow)" : "transparent",
                        }}
                      >
                        {c.composite_score ?? "\u2014"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[11px]" style={{ color: "var(--fg-dim)" }}>{c.stage || "\u2014"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
