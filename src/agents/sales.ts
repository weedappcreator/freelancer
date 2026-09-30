/**
 * Sales Agent
 * Prepares meeting briefs, discovery questions, objection handling,
 * opportunity notes, and post-call follow-up drafts.
 */

import { BaseAgent } from "./base.js";
import { type LLMRegistry } from "../providers/llm.js";
import { getOperatorContext } from "../core/operator.js";
import { companyRepo, contactRepo } from "../db/repository.js";
import { events } from "../events/emitter.js";
import { getDb } from "../db/database.js";

export interface SalesInput {
  action: "meeting-brief" | "discovery-questions" | "objection-handling" | "post-call" | "opportunity-notes";
  companyId: string;
  contactId?: string;
  meetingNotes?: string;
  objections?: string[];
  dealContext?: string;
}

export interface MeetingBrief {
  companyName: string;
  contactName: string;
  contactTitle: string;
  companyBackground: string;
  observableProblem: string;
  ourMatch: string;
  discoveryQuestions: string[];
  painHypotheses: string[];
  objectionPrep: Array<{ objection: string; response: string }>;
  doNotClaim: string[];
  idealOutcome: string;
  nextStepIfPositive: string;
  nextStepIfUnclear: string;
}

export interface PostCallOutput {
  summary: string;
  painConfirmed: string[];
  painRejected: string[];
  newInsights: string[];
  nextActions: string[];
  followUpDraft: string;
  dealStageRecommendation: string;
  crmUpdates: Record<string, string>;
}

export interface SalesOutput {
  action: string;
  companyId: string;
  meetingBrief?: MeetingBrief;
  postCall?: PostCallOutput;
  discoveryQuestions?: string[];
  objectionHandling?: Array<{ objection: string; response: string }>;
  opportunityNotes?: string;
  summary: string;
}

export function createSalesAgent(llm: LLMRegistry) {
  return new (class extends BaseAgent<SalesInput, SalesOutput> {
    constructor() {
      super({
        name: "sales-agent",
        description: "Meeting prep, discovery, objection handling, post-call follow-up",
        systemPrompt: `You are a Sales Intelligence Agent. You prepare the operator for sales conversations.

OPERATOR CONTEXT:
${getOperatorContext().slice(0, 2000)}

YOUR JOB:
- Prepare thorough meeting briefs so the operator walks in informed
- Generate discovery questions that uncover real problems
- Prepare objection responses that are honest and specific
- After calls, extract insights and draft follow-ups
- Track opportunity progress

RULES:
- Never script the operator — prepare them, don't puppet them
- Discovery questions should be open-ended and problem-focused
- Objection handling should acknowledge, not dismiss
- Never promise outcomes we can't deliver
- Post-call follow-up should be sent within 24 hours
- Always recommend a clear next step`,
        llm,
        temperature: 0.3,
        maxTokens: 3000,
      });
    }

    async execute(input: SalesInput): Promise<{ data: SalesOutput; tokensUsed: number }> {
      switch (input.action) {
        case "meeting-brief":
          return this.prepareMeetingBrief(input);
        case "discovery-questions":
          return this.generateDiscoveryQuestions(input);
        case "objection-handling":
          return this.prepareObjectionHandling(input);
        case "post-call":
          return this.processPostCall(input);
        case "opportunity-notes":
          return this.generateOpportunityNotes(input);
        default:
          return { data: { action: input.action, companyId: input.companyId, summary: `Unknown action: ${input.action}` }, tokensUsed: 0 };
      }
    }

    async prepareMeetingBrief(input: SalesInput): Promise<{ data: SalesOutput; tokensUsed: number }> {
      const company = companyRepo.findById(input.companyId);
      if (!company) throw new Error(`Company ${input.companyId} not found`);

      const contacts = contactRepo.findByCompany(input.companyId);
      const contact = input.contactId
        ? contacts.find((c) => c.id === input.contactId) ?? contacts[0]
        : contacts[0];

      const prompt = `Prepare a meeting brief for this upcoming sales conversation:

Company: ${company.name}
Domain: ${company.domain ?? "unknown"}
Industry: ${company.industry ?? "unknown"}
Size: ${company.employee_band ?? "unknown"}
Score: ${company.total_score ?? "?"}/100
Research: ${company.research_summary ?? "minimal"}

Contact: ${contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""} — ${contact.title ?? "?"}` : "unknown"}

Context: ${input.dealContext ?? "initial discovery call"}

Return JSON:
{
  "companyBackground": "string — what we know about them",
  "observableProblem": "string — the specific problem we've identified",
  "ourMatch": "string — why we're relevant to this problem",
  "discoveryQuestions": ["string — 5-8 open-ended questions to uncover their real situation"],
  "painHypotheses": ["string — 3-4 hypotheses about their pain to validate"],
  "objectionPrep": [{"objection": "string", "response": "string"}],
  "doNotClaim": ["string — things we must NOT say"],
  "idealOutcome": "string — what we want from this meeting",
  "nextStepIfPositive": "string — CTA if they're interested",
  "nextStepIfUnclear": "string — CTA if they need more time"
}`;

      const response = await this.chat([{ role: "user", content: prompt }], { jsonMode: true });
      let brief: MeetingBrief;
      try {
        const parsed = JSON.parse(response.content);
        brief = {
          companyName: company.name,
          contactName: contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "unknown",
          contactTitle: contact?.title ?? "unknown",
          ...parsed,
        };
      } catch {
        const match = response.content.match(/\{[\s\S]*\}/);
        const parsed = match ? JSON.parse(match[0]) : {};
        brief = {
          companyName: company.name,
          contactName: contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "unknown",
          contactTitle: contact?.title ?? "unknown",
          companyBackground: parsed.companyBackground ?? "",
          observableProblem: parsed.observableProblem ?? "",
          ourMatch: parsed.ourMatch ?? "",
          discoveryQuestions: parsed.discoveryQuestions ?? [],
          painHypotheses: parsed.painHypotheses ?? [],
          objectionPrep: parsed.objectionPrep ?? [],
          doNotClaim: parsed.doNotClaim ?? [],
          idealOutcome: parsed.idealOutcome ?? "",
          nextStepIfPositive: parsed.nextStepIfPositive ?? "",
          nextStepIfUnclear: parsed.nextStepIfUnclear ?? "",
        };
      }

      await events.emit({
        eventType: "meeting.prepared",
        actor: "sales-agent",
        entityType: "company",
        entityId: input.companyId,
        metadata: { contact: brief.contactName },
      });

      return {
        data: {
          action: "meeting-brief",
          companyId: input.companyId,
          meetingBrief: brief,
          summary: `Meeting brief prepared for ${company.name} — ${brief.discoveryQuestions.length} discovery questions, ${brief.objectionPrep.length} objections prepped`,
        },
        tokensUsed: response.usage.totalTokens,
      };
    }

    async generateDiscoveryQuestions(input: SalesInput): Promise<{ data: SalesOutput; tokensUsed: number }> {
      const company = companyRepo.findById(input.companyId);
      if (!company) throw new Error(`Company ${input.companyId} not found`);

      const prompt = `Generate 8-10 discovery questions for a sales call with ${company.name} (${company.industry ?? "unknown industry"}).
Research: ${company.research_summary ?? "minimal"}
Context: ${input.dealContext ?? "initial discovery"}

Return JSON: { "questions": ["string"] }

Focus on uncovering:
- Current process and pain
- Cost of the problem
- Previous attempts to solve it
- Decision-making process
- Timeline and urgency`;

      const response = await this.chat([{ role: "user", content: prompt }], { jsonMode: true });
      let questions: string[];
      try {
        questions = JSON.parse(response.content).questions;
      } catch {
        questions = [];
      }

      return {
        data: {
          action: "discovery-questions",
          companyId: input.companyId,
          discoveryQuestions: questions,
          summary: `${questions.length} discovery questions generated for ${company.name}`,
        },
        tokensUsed: response.usage.totalTokens,
      };
    }

    async prepareObjectionHandling(input: SalesInput): Promise<{ data: SalesOutput; tokensUsed: number }> {
      const company = companyRepo.findById(input.companyId);
      if (!company) throw new Error(`Company ${input.companyId} not found`);

      const objections = input.objections ?? [
        "We already have someone doing this",
        "We don't have the budget right now",
        "We need to think about it",
        "Can you send more information?",
        "We're too busy right now",
      ];

      const prompt = `Prepare responses to these objections for ${company.name} (${company.industry ?? "unknown"}):
${objections.map((o, i) => `${i + 1}. "${o}"`).join("\n")}

Context: ${company.research_summary ?? "minimal"}

Return JSON: { "responses": [{"objection": "string", "response": "string — honest, specific, under 3 sentences"}] }

Rules:
- Acknowledge the objection genuinely
- Never dismiss or pressure
- Be specific to their situation
- Offer a low-risk next step`;

      const response = await this.chat([{ role: "user", content: prompt }], { jsonMode: true });
      let responses: Array<{ objection: string; response: string }>;
      try {
        responses = JSON.parse(response.content).responses;
      } catch {
        responses = [];
      }

      return {
        data: {
          action: "objection-handling",
          companyId: input.companyId,
          objectionHandling: responses,
          summary: `${responses.length} objection responses prepared for ${company.name}`,
        },
        tokensUsed: response.usage.totalTokens,
      };
    }

    async processPostCall(input: SalesInput): Promise<{ data: SalesOutput; tokensUsed: number }> {
      if (!input.meetingNotes) throw new Error("meetingNotes required for post-call processing");

      const company = companyRepo.findById(input.companyId);
      if (!company) throw new Error(`Company ${input.companyId} not found`);

      const prompt = `Process these meeting notes and generate follow-up:

Company: ${company.name}
Notes:
"""
${input.meetingNotes}
"""

Return JSON:
{
  "summary": "string — 2-3 sentence meeting summary",
  "painConfirmed": ["string — pains that were validated"],
  "painRejected": ["string — hypotheses that were wrong"],
  "newInsights": ["string — things we learned"],
  "nextActions": ["string — concrete next steps"],
  "followUpDraft": "string — email follow-up (under 150 words, reference specific things discussed)",
  "dealStageRecommendation": "string — OPPORTUNITY | PROPOSAL | NURTURE | REJECTED",
  "crmUpdates": {"field": "value — what to update in CRM"}
}`;

      const response = await this.chat([{ role: "user", content: prompt }], { jsonMode: true });
      let postCall: PostCallOutput;
      try {
        postCall = JSON.parse(response.content);
      } catch {
        const match = response.content.match(/\{[\s\S]*\}/);
        postCall = match ? JSON.parse(match[0]) : {
          summary: "", painConfirmed: [], painRejected: [], newInsights: [],
          nextActions: [], followUpDraft: "", dealStageRecommendation: "NURTURE", crmUpdates: {},
        };
      }

      // Update company research with meeting insights
      companyRepo.update(input.companyId, {
        research_summary: `${company.research_summary ?? ""} | Meeting: ${postCall.summary}`.slice(0, 500),
      });

      // Create deal if recommended
      if (postCall.dealStageRecommendation === "OPPORTUNITY" || postCall.dealStageRecommendation === "PROPOSAL") {
        try {
          const db = getDb();
          db.prepare(
            `INSERT OR IGNORE INTO deals (id, company_id, stage, next_action, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).run(
            crypto.randomUUID(),
            input.companyId,
            postCall.dealStageRecommendation,
            postCall.nextActions[0] ?? "Follow up",
            new Date().toISOString(),
            new Date().toISOString()
          );
        } catch { /* deal may already exist */ }
      }

      await events.emit({
        eventType: "meeting.completed",
        actor: "sales-agent",
        entityType: "company",
        entityId: input.companyId,
        metadata: { stage: postCall.dealStageRecommendation, painsConfirmed: postCall.painConfirmed.length },
      });

      return {
        data: {
          action: "post-call",
          companyId: input.companyId,
          postCall,
          summary: `Post-call processed: ${postCall.dealStageRecommendation} — ${postCall.nextActions.length} next actions`,
        },
        tokensUsed: response.usage.totalTokens,
      };
    }

    async generateOpportunityNotes(input: SalesInput): Promise<{ data: SalesOutput; tokensUsed: number }> {
      const company = companyRepo.findById(input.companyId);
      if (!company) throw new Error(`Company ${input.companyId} not found`);

      // Get deal if exists
      let dealInfo = "";
      try {
        const db = getDb();
        const deal = db.prepare(`SELECT * FROM deals WHERE company_id = ? ORDER BY updated_at DESC LIMIT 1`).get(input.companyId) as Record<string, unknown> | undefined;
        if (deal) {
          dealInfo = `Stage: ${deal.stage} | Value: ${deal.expected_value ?? "TBD"} | Next: ${deal.next_action ?? "none"}`;
        }
      } catch { /* no deal */ }

      const prompt = `Generate opportunity notes for ${company.name}:
Research: ${company.research_summary ?? "minimal"}
Score: ${company.total_score ?? "?"}/100
Deal: ${dealInfo || "no active deal"}
Context: ${input.dealContext ?? ""}

Return JSON: { "notes": "string — comprehensive opportunity summary for CRM" }`;

      const response = await this.chat([{ role: "user", content: prompt }], { jsonMode: true });
      let notes = "";
      try {
        notes = JSON.parse(response.content).notes;
      } catch { notes = response.content; }

      return {
        data: {
          action: "opportunity-notes",
          companyId: input.companyId,
          opportunityNotes: notes,
          summary: `Opportunity notes generated for ${company.name}`,
        },
        tokensUsed: response.usage.totalTokens,
      };
    }
  })();
}
