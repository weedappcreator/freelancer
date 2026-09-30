import { NextRequest, NextResponse } from "next/server";
import { agentStore } from "@/lib/agents";
import { eventStream } from "@/lib/event-stream";

/**
 * POST /api/heartbeat
 * Accepts heartbeats from the PaperclipBridge or CLI agents.
 * Body: { agent: string, status, currentTask?, tokensUsed?, event? }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { agent, status, currentTask, tokensUsed, event } = body;

  if (agent) {
    agentStore.update(agent, {
      status: status || "working",
      currentTask,
      ...(tokensUsed != null ? { tokensUsed } : {}),
    });
    eventStream.broadcast({ type: "agent-update", data: agentStore.getAll() });
  }

  if (event) {
    eventStream.broadcast({ type: "event", data: event });
  }

  return NextResponse.json({ ok: true });
}
