"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/stat-card";
import { PipelineFunnel } from "@/components/pipeline-funnel";

interface PipelineData {
  totals: { companies: number; contacts: number; revenue: number };
  contactStages: { stage: string; count: number }[];
  dealStages: { stage: string; count: number; value: number }[];
  recentCompanies: { id: string; name: string; domain: string; industry: string; composite_score: number; stage: string }[];
}

export default function PipelinePage() {
  const [data, setData] = useState<PipelineData | null>(null);

  useEffect(() => {
    fetch("/api/pipeline").then((r) => r.json()).then(setData);
  }, []);

  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: "var(--fg)" }}>
          Pipeline
        </h1>
        <p className="text-[13px] mt-0.5" style={{ color: "var(--fg-dim)" }}>
          Full commercial pipeline view
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 animate-fade-up stagger-2">
        <StatCard label="Companies" value={data?.totals.companies || 0} accentColor="var(--blue)" />
        <StatCard label="Contacts" value={data?.totals.contacts || 0} accentColor="var(--purple)" />
        <StatCard label="Revenue" value={data?.totals.revenue || 0} prefix="$" accentColor="var(--green)" />
      </div>

      {/* Deal funnel */}
      <section className="glass-panel p-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--fg-dim)" }}>
          Deal Stages
        </h2>
        <PipelineFunnel stages={data?.dealStages || []} />
      </section>

      {/* Contact stages */}
      {data?.contactStages && data.contactStages.length > 0 && (
        <section className="glass-panel p-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--fg-dim)" }}>
            Contact Lifecycle
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {data.contactStages.map((s) => (
              <div key={s.stage} className="glass-card p-3 flex items-center justify-between">
                <span className="text-[11px] font-medium truncate" style={{ color: "var(--fg-muted)" }}>
                  {(s.stage || "unknown").replaceAll("_", " ").toLowerCase()}
                </span>
                <span className="text-[13px] font-semibold font-[var(--font-mono)] tabular-nums ml-2" style={{ color: "var(--fg)" }}>
                  {s.count}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Companies table */}
      {data?.recentCompanies && data.recentCompanies.length > 0 && (
        <section className="glass-panel p-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--fg-dim)" }}>
            Companies
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
                {data.recentCompanies.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-[var(--glass-border)] cursor-pointer"
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
