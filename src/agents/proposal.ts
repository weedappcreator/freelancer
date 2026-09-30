/**
 * Proposal Agent
 * Generates scoped proposals based on verified discovery data.
 * Never invents pricing if no pricing policy exists.
 */

import { BaseAgent } from "./base.js";
import { type LLMRegistry } from "../providers/llm.js";
import { getOperatorContext } from "../core/operator.js";
import { companyRepo, contactRepo } from "../db/repository.js";
import { events } from "../events/emitter.js";
import { getDb } from "../db/database.js";

export interface ProposalInput {
  companyId: string;
  contactId?: string;
  discoveredPains?: string[];
  agreedScope?: string;
  budget?: string;
  timeline?: string;
  meetingNotes?: string;
}

export interface ProposalOutput {
  companyId: string;
  companyName: string;
  proposalTitle: string;
  problem: string;
  desiredOutcome: string;
  scope: string;
  deliverables: string[];
  approach: string;
  timeline: string;
  dependencies: string[];
  assumptions: string[];
  exclusions: string[];
  investment: string;
  paymentTerms: string;
  nextStep: string;
  validUntil: string;
  fullProposal: string;
}

export function createProposalAgent(llm: LLMRegistry) {
  return new (class extends BaseAgent<ProposalInput, ProposalOutput> {
    constructor() {
      super({
        name: "proposal-agent",
        description: "Generates scoped proposals from discovery data",
        systemPrompt: `You are a Proposal Agent. You generate clear, scoped proposals based on verified discovery data.

OPERATOR CONTEXT:
${getOperatorContext().slice(0, 2500)}

PROPOSAL STRUCTURE:
1. Problem — what we're solving (their words, not ours)
2. Desired Outcome — what success looks like
3. Scope — what's included, bounded clearly
4. Deliverables — concrete outputs
5. Approach — how we'll do it (high-level)
6. Timeline — realistic schedule
7. Dependencies — what we need from them
8. Assumptions — what we're assuming is true
9. Exclusions — what's NOT included (prevents scope creep)
10. Investment — pricing if available, otherwise "to be discussed"
11. Payment Terms — milestone-based when possible
12. Next Step — clear acceptance path

RULES:
- Never invent pricing if no pricing policy exists in operator context
- Scope must be specific enough to hold both parties accountable
- Include exclusions to prevent scope creep
- Timeline should be realistic, not optimistic
- Use the prospect's own language for the problem
- Deliverables must be concrete and verifiable
- If budget was discussed, price within that range
- The proposal should be sendable as-is (professional formatting)`,
        llm,
        temperature: 0.2,
        maxTokens: 4000,
      });
    }

    async execute(input: ProposalInput): Promise<{ data: ProposalOutput; tokensUsed: number }> {
      const company = companyRepo.findById(input.companyId);
      if (!company) throw new Error(`Company ${input.companyId} not found`);

      const contacts = contactRepo.findByCompany(input.companyId);
      const contact = input.contactId
        ? contacts.find((c) => c.id === input.contactId) ?? contacts[0]
        : contacts[0];

      // Get deal context if exists
      let dealContext = "";
      try {
        const db = getDb();
        const deal = db.prepare(`SELECT * FROM deals WHERE company_id = ? ORDER BY updated_at DESC LIMIT 1`).get(input.companyId) as Record<string, unknown> | undefined;
        if (deal) {
          dealContext = `Deal stage: ${deal.stage} | Expected value: ${deal.expected_value ?? "TBD"} | Next action: ${deal.next_action ?? "none"}`;
        }
      } catch { /* no deal */ }

      const prompt = `Generate a professional proposal for this opportunity:

Company: ${company.name}
Domain: ${company.domain ?? "unknown"}
Industry: ${company.industry ?? "unknown"}
Size: ${company.employee_band ?? "unknown"}
Score: ${company.total_score ?? "?"}/100

Contact: ${contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""} — ${contact.title ?? "?"}` : "unknown"}

Research: ${company.research_summary ?? "minimal"}
${dealContext ? `Deal: ${dealContext}` : ""}

Discovered pains: ${(input.discoveredPains ?? []).join("; ") || "from research only"}
Agreed scope: ${input.agreedScope ?? "not yet agreed — propose based on research"}
Budget indication: ${input.budget ?? "not discussed"}
Timeline: ${input.timeline ?? "not discussed"}
Meeting notes: ${input.meetingNotes ?? "none"}

Return JSON:
{
  "proposalTitle": "string",
  "problem": "string — in their language",
  "desiredOutcome": "string — measurable if possible",
  "scope": "string — bounded and specific",
  "deliverables": ["string — concrete outputs"],
  "approach": "string — how we'll execute",
  "timeline": "string — realistic schedule",
  "dependencies": ["string — what we need from them"],
  "assumptions": ["string — what we're assuming"],
  "exclusions": ["string — what's NOT included"],
  "investment": "string — pricing or 'to be discussed in scoping call'",
  "paymentTerms": "string — milestone-based if applicable",
  "nextStep": "string — acceptance path",
  "validUntil": "string — proposal validity period",
  "fullProposal": "string — the complete formatted proposal text ready to send"
}`;

      const response = await this.chat([{ role: "user", content: prompt }], { jsonMode: true });

      let data: ProposalOutput;
      try {
        const parsed = JSON.parse(response.content);
        data = { companyId: input.companyId, companyName: company.name, ...parsed };
      } catch {
        const match = response.content.match(/\{[\s\S]*\}/);
        const parsed = match ? JSON.parse(match[0]) : {};
        data = {
          companyId: input.companyId,
          companyName: company.name,
          proposalTitle: parsed.proposalTitle ?? "",
          problem: parsed.problem ?? "",
          desiredOutcome: parsed.desiredOutcome ?? "",
          scope: parsed.scope ?? "",
          deliverables: parsed.deliverables ?? [],
          approach: parsed.approach ?? "",
          timeline: parsed.timeline ?? "",
          dependencies: parsed.dependencies ?? [],
          assumptions: parsed.assumptions ?? [],
          exclusions: parsed.exclusions ?? [],
          investment: parsed.investment ?? "To be discussed",
          paymentTerms: parsed.paymentTerms ?? "",
          nextStep: parsed.nextStep ?? "",
          validUntil: parsed.validUntil ?? "",
          fullProposal: parsed.fullProposal ?? "",
        };
      }

      // Update deal stage to PROPOSAL
      try {
        const db = getDb();
        db.prepare(
          `UPDATE deals SET stage = 'PROPOSAL', proposal_date = ?, updated_at = ? WHERE company_id = ?`
        ).run(new Date().toISOString(), new Date().toISOString(), input.companyId);
      } catch { /* no deal to update */ }

      // Advance contacts
      for (const c of contacts) {
        if (c.stage === "MEETING" || c.stage === "OPPORTUNITY") {
          contactRepo.updateStage(c.id, "PROPOSAL");
        }
      }

      await events.emit({
        eventType: "proposal.created",
        actor: "proposal-agent",
        entityType: "company",
        entityId: input.companyId,
        metadata: { title: data.proposalTitle, investment: data.investment },
      });

      return { data, tokensUsed: response.usage.totalTokens };
    }
  })();
}
