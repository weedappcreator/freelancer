/**
 * Zod schemas for all core entities in the Revenue OS.
 * Single source of truth for data validation.
 */

import { z } from "zod";

// ─── Lifecycle States ───────────────────────────────────────────────

export const ProspectStage = z.enum([
  "MARKET_DISCOVERY",
  "ICP_SELECTION",
  "BUYING_SIGNAL_DISCOVERY",
  "LEAD_DISCOVERY",
  "IDENTITY_RESOLUTION",
  "ENRICHMENT",
  "QUALIFICATION",
  "ACCOUNT_RESEARCH",
  "PROBLEM_HYPOTHESIS",
  "OFFER_MATCHING",
  "PERSONALIZATION",
  "APPROVAL_GATE",
  "OUTREACH",
  "FOLLOW_UP",
  "REPLY_NEGATIVE",
  "REPLY_NOT_NOW",
  "REPLY_QUESTION",
  "REPLY_INTERESTED",
  "MEETING",
  "OPPORTUNITY",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
  "DELIVERY_HANDOFF",
  "REVENUE_ATTRIBUTION",
  "SUPPRESSED",
]);
export type ProspectStage = z.infer<typeof ProspectStage>;

export const ReplyClassification = z.enum([
  "INTERESTED",
  "QUESTION",
  "REFERRAL",
  "NOT_NOW",
  "NOT_INTERESTED",
  "OPT_OUT",
  "OUT_OF_OFFICE",
  "BOUNCE",
  "SPAM_OR_ABUSE",
  "AMBIGUOUS",
]);

// ─── Company ────────────────────────────────────────────────────────

export const CompanySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  domain: z.string().optional(),
  industry: z.string().optional(),
  geography: z.string().optional(),
  employeeBand: z.string().optional(),
  revenueBand: z.string().optional(),
  icpId: z.string().optional(),
  fitScore: z.number().min(0).max(25).optional(),
  painScore: z.number().min(0).max(25).optional(),
  intentScore: z.number().min(0).max(20).optional(),
  timingScore: z.number().min(0).max(10).optional(),
  accessScore: z.number().min(0).max(10).optional(),
  offerFit: z.number().min(0).max(10).optional(),
  totalScore: z.number().min(0).max(100).optional(),
  researchSummary: z.string().optional(),
  evidence: z.array(z.string()).default([]),
  hubspotId: z.string().optional(),
  source: z.string().optional(),
  lastResearchedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Company = z.infer<typeof CompanySchema>;

// ─── Contact ────────────────────────────────────────────────────────

export const ContactSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  title: z.string().optional(),
  roleCategory: z.string().optional(),
  email: z.string().email().optional(),
  emailStatus: z.enum(["valid", "invalid", "unknown", "catch-all"]).default("unknown"),
  linkedinUrl: z.string().url().optional(),
  twitterUrl: z.string().url().optional(),
  source: z.string().optional(),
  consentState: z.enum(["none", "opted-in", "opted-out", "suppressed"]).default("none"),
  stage: ProspectStage.default("LEAD_DISCOVERY"),
  hubspotId: z.string().optional(),
  lastContactedAt: z.string().datetime().optional(),
  lastRepliedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Contact = z.infer<typeof ContactSchema>;

// ─── Deal / Opportunity ─────────────────────────────────────────────

export const DealSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  contactId: z.string().uuid().optional(),
  offerId: z.string().optional(),
  stage: z.enum(["discovery", "meeting", "proposal", "negotiation", "won", "lost"]),
  expectedValue: z.number().optional(),
  probability: z.number().min(0).max(100).optional(),
  nextAction: z.string().optional(),
  nextActionAt: z.string().datetime().optional(),
  meetingDate: z.string().datetime().optional(),
  proposalDate: z.string().datetime().optional(),
  wonDate: z.string().datetime().optional(),
  lostReason: z.string().optional(),
  revenue: z.number().default(0),
  campaignId: z.string().optional(),
  hubspotId: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Deal = z.infer<typeof DealSchema>;

// ─── Campaign ───────────────────────────────────────────────────────

export const CampaignSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  icpId: z.string().optional(),
  offerId: z.string().optional(),
  channel: z.enum(["email", "linkedin", "instagram", "tiktok", "other"]),
  messageVersion: z.string().optional(),
  status: z.enum(["draft", "active", "paused", "completed"]).default("draft"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sends: z.number().default(0),
  replies: z.number().default(0),
  qualifiedReplies: z.number().default(0),
  meetings: z.number().default(0),
  proposals: z.number().default(0),
  wins: z.number().default(0),
  revenue: z.number().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Campaign = z.infer<typeof CampaignSchema>;

// ─── ICP ────────────────────────────────────────────────────────────

export const ICPSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  industry: z.string(),
  geography: z.string().optional(),
  companySize: z.string().optional(),
  businessModel: z.string().optional(),
  likelyBudget: z.string().optional(),
  maturity: z.string().optional(),
  painIntensity: z.enum(["low", "medium", "high"]).optional(),
  urgency: z.enum(["low", "medium", "high"]).optional(),
  accessibility: z.string().optional(),
  serviceFit: z.string().optional(),
  active: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ICP = z.infer<typeof ICPSchema>;

// ─── Event ──────────────────────────────────────────────────────────

export const EventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string(),
  occurredAt: z.string().datetime(),
  actor: z.string(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  campaignId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  correlationId: z.string().optional(),
  causationId: z.string().optional(),
});
export type Event = z.infer<typeof EventSchema>;
