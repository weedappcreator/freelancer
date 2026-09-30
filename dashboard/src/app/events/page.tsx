"use client";

import { useEffect, useState } from "react";
import { useStream } from "@/components/hooks";
import { EventFeed } from "@/components/event-feed";

export default function EventsPage() {
  const { events: streamEvents } = useStream();
  const [dbEvents, setDbEvents] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    fetch("/api/events?limit=100").then((r) => r.json()).then(setDbEvents);
  }, []);

  const allEvents = [
    ...streamEvents.map((e) => ({
      type: (e.data as Record<string, unknown>)?.eventType as string,
      ...(e.data as Record<string, unknown>),
    })),
    ...dbEvents,
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: "var(--fg)" }}>
            Event Log
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: "var(--fg-dim)" }}>
            {allEvents.length} events
          </p>
        </div>
        <button
          onClick={() => fetch("/api/events?limit=100").then((r) => r.json()).then(setDbEvents)}
          className="btn-press text-[11px] font-medium px-3 py-1.5 rounded-lg"
          style={{ color: "var(--accent)", background: "var(--accent-subtle)", border: "1px solid var(--glass-border)" }}
        >
          Refresh
        </button>
      </div>

      <section className="glass-panel p-5">
        <EventFeed events={allEvents} />
      </section>
    </div>
  );
}
