"use client";

import { useEffect, useState } from "react";

interface Campaign {
  id: string; name: string; channel: string; status: string;
  sends: number; replies: number; qualified_replies: number;
  meetings: number; proposals: number; wins: number; revenue: number;
}

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  active:    { color: "var(--green)", bg: "var(--green-glow)" },
  draft:     { color: "var(--fg-dim)", bg: "rgba(255,255,255,0.04)" },
  paused:    { color: "var(--yellow)", bg: "var(--yellow-glow)" },
  completed: { color: "var(--accent)", bg: "var(--accent-subtle)" },
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    fetch("/api/campaigns").then((r) => r.json()).then(setCampaigns);
  }, []);

  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: "var(--fg)" }}>
          Campaigns
        </h1>
        <p className="text-[13px] mt-0.5" style={{ color: "var(--fg-dim)" }}>
          {campaigns.length} campaigns
        </p>
      </div>

      {campaigns.length === 0 ? (
        <div className="glass-panel p-12 text-center">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3" style={{ color: "var(--fg-dim)", opacity: 0.4 }}>
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          <p className="text-sm" style={{ color: "var(--fg-dim)" }}>No campaigns yet</p>
          <p className="text-xs mt-1" style={{ color: "var(--fg-dim)", opacity: 0.6 }}>
            Create a campaign from the CLI to see it here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c, i) => {
            const st = STATUS_STYLE[c.status] || STATUS_STYLE.draft;
            const replyRate = c.sends > 0 ? ((c.replies / c.sends) * 100).toFixed(1) : "0";
            return (
              <div
                key={c.id}
                className={`glass-card p-4 animate-fade-up stagger-${Math.min(i + 1, 8)} cursor-pointer`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <h3 className="text-[13px] font-semibold truncate" style={{ color: "var(--fg)" }}>
                      {c.name || c.id}
                    </h3>
                    <span
                      className="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full shrink-0"
                      style={{ color: st.color, background: st.bg }}
                    >
                      {c.status}
                    </span>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded" style={{ color: "var(--fg-dim)", background: "rgba(255,255,255,0.04)" }}>
                    {c.channel}
                  </span>
                </div>

                {/* Metrics row */}
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-4 text-center">
                  {[
                    { label: "Sends", val: c.sends },
                    { label: "Replies", val: c.replies },
                    { label: "Reply %", val: replyRate + "%" },
                    { label: "Qualified", val: c.qualified_replies },
                    { label: "Meetings", val: c.meetings },
                    { label: "Wins", val: c.wins },
                    { label: "Revenue", val: "$" + (c.revenue || 0).toLocaleString() },
                  ].map((m) => (
                    <div key={m.label}>
                      <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--fg-dim)" }}>{m.label}</p>
                      <p className="text-[13px] font-semibold font-[var(--font-mono)] tabular-nums mt-0.5" style={{ color: "var(--fg)" }}>
                        {m.val}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
