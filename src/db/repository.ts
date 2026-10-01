/**
 * Database Repository Layer
 * CRUD operations, deduplication, and query helpers for all entities.
 */

import { v4 as uuid } from "uuid";
import { getDb } from "./database.js";
import { logger } from "../core/logger.js";

const now = () => new Date().toISOString();

// ─── Company Repository ─────────────────────────────────────────────

export interface CompanyRow {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  geography: string | null;
  employee_band: string | null;
  revenue_band: string | null;
  icp_id: string | null;
  fit_score: number | null;
  pain_score: number | null;
  intent_score: number | null;
  timing_score: number | null;
  access_score: number | null;
  offer_fit: number | null;
  total_score: number | null;
  research_summary: string | null;
  evidence: string;
  hubspot_id: string | null;
  source: string | null;
  last_researched_at: string | null;
  created_at: string;
  updated_at: string;
}

export const companyRepo = {
  create(data: Partial<CompanyRow> & { name: string }): CompanyRow {
    const db = getDb();
    const row: CompanyRow = {
      id: data.id ?? uuid(),
      name: data.name,
      domain: data.domain ?? null,
      industry: data.industry ?? null,
      geography: data.geography ?? null,
      employee_band: data.employee_band ?? null,
      revenue_band: data.revenue_band ?? null,
      icp_id: data.icp_id ?? null,
      fit_score: data.fit_score ?? null,
      pain_score: data.pain_score ?? null,
      intent_score: data.intent_score ?? null,
      timing_score: data.timing_score ?? null,
      access_score: data.access_score ?? null,
      offer_fit: data.offer_fit ?? null,
      total_score: data.total_score ?? null,
      research_summary: data.research_summary ?? null,
      evidence: data.evidence ?? "[]",
      hubspot_id: data.hubspot_id ?? null,
      source: data.source ?? null,
      last_researched_at: data.last_researched_at ?? null,
      created_at: now(),
      updated_at: now(),
    };

    db.prepare(`
      INSERT INTO companies (id, name, domain, industry, geography, employee_band, revenue_band, icp_id,
        fit_score, pain_score, intent_score, timing_score, access_score, offer_fit, total_score,
        research_summary, evidence, hubspot_id, source, last_researched_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      row.id, row.name, row.domain, row.industry, row.geography, row.employee_band, row.revenue_band,
      row.icp_id, row.fit_score, row.pain_score, row.intent_score, row.timing_score, row.access_score,
      row.offer_fit, row.total_score, row.research_summary, row.evidence, row.hubspot_id, row.source,
      row.last_researched_at, row.created_at, row.updated_at,
    );

    return row;
  },

  findById(id: string): CompanyRow | undefined {
    return getDb().prepare("SELECT * FROM companies WHERE id = ?").get(id) as CompanyRow | undefined;
  },

  findByDomain(domain: string): CompanyRow | undefined {
    const normalized = normalizeDomain(domain);
    return getDb().prepare("SELECT * FROM companies WHERE domain = ?").get(normalized) as CompanyRow | undefined;
  },

  findByName(name: string): CompanyRow | undefined {
    return getDb().prepare("SELECT * FROM companies WHERE LOWER(name) = LOWER(?)").get(name) as CompanyRow | undefined;
  },

  /** Deduplicated upsert — find by domain first, then name */
  upsert(data: Partial<CompanyRow> & { name: string }): { row: CompanyRow; created: boolean } {
    if (data.domain) {
      const existing = companyRepo.findByDomain(data.domain);
      if (existing) {
        companyRepo.update(existing.id, data);
        return { row: { ...existing, ...data, updated_at: now() }, created: false };
      }
    }

    const byName = companyRepo.findByName(data.name);
    if (byName) {
      companyRepo.update(byName.id, data);
      return { row: { ...byName, ...data, updated_at: now() }, created: false };
    }

    if (data.domain) data.domain = normalizeDomain(data.domain);
    const row = companyRepo.create(data);
    return { row, created: true };
  },

  update(id: string, data: Partial<CompanyRow>): void {
    const fields: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (key === "id" || key === "created_at") continue;
      fields.push(`${key} = ?`);
      values.push(value);
    }
    fields.push("updated_at = ?");
    values.push(now());
    values.push(id);

    getDb().prepare(`UPDATE companies SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  },

  list(opts?: { icpId?: string; minScore?: number; limit?: number; unscoredOnly?: boolean }): CompanyRow[] {
    let sql = "SELECT * FROM companies WHERE 1=1";
    const args: unknown[] = [];

    if (opts?.icpId) { sql += " AND icp_id = ?"; args.push(opts.icpId); }
    if (opts?.minScore) { sql += " AND total_score >= ?"; args.push(opts.minScore); }
    if (opts?.unscoredOnly) { sql += " AND total_score IS NULL"; }
    sql += " ORDER BY total_score DESC NULLS LAST LIMIT ?";
    args.push(opts?.limit ?? 100);

    return getDb().prepare(sql).all(...args) as CompanyRow[];
  },

  count(): number {
    return (getDb().prepare("SELECT COUNT(*) as c FROM companies").get() as { c: number }).c;
  },

  /** Search by name or domain */
  search(query: string): CompanyRow[] {
    const q = `%${query}%`;
    return getDb().prepare(
      "SELECT * FROM companies WHERE name LIKE ? OR domain LIKE ? ORDER BY total_score DESC NULLS LAST LIMIT 20"
    ).all(q, q) as CompanyRow[];
  },
};

// ─── Contact Repository ─────────────────────────────────────────────

export interface ContactRow {
  id: string;
  company_id: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  role_category: string | null;
  email: string | null;
  email_status: string;
  linkedin_url: string | null;
  twitter_url: string | null;
  source: string | null;
  consent_state: string;
  stage: string;
  hubspot_id: string | null;
  last_contacted_at: string | null;
  last_replied_at: string | null;
  created_at: string;
  updated_at: string;
}

export const contactRepo = {
  create(data: Partial<ContactRow> & { company_id: string }): ContactRow {
    const db = getDb();
    const row: ContactRow = {
      id: data.id ?? uuid(),
      company_id: data.company_id,
      first_name: data.first_name ?? null,
      last_name: data.last_name ?? null,
      title: data.title ?? null,
      role_category: data.role_category ?? null,
      email: data.email ?? null,
      email_status: data.email_status ?? "unknown",
      linkedin_url: data.linkedin_url ?? null,
      twitter_url: data.twitter_url ?? null,
      source: data.source ?? null,
      consent_state: data.consent_state ?? "none",
      stage: data.stage ?? "LEAD_DISCOVERY",
      hubspot_id: data.hubspot_id ?? null,
      last_contacted_at: data.last_contacted_at ?? null,
      last_replied_at: data.last_replied_at ?? null,
      created_at: now(),
      updated_at: now(),
    };

    db.prepare(`
      INSERT INTO contacts (id, company_id, first_name, last_name, title, role_category, email, email_status,
        linkedin_url, twitter_url, source, consent_state, stage, hubspot_id, last_contacted_at, last_replied_at,
        created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      row.id, row.company_id, row.first_name, row.last_name, row.title, row.role_category,
      row.email, row.email_status, row.linkedin_url, row.twitter_url, row.source, row.consent_state,
      row.stage, row.hubspot_id, row.last_contacted_at, row.last_replied_at, row.created_at, row.updated_at,
    );

    return row;
  },

  findByEmail(email: string): ContactRow | undefined {
    return getDb().prepare("SELECT * FROM contacts WHERE LOWER(email) = LOWER(?)").get(email) as ContactRow | undefined;
  },

  findByCompany(companyId: string): ContactRow[] {
    return getDb().prepare("SELECT * FROM contacts WHERE company_id = ?").all(companyId) as ContactRow[];
  },

  /** Deduplicated upsert — match by email */
  upsert(data: Partial<ContactRow> & { company_id: string }): { row: ContactRow; created: boolean } {
    if (data.email) {
      const existing = contactRepo.findByEmail(data.email);
      if (existing) {
        contactRepo.update(existing.id, data);
        return { row: { ...existing, ...data, updated_at: now() }, created: false };
      }
    }
    const row = contactRepo.create(data);
    return { row, created: true };
  },

  update(id: string, data: Partial<ContactRow>): void {
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (key === "id" || key === "created_at") continue;
      fields.push(`${key} = ?`);
      values.push(value);
    }
    fields.push("updated_at = ?");
    values.push(now());
    values.push(id);
    getDb().prepare(`UPDATE contacts SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  },

  updateStage(id: string, stage: string): void {
    getDb().prepare("UPDATE contacts SET stage = ?, updated_at = ? WHERE id = ?").run(stage, now(), id);
  },

  listByStage(stage: string, limit = 50): ContactRow[] {
    return getDb().prepare("SELECT * FROM contacts WHERE stage = ? ORDER BY updated_at DESC LIMIT ?").all(stage, limit) as ContactRow[];
  },

  count(): number {
    return (getDb().prepare("SELECT COUNT(*) as c FROM contacts").get() as { c: number }).c;
  },
};

// ─── ICP Repository ─────────────────────────────────────────────────

export interface ICPRow {
  id: string;
  name: string;
  industry: string;
  geography: string | null;
  company_size: string | null;
  business_model: string | null;
  likely_budget: string | null;
  maturity: string | null;
  pain_intensity: string | null;
  urgency: string | null;
  accessibility: string | null;
  service_fit: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

export const icpRepo = {
  create(data: Partial<ICPRow> & { name: string; industry: string }): ICPRow {
    const db = getDb();
    const row: ICPRow = {
      id: data.id ?? uuid(),
      name: data.name,
      industry: data.industry,
      geography: data.geography ?? null,
      company_size: data.company_size ?? null,
      business_model: data.business_model ?? null,
      likely_budget: data.likely_budget ?? null,
      maturity: data.maturity ?? null,
      pain_intensity: data.pain_intensity ?? null,
      urgency: data.urgency ?? null,
      accessibility: data.accessibility ?? null,
      service_fit: data.service_fit ?? null,
      active: data.active ?? 1,
      created_at: now(),
      updated_at: now(),
    };

    db.prepare(`
      INSERT INTO icps (id, name, industry, geography, company_size, business_model, likely_budget,
        maturity, pain_intensity, urgency, accessibility, service_fit, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      row.id, row.name, row.industry, row.geography, row.company_size, row.business_model,
      row.likely_budget, row.maturity, row.pain_intensity, row.urgency, row.accessibility,
      row.service_fit, row.active, row.created_at, row.updated_at,
    );

    return row;
  },

  findById(id: string): ICPRow | undefined {
    return getDb().prepare("SELECT * FROM icps WHERE id = ?").get(id) as ICPRow | undefined;
  },

  listActive(): ICPRow[] {
    return getDb().prepare("SELECT * FROM icps WHERE active = 1 ORDER BY created_at DESC").all() as ICPRow[];
  },

  list(): ICPRow[] {
    return getDb().prepare("SELECT * FROM icps ORDER BY active DESC, created_at DESC").all() as ICPRow[];
  },

  update(id: string, data: Partial<ICPRow>): void {
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (key === "id" || key === "created_at") continue;
      fields.push(`${key} = ?`);
      values.push(value);
    }
    fields.push("updated_at = ?");
    values.push(now());
    values.push(id);
    getDb().prepare(`UPDATE icps SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  },

  count(): number {
    return (getDb().prepare("SELECT COUNT(*) as c FROM icps").get() as { c: number }).c;
  },
};

// ─── Deduplication Helpers ──────────────────────────────────────────

export function normalizeDomain(domain: string): string {
  return domain
    .toLowerCase()
    .replace(/^(https?:\/\/)?(www\.)?/, "")
    .replace(/\/+$/, "")
    .trim();
}

export function normalizeCompanyName(name: string): string {
  return name
    .trim()
    .replace(/\s+(inc\.?|llc\.?|ltd\.?|co\.?|corp\.?|gmbh|sa|srl|ag)$/i, "")
    .toLowerCase();
}

/** Check if a company likely already exists (fuzzy match) */
export function isDuplicateCompany(name: string, domain?: string): CompanyRow | undefined {
  if (domain) {
    const byDomain = companyRepo.findByDomain(domain);
    if (byDomain) return byDomain;
  }

  const normalized = normalizeCompanyName(name);
  const all = getDb().prepare("SELECT * FROM companies").all() as CompanyRow[];
  return all.find((c) => normalizeCompanyName(c.name) === normalized);
}
