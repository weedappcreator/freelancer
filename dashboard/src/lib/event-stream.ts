/**
 * Server-side event stream for real-time updates.
 * Uses Server-Sent Events (SSE) instead of WebSocket for Vercel compatibility.
 */

type Listener = (data: string) => void;

class EventStream {
  private listeners = new Set<Listener>();

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  broadcast(event: { type: string; data: unknown }) {
    const payload = JSON.stringify(event);
    for (const fn of this.listeners) {
      try { fn(payload); } catch { /* listener gone */ }
    }
  }
}

export const eventStream = new EventStream();
