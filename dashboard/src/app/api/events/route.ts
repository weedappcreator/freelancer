import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get("limit") || "50");
  const type = req.nextUrl.searchParams.get("type");

  const db = getDb();
  let rows;
  if (type) {
    rows = db
      .prepare("SELECT * FROM events WHERE event_type = ? ORDER BY occurred_at DESC LIMIT ?")
      .all(type, limit);
  } else {
    rows = db
      .prepare("SELECT * FROM events ORDER BY occurred_at DESC LIMIT ?")
      .all(limit);
  }

  return NextResponse.json(rows);
}
