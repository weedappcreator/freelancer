import { NextResponse } from "next/server";
import { agentStore } from "@/lib/agents";

export async function GET() {
  return NextResponse.json(agentStore.getAll());
}
