/**
 * Account Research Agent
 * Deep research on qualified accounts — answers the 8 key questions from the master prompt.
 */

import { BaseAgent } from "./base.js";
import { type LLMRegistry } from "../providers/llm.js";
import { getOperatorContext } from "../core/operator.js";
import { companyRepo, contactRepo } from "../db/repository.js";
import { events } from "../events/emitter.js";

export interface AccountResearchInput {
  companyId: string;
}

export interface AccountResearchOutput {
  companyId: string;
  companyName: string;
  whatTheyDo: string;
  decisionMaker: string;
  recentChanges: string;
  observableProblem: string;
  operatorCapabilityMatch: string;
  supportingEvidence: string[];
  outreachAngle: string;
  doNotClaim: string[];
  recommendedOffer: string;
  personalizationHooks: string[];
}

export function createAccountResearchAgent(llm: LLMRegistry) {
  return new (class extends BaseAgent<AccountResearchInput, AccountResearchOutput> {
    constructor() {
      super({
        name: "account-research",
        description: "Deep research on qualified accounts for personalized outreach",
        systemPrompt: `You are an Account Research Agent. For each qualified company, answer these 8 questions:

1. What does the company do?
2. Who is the likely decision maker?
3. What changed recently? (growth, hiring, product launch, complaints)
4. What specific operational/growth problem is observable?
5. Which operator capability maps to it?
6. What evidence supports the hypothesis?
7. What would make the outreach useful rather than generic?
8. What should NOT be claimed?

OPERATOR CONTEXT:
${getOperatorContext().slice(0, 2000)}

OUTPUT FORMAT (JSON):
{
  "companyId": "string",
  "companyName": "string",
  "whatTheyDo": "string — concise business description",
  "decisionMaker": "string — name + title of best contact",
  "recentChanges": "string — what's changed that creates opportunity",
  "observableProblem": "string — the specific pain point",
  "operatorCapabilityMatch": "string — which service solves this",
  "supportingEvidence": ["string — evidence for the hypothesis"],
  "outreachAngle": "string — the hook that makes outreach useful, not generic",
  "doNotClaim": ["string — things we must NOT say without evidence"],
  "recommendedOffer": "string — smallest credible offer for this account",
  "personalizationHooks": ["string — specific details for personalizing outreach"]
}

RULES:
- Be specific, not generic. "They manually track leads in spreadsheets" not "they have inefficiencies"
- The outreach angle should make the prospect think "this person actually understands my business"
- Do NOT claim results we haven't achieved or relationships we don't have
- Prefer a narrow, specific offer over a broad capability dump`,
        llm,
        temperature: 0.3,
        maxTokens: 2500,
      });
    }

    async execute(input: AccountResearchInput): Promise<{ data: AccountResearchOutput; tokensUsed: number }> {
      const company = companyRepo.findById(input.companyId);
      if (!company) throw new Error(`Company ${input.companyId} not found`);

      const contacts = contactRepo.findByCompany(input.companyId);

      const prompt = `Deep research this qualified account:

Company: ${company.name}
Domain: ${company.domain ?? "unknown"}
Industry: ${company.industry ?? "unknown"}
Geography: ${company.geography ?? "unknown"}
Size: ${company.employee_band ?? "unknown"}
Score: ${company.total_score ?? "unscored"}/100
Research so far: ${company.research_summary ?? "minimal"}
Evidence: ${company.evidence}

Contacts:
${contacts.map((c) => `- ${c.first_name ?? ""} ${c.last_name ?? ""} — ${c.title ?? "unknown"} (${c.role_category ?? "?"})`).join("\n") || "None identified"}

Answer all 8 research questions. Return JSON.`;

      const response = await this.chat([{ role: "user", content: prompt }], { jsonMode: true });

      let data: AccountResearchOutput;
      try {
        data = JSON.parse(response.content);
      } catch {
        const match = response.content.match(/\{[\s\S]*\}/);
        data = match ? JSON.parse(match[0]) : { companyId: input.companyId, companyName: company.name, whatTheyDo: "", decisionMaker: "", recentChanges: "", observableProblem: "", operatorCapabilityMatch: "", supportingEvidence: [], outreachAngle: "", doNotClaim: [], recommendedOffer: "", personalizationHooks: [] };
      }

      // Update company research
      companyRepo.update(input.companyId, {
        research_summary: `${data.observableProblem} → ${data.recommendedOffer}`,
        last_researched_at: new Date().toISOString(),
      });

      // Advance contacts to ACCOUNT_RESEARCH stage
      for (const contact of contacts) {
        contactRepo.updateStage(contact.id, "ACCOUNT_RESEARCH");
      }

      await events.emit({
        eventType: "research.completed",
        actor: "account-research",
        entityType: "company",
        entityId: input.companyId,
        metadata: { offer: data.recommendedOffer, angle: data.outreachAngle },
      });

      return { data, tokensUsed: response.usage.totalTokens };
    }
  })();
}
