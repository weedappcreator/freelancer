/**
 * ICP Agent
 * Creates and manages Ideal Customer Profiles.
 * Uses operator context + market intelligence to define target segments.
 */

import { BaseAgent } from "./base.js";
import { type LLMRegistry } from "../providers/llm.js";
import { getOperatorContext } from "../core/operator.js";
import { icpRepo, type ICPRow } from "../db/repository.js";
import { events } from "../events/emitter.js";

export interface ICPGenerateInput {
  vertical?: string;
  geography?: string;
  painPoints?: string[];
  count?: number;
}

export interface ICPProfile {
  name: string;
  industry: string;
  geography: string;
  companySize: string;
  businessModel: string;
  likelyBudget: string;
  maturity: string;
  painIntensity: "low" | "medium" | "high";
  urgency: "low" | "medium" | "high";
  accessibility: string;
  serviceFit: string;
  rationale: string;
}

export interface ICPGenerateOutput {
  profiles: ICPProfile[];
  saved: ICPRow[];
}

export function createICPAgent(llm: LLMRegistry) {
  return new (class extends BaseAgent<ICPGenerateInput, ICPGenerateOutput> {
    constructor() {
      super({
        name: "icp-agent",
        description: "Creates Ideal Customer Profiles based on operator capabilities and market analysis",
        systemPrompt: `You are an ICP (Ideal Customer Profile) strategist for a freelance AI automation & growth specialist.

OPERATOR CONTEXT:
${getOperatorContext()}

Your job is to define precise customer profiles that maximize the chance of finding businesses where:
1. The operator's skills directly solve a real operational or growth problem
2. The pain is intense enough that the prospect will pay for a solution
3. The decision maker is accessible (not buried in enterprise procurement)
4. The budget matches freelance service pricing ($2K-$25K projects typically)

OUTPUT FORMAT (JSON):
{
  "profiles": [{
    "name": "string — descriptive ICP name",
    "industry": "string",
    "geography": "string — target market",
    "companySize": "string — employee range",
    "businessModel": "string — B2B/B2C/DTC/agency/etc",
    "likelyBudget": "string — realistic budget range",
    "maturity": "string — tech/process maturity level",
    "painIntensity": "low|medium|high",
    "urgency": "low|medium|high",
    "accessibility": "string — how easy to reach decision maker",
    "serviceFit": "string — which operator capability fits best",
    "rationale": "string — why this ICP is promising"
  }]
}

RULES:
- Be specific, not generic. "Small marketing agencies" not "businesses"
- Match to real operator capabilities — don't invent services
- Focus on segments where pain creates buying urgency
- Consider the operator's past work with agencies, e-commerce, real estate, fashion
- Rank by conversion potential, not just market size`,
        llm,
        temperature: 0.3,
        maxTokens: 3000,
      });
    }

    async execute(input: ICPGenerateInput): Promise<{ data: ICPGenerateOutput; tokensUsed: number }> {
      const count = input.count ?? 3;
      const prompt = [
        `Generate ${count} highly specific Ideal Customer Profiles.`,
        input.vertical ? `Focus on: ${input.vertical}` : "Identify the best verticals based on operator capabilities.",
        input.geography ? `Geography: ${input.geography}` : "",
        input.painPoints?.length ? `Known pain points: ${input.painPoints.join(", ")}` : "",
        "Return JSON with the profiles array.",
      ].filter(Boolean).join("\n");

      const response = await this.chat(
        [{ role: "user", content: prompt }],
        { jsonMode: true }
      );

      let parsed: { profiles: ICPProfile[] };
      try {
        parsed = JSON.parse(response.content);
      } catch {
        const match = response.content.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : { profiles: [] };
      }

      // Save to database
      const saved: ICPRow[] = [];
      for (const profile of parsed.profiles) {
        const row = icpRepo.create({
          name: profile.name,
          industry: profile.industry,
          geography: profile.geography,
          company_size: profile.companySize,
          business_model: profile.businessModel,
          likely_budget: profile.likelyBudget,
          maturity: profile.maturity,
          pain_intensity: profile.painIntensity,
          urgency: profile.urgency,
          accessibility: profile.accessibility,
          service_fit: profile.serviceFit,
        });
        saved.push(row);

        await events.emit({
          eventType: "icp.created",
          actor: "icp-agent",
          entityType: "icp",
          entityId: row.id,
          metadata: { name: profile.name, industry: profile.industry },
        });
      }

      return {
        data: { profiles: parsed.profiles, saved },
        tokensUsed: response.usage.totalTokens,
      };
    }
  })();
}
