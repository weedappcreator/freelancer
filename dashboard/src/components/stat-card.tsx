"use client";

import { useCountUp } from "./hooks";

export function StatCard({
  label,
  value,
  prefix = "",
  suffix = "",
  sub,
  accentColor = "var(--accent)",
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  sub?: string;
  accentColor?: string;
}) {
  const { count, ref } = useCountUp(value);

  return (
    <div ref={ref} className="glass-card stat-card p-4 hover-lift">
      <p
        className="text-[11px] font-medium uppercase tracking-wider mb-2"
        style={{ color: "var(--fg-dim)" }}
      >
        {label}
      </p>
      <p className="text-2xl font-semibold font-[var(--font-mono)] tabular-nums" style={{ color: accentColor }}>
        {prefix}{count.toLocaleString()}{suffix}
      </p>
      {sub && (
        <p className="text-[11px] mt-1.5" style={{ color: "var(--fg-dim)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

/** Simple text stat for non-numeric values */
export function StatCardText({
  label,
  value,
  sub,
  accentColor = "var(--accent)",
}: {
  label: string;
  value: string;
  sub?: string;
  accentColor?: string;
}) {
  return (
    <div className="glass-card stat-card p-4 hover-lift">
      <p
        className="text-[11px] font-medium uppercase tracking-wider mb-2"
        style={{ color: "var(--fg-dim)" }}
      >
        {label}
      </p>
      <p className="text-2xl font-semibold" style={{ color: accentColor }}>
        {value}
      </p>
      {sub && (
        <p className="text-[11px] mt-1.5" style={{ color: "var(--fg-dim)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}
