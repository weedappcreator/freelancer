/**
 * Offer Strategist Agent
 * Selects or constructs the smallest credible offer that addresses the observed problem.
 * Prefers a specific outcome/problem over a broad list of services.
 */

import { BaseAgent } from "./base.js";
import { type LLMRegistry } from "../providers/llm.js";
import { getOperatorContext } from "../core/operator.js";
import { companyRepo, contactRepo } from "../db/repository.js";
import { events } from "../events/emitter.js";

export interface OfferInput {
  companyId: string;
  researchSummary?: string;
  observableProblem?: string;
}

export interface OfferOutput {
  companyId: string;
  companyName: string;
  offerFamily: string;
  offerTitle: string;
  problemStatement: string;
  proposedOutcome: string;
  scope: string;
  whyCredible: string;
  proofPoints: string[];
  estimatedValue: string;
  cta: string;
  doNotPromise: string[];
}

export function createOfferStrategist(llm: LLMRegistry) {
  return new (class extends BaseAgent<OfferInput, OfferOutput> {
    constructor() {
      super({
        name: "offer-strategist",
        description: "Constructs targeted offers matching observed problems",
        systemPrompt: `You are an Offer Strategist. Your job is to select the smallest credible offer that addresses a prospect's specific problem.

OPERATOR CAPABILITIES:
${getOperatorContext().slice(0, 3000)}

OFFER FAMILIES:
1. AI Automation & Agent Systems
2. Business Operations Automation
3. AI Lead / Follow-Up Systems
4. AI Websites, Web Apps & Internal Tools
5. Marketing Automation & Growth Systems
6. AI Content / Creative Production
7. Paid Acquisition & Marketing Operations
8. Workflow / MCP / API Integrations

OFFER DESIGN PRINCIPLE:
observed problem → business consequence → specific system → credible outcome → low-friction next step

BAD: "I do AI, websites, automation, ads, social media, UGC and agents."
GOOD: "Your team appears to be manually qualifying and following up with inbound leads. I can map that workflow and build a bounded AI/CRM system that handles qualification, routing and follow-up while keeping your team in control."

OUTPUT FORMAT (JSON):
{
  "companyId": "string",
  "companyName": "string",
  "offerFamily": "string — which family from the list above",
  "offerTitle": "string — concise name for this specific offer",
  "problemStatement": "string — the specific problem we're solving",
  "proposedOutcome": "string — what they get (measurable if possible)",
  "scope": "string — what's included, bounded",
  "whyCredible": "string — why the operator can deliver this",
  "proofPoints": ["string — ONLY a verifiable fact from OPERATOR CONTEXT above (skill, certificate, shipped project category). Empty array if none applies."],
  "estimatedValue": "string — rough project value range",
  "cta": "string — the low-friction next step",
  "doNotPromise": ["string — claims we must NOT make"]
}

RULES:
- ONE offer per company, not a menu
- Narrow and specific beats broad and impressive
- Never guarantee cost savings, revenue, or headcount reduction
- The CTA should be low-friction (15-min call, quick audit, async review)
- Proof points: every item MUST be traceable to a concrete fact in OPERATOR CONTEXT (a named skill, certificate, or shipped project category). If the context has no case studies, testimonials, or client results in this domain, return an EMPTY proofPoints array. Never write "built X for clients", "experience with Y industry", or any past-result claim unless the context states it. Capability statements ("I build Claude agents that query APIs") belong in whyCredible, not proofPoints.`,
        llm,
        temperature: 0.3,
        maxTokens: 2000,
      });
    }

    async execute(input: OfferInput): Promise<{ data: OfferOutput; tokensUsed: number }> {
      const company = companyRepo.findById(input.companyId);
      if (!company) throw new Error(`Company ${input.companyId} not found`);

      const contacts = contactRepo.findByCompany(input.companyId);

      const prompt = `Design a targeted offer for this company:

Company: ${company.name}
Domain: ${company.domain ?? "unknown"}
Industry: ${company.industry ?? "unknown"}
Size: ${company.employee_band ?? "unknown"}
Score: ${company.total_score ?? "?"}/100
Research: ${input.researchSummary ?? company.research_summary ?? "minimal"}
Observable problem: ${input.observableProblem ?? "not specified"}
Decision maker: ${contacts[0] ? `${contacts[0].first_name ?? ""} ${contacts[0].last_name ?? ""} — ${contacts[0].title ?? "?"}` : "unknown"}

Return JSON with the offer.`;

      const response = await this.chat([{ role: "user", content: prompt }], { jsonMode: true });

      let data: OfferOutput;
      try {
        data = JSON.parse(response.content);
      } catch {
        const match = response.content.match(/\{[\s\S]*\}/);
        data = match ? JSON.parse(match[0]) : { companyId: input.companyId, companyName: company.name, offerFamily: "", offerTitle: "", problemStatement: "", proposedOutcome: "", scope: "", whyCredible: "", proofPoints: [], estimatedValue: "", cta: "", doNotPromise: [] };
      }

      // Safety net: strip past-client/result claims the model may have invented.
      // The operator context has no documented case studies or testimonials,
      // so any such claim is a fabrication by definition.
      const inventedClaim = /(built|delivered|helped|drove|increased|reduced|generated)\b.{0,40}\b(clients?|customers|revenue|bookings|sales)\b|\bexperience with\b.{0,30}\b(health|clients?|customers)\b|\bour clients?\b/i;
      const kept: string[] = [];
      for (const p of data.proofPoints ?? []) {
        if (inventedClaim.test(p)) {
          await events.emit({
            eventType: "offer.proof_point_stripped",
            actor: "offer-strategist",
            entityType: "company",
            entityId: input.companyId,
            metadata: { stripped: p },
          });
          continue;
        }
        kept.push(p);
      }
      data.proofPoints = kept;

      await events.emit({
        eventType: "offer.created",
        actor: "offer-strategist",
        entityType: "company",
        entityId: input.companyId,
        metadata: { offerFamily: data.offerFamily, offerTitle: data.offerTitle },
      });

      return { data, tokensUsed: response.usage.totalTokens };
    }
  })();
}
