/**
 * Email Agent + Reply Classifier
 * Manages email sequences — drafts, sends (when approved), classifies replies.
 * Handles follow-up timing and sequence logic.
 */

import { BaseAgent } from "./base.js";
import { type LLMRegistry } from "../providers/llm.js";
import { companyRepo, contactRepo } from "../db/repository.js";
import { events } from "../events/emitter.js";
import { logger } from "../core/logger.js";
import { getDb } from "../db/database.js";

export interface EmailInput {
  action: "draft" | "classify" | "sequence-status" | "followup";
  contactId?: string;
  companyId?: string;
  subject?: string;
  body?: string;
  replyText?: string;
  channel?: "email" | "linkedin";
}

export interface EmailDraft {
  id: string;
  contactId: string;
  companyId: string;
  channel: string;
  subject: string;
  body: string;
  sequenceStep: number;
  status: "draft" | "approved" | "sent" | "bounced";
  scheduledAt?: string;
  sentAt?: string;
}

export type ReplyClassification =
  | "positive_interest"
  | "meeting_request"
  | "question"
  | "referral"
  | "not_now"
  | "unsubscribe"
  | "out_of_office"
  | "bounce"
  | "objection"
  | "negative";

export interface ClassifyResult {
  classification: ReplyClassification;
  confidence: number;
  sentiment: string;
  suggestedAction: string;
  suggestedReply?: string;
  shouldFollowUp: boolean;
  followUpDelayDays?: number;
  notes: string;
}

export interface EmailOutput {
  action: string;
  drafts?: EmailDraft[];
  classification?: ClassifyResult;
  sequenceStatus?: {
    contactId: string;
    totalSteps: number;
    currentStep: number;
    lastSentAt?: string;
    nextFollowUpAt?: string;
    status: string;
  };
  summary: string;
}

export function createEmailAgent(llm: LLMRegistry) {
  return new (class extends BaseAgent<EmailInput, EmailOutput> {
    constructor() {
      super({
        name: "email-agent",
        description: "Drafts emails, manages sequences, classifies replies",
        systemPrompt: `You are an Email Management Agent. You handle three tasks:

1. DRAFT — Create follow-up emails in a sequence
2. CLASSIFY — Classify incoming replies and suggest next action
3. FOLLOWUP — Determine if and when to follow up

REPLY CLASSIFICATION CATEGORIES:
- positive_interest: wants to learn more, asks for details
- meeting_request: explicitly asks for a meeting/call
- question: asks a question but no clear interest signal
- referral: redirects to someone else
- not_now: timing not right but not negative
- unsubscribe: wants off the list
- out_of_office: auto-reply, OOO
- bounce: delivery failure
- objection: pushes back on premise/relevance
- negative: hostile, do-not-contact

FOLLOW-UP SEQUENCE TIMING:
- Step 1: Initial outreach (Day 0)
- Step 2: Value-add follow-up (Day 3-4) — share insight, not "just checking in"
- Step 3: Different angle (Day 7-8) — new proof point or perspective
- Step 4: Break-up email (Day 14) — graceful close, leave door open
- MAX 4 touches per sequence

FOLLOW-UP RULES:
- Never say "just following up" or "just checking in"
- Each follow-up must add NEW value or a new angle
- After "unsubscribe" or "negative" — STOP immediately
- After "not_now" — add to nurture, follow up in 30-60 days
- After "referral" — thank, start new sequence with referred person
- After "objection" — address once, then respect the decision`,
        llm,
        temperature: 0.3,
        maxTokens: 2000,
      });
    }

    async execute(input: EmailInput): Promise<{ data: EmailOutput; tokensUsed: number }> {
      switch (input.action) {
        case "draft":
          return this.draftFollowUp(input);
        case "classify":
          return this.classifyReply(input);
        case "sequence-status":
          return this.getSequenceStatus(input);
        case "followup":
          return this.checkFollowUps();
        default:
          return { data: { action: input.action, summary: `Unknown action: ${input.action}` }, tokensUsed: 0 };
      }
    }

    async draftFollowUp(input: EmailInput): Promise<{ data: EmailOutput; tokensUsed: number }> {
      if (!input.contactId) throw new Error("contactId required for drafting");

      const contact = contactRepo.findByEmail(input.contactId) ??
        (() => { const contacts = contactRepo.findByCompany(input.companyId ?? ""); return contacts.find((c) => c.id === input.contactId) ?? contacts[0]; })();

      if (!contact) throw new Error(`Contact not found: ${input.contactId}`);

      const company = companyRepo.findById(contact.company_id);
      const existingMessages = this.getMessageHistory(contact.id);
      const currentStep = existingMessages.length + 1;

      if (currentStep > 4) {
        return {
          data: {
            action: "draft",
            drafts: [],
            summary: `Sequence complete for ${contact.email ?? contact.id} — max 4 touches reached.`,
          },
          tokensUsed: 0,
        };
      }

      const prompt = `Draft follow-up #${currentStep} for this prospect:

Contact: ${contact.first_name ?? ""} ${contact.last_name ?? ""} (${contact.title ?? "unknown"})
Email: ${contact.email ?? "unknown"}
Company: ${company?.name ?? "unknown"}
Industry: ${company?.industry ?? "unknown"}

Previous messages in sequence:
${existingMessages.map((m, i) => `Step ${i + 1}: ${m.subject ?? "no subject"}`).join("\n") || "None — this is the first touch"}

Research: ${company?.research_summary ?? "minimal"}

Sequence step ${currentStep} of 4. ${currentStep === 4 ? "This is the BREAK-UP email — graceful close." : "Add NEW value, don't repeat."}

Return JSON:
{
  "subject": "string",
  "body": "string — under 150 words",
  "tone": "string"
}`;

      const response = await this.chat([{ role: "user", content: prompt }], { jsonMode: true });
      let parsed: { subject: string; body: string; tone?: string };
      try {
        parsed = JSON.parse(response.content);
      } catch {
        const match = response.content.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : { subject: "", body: "" };
      }

      const draft: EmailDraft = {
        id: crypto.randomUUID(),
        contactId: contact.id,
        companyId: contact.company_id,
        channel: input.channel ?? "email",
        subject: parsed.subject,
        body: parsed.body,
        sequenceStep: currentStep,
        status: "draft",
      };

      // Save draft to messages table
      this.saveDraft(draft);

      await events.emit({
        eventType: "email.drafted",
        actor: "email-agent",
        entityType: "contact",
        entityId: contact.id,
        metadata: { step: currentStep, subject: draft.subject },
      });

      return {
        data: {
          action: "draft",
          drafts: [draft],
          summary: `Drafted step ${currentStep} for ${contact.first_name ?? contact.email ?? contact.id}`,
        },
        tokensUsed: response.usage.totalTokens,
      };
    }

    async classifyReply(input: EmailInput): Promise<{ data: EmailOutput; tokensUsed: number }> {
      if (!input.replyText) throw new Error("replyText required for classification");

      const prompt = `Classify this email reply:

"""
${input.replyText}
"""

Return JSON:
{
  "classification": "positive_interest|meeting_request|question|referral|not_now|unsubscribe|out_of_office|bounce|objection|negative",
  "confidence": 0.0-1.0,
  "sentiment": "string",
  "suggestedAction": "string — what should we do next",
  "suggestedReply": "string|null — draft reply if appropriate",
  "shouldFollowUp": true/false,
  "followUpDelayDays": number|null,
  "notes": "string"
}`;

      const response = await this.chat([{ role: "user", content: prompt }], { jsonMode: true });
      let classification: ClassifyResult;
      try {
        classification = JSON.parse(response.content);
      } catch {
        const match = response.content.match(/\{[\s\S]*\}/);
        classification = match
          ? JSON.parse(match[0])
          : {
              classification: "question" as ReplyClassification,
              confidence: 0.5,
              sentiment: "neutral",
              suggestedAction: "Review manually",
              shouldFollowUp: false,
              notes: "Failed to parse LLM response",
            };
      }

      // Update contact stage based on classification
      if (input.contactId) {
        const stageMap: Record<string, string> = {
          positive_interest: "MEETING",
          meeting_request: "MEETING",
          question: "OUTREACH",
          referral: "OUTREACH",
          not_now: "NURTURE",
          unsubscribe: "OPTED_OUT",
          negative: "REJECTED",
          objection: "OUTREACH",
        };
        const newStage = stageMap[classification.classification];
        if (newStage) {
          contactRepo.updateStage(input.contactId, newStage);
        }
      }

      await events.emit({
        eventType: "reply.classified",
        actor: "email-agent",
        entityType: "contact",
        entityId: input.contactId ?? "unknown",
        metadata: {
          classification: classification.classification,
          confidence: classification.confidence,
          shouldFollowUp: classification.shouldFollowUp,
        },
      });

      return {
        data: {
          action: "classify",
          classification,
          summary: `Reply classified as "${classification.classification}" (${Math.round(classification.confidence * 100)}% confidence). ${classification.suggestedAction}`,
        },
        tokensUsed: response.usage.totalTokens,
      };
    }

    async getSequenceStatus(input: EmailInput): Promise<{ data: EmailOutput; tokensUsed: number }> {
      if (!input.contactId) throw new Error("contactId required for sequence status");

      const messages = this.getMessageHistory(input.contactId);
      const lastSent = messages.filter((m) => m.status === "sent").pop();

      return {
        data: {
          action: "sequence-status",
          sequenceStatus: {
            contactId: input.contactId,
            totalSteps: 4,
            currentStep: messages.length,
            lastSentAt: lastSent?.sent_at,
            status: messages.length >= 4 ? "completed" : messages.length > 0 ? "in_progress" : "not_started",
          },
          summary: `Sequence for ${input.contactId}: step ${messages.length}/4`,
        },
        tokensUsed: 0,
      };
    }

    async checkFollowUps(): Promise<{ data: EmailOutput; tokensUsed: number }> {
      // Find contacts in OUTREACH stage that need follow-ups
      const outreachContacts = contactRepo.listByStage("OUTREACH");
      const dueForFollowUp: string[] = [];

      for (const contact of outreachContacts) {
        const messages = this.getMessageHistory(contact.id);
        if (messages.length >= 4) continue; // sequence complete

        const lastMessage = messages[messages.length - 1];
        if (!lastMessage) continue;

        const lastSentDate = new Date(lastMessage.sent_at ?? lastMessage.created_at);
        const daysSince = (Date.now() - lastSentDate.getTime()) / (1000 * 60 * 60 * 24);

        // Follow-up timing: step 2 at day 3, step 3 at day 7, step 4 at day 14
        const nextStep = messages.length + 1;
        const thresholds: Record<number, number> = { 2: 3, 3: 7, 4: 14 };
        if (daysSince >= (thresholds[nextStep] ?? 3)) {
          dueForFollowUp.push(contact.id);
        }
      }

      return {
        data: {
          action: "followup",
          summary: `${dueForFollowUp.length} contacts due for follow-up out of ${outreachContacts.length} in outreach stage.`,
        },
        tokensUsed: 0,
      };
    }

    /** Get message history for a contact from the messages table */
    getMessageHistory(contactId: string): Array<{
      subject?: string;
      body?: string;
      status: string;
      step: number;
      sent_at?: string;
      created_at: string;
    }> {
      try {
        const db = getDb();
        const rows = db
          .prepare(
            `SELECT * FROM messages WHERE contact_id = ? ORDER BY created_at ASC`
          )
          .all(contactId) as Array<Record<string, unknown>>;

        return rows.map((r) => ({
          subject: r.subject as string | undefined,
          body: r.body as string | undefined,
          status: (r.status as string) ?? "draft",
          step: (r.sequence_step as number) ?? 1,
          sent_at: r.sent_at as string | undefined,
          created_at: (r.created_at as string) ?? new Date().toISOString(),
        }));
      } catch {
        return [];
      }
    }

    /** Save a draft to the messages table */
    saveDraft(draft: EmailDraft): void {
      try {
        const db = getDb();
        db.prepare(
          `INSERT INTO messages (id, contact_id, company_id, channel, direction, subject, body, sequence_step, status, created_at)
           VALUES (?, ?, ?, ?, 'outbound', ?, ?, ?, ?, ?)`
        ).run(
          draft.id,
          draft.contactId,
          draft.companyId,
          draft.channel,
          draft.subject,
          draft.body,
          draft.sequenceStep,
          draft.status,
          new Date().toISOString()
        );
      } catch (err) {
        logger.warn(`Failed to save draft: ${err instanceof Error ? err.message : String(err)}`, {}, "email-agent");
      }
    }
  })();
}
