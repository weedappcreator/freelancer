import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const campaigns = db
    .prepare("SELECT * FROM campaigns ORDER BY created_at DESC LIMIT 20")
    .all();
  return NextResponse.json(campaigns);
}
