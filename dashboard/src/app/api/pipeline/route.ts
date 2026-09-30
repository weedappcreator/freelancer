import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();

  const companies = db.prepare("SELECT COUNT(*) as count FROM companies").get() as { count: number };
  const contacts = db.prepare("SELECT COUNT(*) as count FROM contacts").get() as { count: number };

  // Stage breakdown for contacts
  const contactStages = db
    .prepare("SELECT stage, COUNT(*) as count FROM contacts GROUP BY stage ORDER BY count DESC")
    .all() as { stage: string; count: number }[];

  // Deal stages
  const dealStages = db
    .prepare("SELECT stage, COUNT(*) as count, SUM(expected_value) as value FROM deals GROUP BY stage")
    .all() as { stage: string; count: number; value: number }[];

  // Revenue
  const revenue = db
    .prepare("SELECT COALESCE(SUM(revenue), 0) as total FROM deals WHERE stage = 'won'")
    .get() as { total: number };

  // Recent companies
  const recentCompanies = db
    .prepare("SELECT id, name, domain, industry, composite_score, stage FROM companies ORDER BY created_at DESC LIMIT 10")
    .all();

  return NextResponse.json({
    totals: {
      companies: companies.count,
      contacts: contacts.count,
      revenue: revenue.total,
    },
    contactStages,
    dealStages,
    recentCompanies,
  });
}
