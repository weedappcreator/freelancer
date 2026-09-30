"use client";

interface EventItem {
  event_id?: string;
  event_type?: string;
  type?: string;
  occurred_at?: string;
  actor?: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: string | Record<string, unknown>;
  data?: Record<string, unknown>;
}

const TYPE_ACCENT: Record<string, string> = {
  "company-scored": "var(--blue)",
  "lead-discovered": "var(--accent)",
  "outreach-sent": "var(--purple)",
  "reply-received": "var(--green)",
  "deal-created": "var(--orange)",
  "meeting-booked": "var(--yellow)",
  "proposal-sent": "var(--blue)",
  "deal-won": "var(--green)",
  "deal-lost": "var(--red)",
};

export function EventFeed({ events }: { events: EventItem[] }) {
  if (events.length === 0) {
    return (
      <div className="text-center py-10" style={{ color: "var(--fg-dim)" }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 opacity-40">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        <p className="text-sm">No events yet</p>
        <p className="text-xs mt-1 opacity-60">Agent activity streams here in real-time</p>
      </div>
    );
  }

  return (
    <div className="space-y-px max-h-[420px] overflow-y-auto">
      {events.map((evt, i) => {
        const eventType = evt.event_type || evt.type || "event";
        const color = TYPE_ACCENT[eventType] || "var(--fg-dim)";
        const time = evt.occurred_at
          ? new Date(evt.occurred_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
          : "now";

        return (
          <div
            key={evt.event_id || i}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-[12px]"
            style={{
              background: i === 0 ? "rgba(255,255,255,0.03)" : "transparent",
              transition: "background 200ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = i === 0 ? "rgba(255,255,255,0.03)" : "transparent")}
          >
            {/* Dot indicator */}
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: color }}
            />

            {/* Type */}
            <span className="font-medium truncate" style={{ color: "var(--fg)", minWidth: 100 }}>
              {eventType}
            </span>

            {/* Actor */}
            {evt.actor && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0"
                style={{ color: "var(--accent)", background: "var(--accent-subtle)" }}
              >
                {evt.actor}
              </span>
            )}

            {/* Entity */}
            {evt.entity_type && (
              <span className="truncate hidden sm:block" style={{ color: "var(--fg-dim)" }}>
                {evt.entity_type}
                {evt.entity_id ? ` : ${evt.entity_id.slice(0, 8)}` : ""}
              </span>
            )}

            {/* Time */}
            <span
              className="ml-auto font-[var(--font-mono)] tabular-nums shrink-0"
              style={{ color: "var(--fg-dim)" }}
            >
              {time}
            </span>
          </div>
        );
      })}
    </div>
  );
}
