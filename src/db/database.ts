/**
 * SQLite database layer for Freelance Revenue OS.
 * Uses better-sqlite3 for synchronous, fast local storage.
 */

import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { logger } from "../core/logger.js";

let db: Database.Database | null = null;

export function getDb(dbPath?: string): Database.Database {
  if (db) return db;

  const resolvedPath = dbPath ?? process.env.DB_PATH ?? "./data/freelance-revenue-os.db";
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(resolvedPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 15000");

  logger.info("Database connected", { path: resolvedPath });
  return db;
}

export function initializeDatabase(dbPath?: string): void {
  const database = getDb(dbPath);

  database.exec(`
    -- Companies
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      domain TEXT,
      industry TEXT,
      geography TEXT,
      employee_band TEXT,
      revenue_band TEXT,
      icp_id TEXT,
      fit_score REAL,
      pain_score REAL,
      intent_score REAL,
      timing_score REAL,
      access_score REAL,
      offer_fit REAL,
      total_score REAL,
      research_summary TEXT,
      evidence TEXT DEFAULT '[]',
      hubspot_id TEXT,
      source TEXT,
      last_researched_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Contacts
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      first_name TEXT,
      last_name TEXT,
      title TEXT,
      role_category TEXT,
      email TEXT,
      email_status TEXT DEFAULT 'unknown',
      linkedin_url TEXT,
      twitter_url TEXT,
      source TEXT,
      consent_state TEXT DEFAULT 'none',
      stage TEXT DEFAULT 'LEAD_DISCOVERY',
      hubspot_id TEXT,
      last_contacted_at TEXT,
      last_replied_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Deals
    CREATE TABLE IF NOT EXISTS deals (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      contact_id TEXT REFERENCES contacts(id),
      offer_id TEXT,
      stage TEXT NOT NULL DEFAULT 'discovery',
      expected_value REAL,
      probability REAL,
      next_action TEXT,
      next_action_at TEXT,
      meeting_date TEXT,
      proposal_date TEXT,
      won_date TEXT,
      lost_reason TEXT,
      revenue REAL DEFAULT 0,
      campaign_id TEXT,
      hubspot_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Campaigns
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icp_id TEXT,
      offer_id TEXT,
      channel TEXT NOT NULL,
      message_version TEXT,
      status TEXT DEFAULT 'draft',
      start_date TEXT,
      end_date TEXT,
      sends INTEGER DEFAULT 0,
      replies INTEGER DEFAULT 0,
      qualified_replies INTEGER DEFAULT 0,
      meetings INTEGER DEFAULT 0,
      proposals INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0,
      revenue REAL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- ICPs
    CREATE TABLE IF NOT EXISTS icps (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      industry TEXT NOT NULL,
      geography TEXT,
      company_size TEXT,
      business_model TEXT,
      likely_budget TEXT,
      maturity TEXT,
      pain_intensity TEXT,
      urgency TEXT,
      accessibility TEXT,
      service_fit TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Events
    CREATE TABLE IF NOT EXISTS events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      actor TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      campaign_id TEXT,
      metadata TEXT DEFAULT '{}',
      correlation_id TEXT,
      causation_id TEXT
    );

    -- Messages (outreach tracking)
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      contact_id TEXT NOT NULL REFERENCES contacts(id),
      campaign_id TEXT REFERENCES campaigns(id),
      channel TEXT NOT NULL,
      direction TEXT NOT NULL DEFAULT 'outbound',
      subject TEXT,
      body TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      sent_at TEXT,
      reply_classification TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
    CREATE INDEX IF NOT EXISTS idx_contacts_stage ON contacts(stage);
    CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain);
    CREATE INDEX IF NOT EXISTS idx_deals_company ON deals(company_id);
    CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
    CREATE INDEX IF NOT EXISTS idx_events_entity ON events(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(contact_id);
    CREATE INDEX IF NOT EXISTS idx_messages_campaign ON messages(campaign_id);
  `);

  logger.info("Database schema initialized");
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
