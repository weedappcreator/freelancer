"use client";

import { useScrollReveal } from "./hooks";

interface StageData {
  stage: string;
  count: number;
  value?: number;
}

const STAGE_COLORS: Record<string, string> = {
  discovery: "var(--blue)",
  meeting: "var(--purple)",
  proposal: "var(--orange)",
  negotiation: "var(--yellow)",
  won: "var(--green)",
  lost: "var(--red)",
};

export function PipelineFunnel({ stages }: { stages: StageData[] }) {
  const reveal = useScrollReveal();

  if (stages.length === 0) {
    return (
      <div className="text-center py-10" style={{ color: "var(--fg-dim)" }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 opacity-40">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
        <p className="text-sm">No deals in pipeline yet</p>
        <p className="text-xs mt-1 opacity-60">Run agents to discover opportunities</p>
      </div>
    );
  }

  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div ref={reveal.ref} style={reveal.style} className="space-y-2.5">
      {stages.map((stage, i) => {
        const pct = (stage.count / maxCount) * 100;
        const color = STAGE_COLORS[stage.stage] || "var(--accent)";
        return (
          <div key={stage.stage} className="flex items-center gap-3 group">
            <span
              className="text-[11px] font-medium w-24 text-right capitalize truncate"
              style={{ color: "var(--fg-muted)" }}
            >
              {stage.stage}
            </span>
            <div
              className="flex-1 rounded-md overflow-hidden"
              style={{ background: "rgba(255,255,255,0.04)", height: 28 }}
            >
              <div
                className="h-full rounded-md flex items-center px-2.5"
                style={{
                  width: `${Math.max(pct, 10)}%`,
                  background: color,
                  opacity: 0.85,
                  transition: `width 0.6s cubic-bezier(0.16,1,0.3,1) ${i * 80}ms`,
                }}
              >
                <span className="text-[11px] font-semibold text-white tabular-nums">
                  {stage.count}
                </span>
              </div>
            </div>
            {stage.value != null && (
              <span
                className="text-[11px] font-[var(--font-mono)] tabular-nums w-20 text-right"
                style={{ color: "var(--fg-dim)" }}
              >
                ${(stage.value || 0).toLocaleString()}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
