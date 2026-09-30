/**
 * Qualification Agent
 * Scores leads against the active ICP using the 0-100 scoring model.
 */

import { BaseAgent } from "./base.js";
import { type LLMRegistry } from "../providers/llm.js";
import { getOperatorContext } from "../core/operator.js";
import { companyRepo, contactRepo, icpRepo, type CompanyRow } from "../db/repository.js";
import { events } from "../events/emitter.js";

export interface QualificationInput {
  companyId?: string;
  batchSize?: number;
}

export interface QualificationScore {
  companyId: string;
  companyName: string;
  fitScore: number;       // 0-25
  painScore: number;      // 0-25
  intentScore: number;    // 0-20
  timingScore: number;    // 0-10
  accessScore: number;    // 0-10
  offerFit: number;       // 0-10
  totalScore: number;     // 0-100
  rationale: string;
  recommendedAction: "qualify" | "nurture" | "reject" | "research_more";
  bestOffer: string;
}

export interface QualificationOutput {
  scores: QualificationScore[];
  qualified: number;
  rejected: number;
  summary: string;
}

export function createQualificationAgent(llm: LLMRegistry) {
  return new (class extends BaseAgent<QualificationInput, QualificationOutput> {
    constructor() {
      super({
        name: "qualification",
        description: "Scores leads against ICP using fit/pain/intent/timing/access/offer model",
        systemPrompt: `You are a Lead Qualification Agent. Score each company using this model:

SCORING MODEL:
- fit_score (0-25): How well does this company match the ICP? Industry, size, geography, business model.
- pain_score (0-25): How intense is their operational/growth pain? Manual processes, slow follow-up, disconnected tools.
- intent_score (0-20): Are there buying signals? Hiring, tech changes, growth, active search for solutions.
- timing_score (0-10): Is the timing right? Budget cycle, urgency indicators, seasonal factors.
- access_score (0-10): Can we reach the decision maker? Small company = easier. Enterprise = harder.
- offer_fit (0-10): Do the operator's specific capabilities match their specific problem?
- total = sum of all scores (0-100)

OPERATOR CAPABILITIES:
${getOperatorContext().slice(0, 2000)}

THRESHOLDS:
- 70+: qualify — ready for account research and outreach
- 50-69: nurture — promising but needs more evidence
- 30-49: research_more — unclear fit, gather more data
- <30: reject — poor fit

OUTPUT FORMAT (JSON):
{
  "scores": [{
    "companyId": "string",
    "companyName": "string",
    "fitScore": 0-25,
    "painScore": 0-25,
    "intentScore": 0-20,
    "timingScore": 0-10,
    "accessScore": 0-10,
    "offerFit": 0-10,
    "totalScore": 0-100,
    "rationale": "string — brief justification",
    "recommendedAction": "qualify|nurture|reject|research_more",
    "bestOffer": "string — which operator service fits best"
  }],
  "summary": "string"
}

RULES:
- Score based on evidence, not optimism
- Do not inflate scores to meet quotas
- A high total alone is not enough — require sufficient evidence
- Be specific about WHY each score is what it is`,
        llm,
        temperature: 0.2,
        maxTokens: 8192,
      });
    }

    async execute(input: QualificationInput): Promise<{ data: QualificationOutput; tokensUsed: number }> {
      // Get companies to score
      let companies: CompanyRow[];
      if (input.companyId) {
        const c = companyRepo.findById(input.companyId);
        companies = c ? [c] : [];
      } else {
        // Get unscored companies
        companies = companyRepo.list({ limit: input.batchSize ?? 10 })
          .filter((c) => c.total_score === null);
      }

      if (companies.length === 0) {
        return { data: { scores: [], qualified: 0, rejected: 0, summary: "No companies to qualify" }, tokensUsed: 0 };
      }

      // Load active ICPs for context
      const icps = icpRepo.listActive();
      const icpContext = icps.map((i) => `${i.name}: ${i.industry} / ${i.company_size ?? "any size"} / ${i.pain_intensity ?? "?"} pain`).join("\n");

      const companySummaries = companies.map((c) => {
        const contacts = contactRepo.findByCompany(c.id);
        return `Company: ${c.name} (ID: ${c.id})
  Domain: ${c.domain ?? "unknown"}
  Industry: ${c.industry ?? "unknown"}
  Geography: ${c.geography ?? "unknown"}
  Size: ${c.employee_band ?? "unknown"}
  Research: ${c.research_summary ?? "none"}
  Evidence: ${c.evidence}
  Contacts: ${contacts.map((ct) => `${ct.first_name ?? ""} ${ct.last_name ?? ""} — ${ct.title ?? "?"}`).join("; ") || "none"}`;
      }).join("\n\n");

      const prompt = `Score these companies against the operator's ICPs:

ACTIVE ICPs:
${icpContext || "No ICPs defined — use general operator capabilities"}

COMPANIES TO SCORE:
${companySummaries}

Return JSON with scores array.`;

      const response = await this.chat([{ role: "user", content: prompt }], { jsonMode: true });

      let parsed: { scores: QualificationScore[]; summary: string };
      try {
        parsed = JSON.parse(response.content);
      } catch {
        const match = response.content.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : { scores: [], summary: "Parse error" };
      }

      // Save scores to database
      let qualified = 0;
      let rejected = 0;

      for (const score of parsed.scores) {
        companyRepo.update(score.companyId, {
          fit_score: score.fitScore,
          pain_score: score.painScore,
          intent_score: score.intentScore,
          timing_score: score.timingScore,
          access_score: score.accessScore,
          offer_fit: score.offerFit,
          total_score: score.totalScore,
        });

        // Update contact stages
        const contacts = contactRepo.findByCompany(score.companyId);
        const newStage = score.recommendedAction === "qualify" ? "QUALIFICATION"
          : score.recommendedAction === "reject" ? "REPLY_NEGATIVE" : "ENRICHMENT";

        for (const contact of contacts) {
          contactRepo.updateStage(contact.id, newStage);
        }

        if (score.recommendedAction === "qualify") qualified++;
        if (score.recommendedAction === "reject") rejected++;

        const eventType = score.recommendedAction === "qualify" ? "lead.qualified" : score.recommendedAction === "reject" ? "lead.rejected" : "lead.enriched";
        await events.emit({
          eventType,
          actor: "qualification",
          entityType: "company",
          entityId: score.companyId,
          metadata: { totalScore: score.totalScore, action: score.recommendedAction },
        });
      }

      return {
        data: { scores: parsed.scores, qualified, rejected, summary: parsed.summary },
        tokensUsed: response.usage.totalTokens,
      };
    }
  })();
}
