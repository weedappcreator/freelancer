"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: OverviewIcon },
  { href: "/agents", label: "Agents", icon: AgentsIcon },
  { href: "/pipeline", label: "Pipeline", icon: PipelineIcon },
  { href: "/campaigns", label: "Campaigns", icon: CampaignsIcon },
  { href: "/events", label: "Event Log", icon: EventsIcon },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="w-52 shrink-0 border-r border-[var(--glass-border)] bg-[var(--bg-base)] flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[var(--glass-border)]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[var(--accent)] flex items-center justify-center accent-glow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight" style={{ color: "var(--fg)" }}>
              Revenue OS
            </p>
            <p className="text-[10px] font-medium tracking-widest uppercase" style={{ color: "var(--fg-dim)" }}>
              Control Center
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${isActive ? "active" : ""}`}
            >
              <item.icon active={isActive} />
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Status footer */}
      <div className="px-4 py-3 border-t border-[var(--glass-border)]">
        <div className="flex items-center gap-2">
          <span className="w-[6px] h-[6px] rounded-full bg-[var(--green)] pulse-live" />
          <span className="text-[11px] font-medium" style={{ color: "var(--fg-dim)" }}>
            System Online
          </span>
        </div>
      </div>
    </nav>
  );
}

/* ── SVG Icons (Lucide-style, consistent 16px / stroke 1.5) ── */

function OverviewIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? "var(--accent)" : "currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

function AgentsIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? "var(--accent)" : "currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M20 21a8 8 0 10-16 0" />
    </svg>
  );
}

function PipelineIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? "var(--accent)" : "currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function CampaignsIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? "var(--accent)" : "currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function EventsIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? "var(--accent)" : "currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
