/**
 * Market Intelligence Agent
 * Discovers promising verticals, pain points, buying signals, and companies.
 * Uses LLM analysis + operator context to identify high-potential markets.
 */

import { BaseAgent } from "./base.js";
import { type LLMRegistry } from "../providers/llm.js";
import { getOperatorContext } from "../core/operator.js";
import { type SkillRegistry } from "../skills/loader.js";
import { events } from "../events/emitter.js";

export interface MarketResearchInput {
  vertical?: string;
  geography?: string;
  signals?: string[];
  depth?: "quick" | "standard" | "deep";
}

export interface MarketInsight {
  vertical: string;
  painPoints: string[];
  buyingSignals: string[];
  demandIndicators: string[];
  companyExamples: Array<{
    name: string;
    domain?: string;
    reason: string;
    signals: string[];
  }>;
  technologyGaps: string[];
  operationalInefficiencies: string[];
  aiOpportunities: string[];
  confidence: number;
  evidence: string[];
}

export interface MarketResearchOutput {
  insights: MarketInsight[];
  recommendedVerticals: string[];
  summary: string;
}

export function createMarketIntelligenceAgent(llm: LLMRegistry, skills?: SkillRegistry) {
  const skillContext = skills
    ? skills.buildContext(
        skills.search("market").slice(0, 3).map((s) => s.id),
        4000
      )
    : "";

  return new (class extends BaseAgent<MarketResearchInput, MarketResearchOutput> {
    constructor() {
      super({
        name: "market-intelligence",
        description: "Discovers promising verticals, pain points, and buying signals",
        systemPrompt: `You are a Market Intelligence Agent for a freelance AI automation & growth specialist.

Your job is to analyze markets and identify businesses that would benefit from:
- AI automation & agent systems
- Business operations automation
- Growth & marketing automation
- AI websites / web apps
- Workflow redesign and integration

OPERATOR CONTEXT:
${getOperatorContext()}

${skillContext ? `RELEVANT SKILLS:\n${skillContext}` : ""}

ANALYSIS FRAMEWORK:
For each vertical/market, identify:
1. Common operational pain points (manual processes, slow follow-up, disconnected tools)
2. Buying signals (hiring, tech changes, growth, complaints, weak digital presence)
3. Demand indicators (job postings, industry trends, competitor movements)
4. Technology gaps (outdated websites, no CRM, manual workflows)
5. AI/automation opportunities specific to the operator's capabilities
6. Example companies showing these signals

OUTPUT FORMAT:
Respond in JSON with this structure:
{
  "insights": [{
    "vertical": "string",
    "painPoints": ["string"],
    "buyingSignals": ["string"],
    "demandIndicators": ["string"],
    "companyExamples": [{"name": "string", "domain": "string", "reason": "string", "signals": ["string"]}],
    "technologyGaps": ["string"],
    "operationalInefficiencies": ["string"],
    "aiOpportunities": ["string"],
    "confidence": 0.0-1.0,
    "evidence": ["string"]
  }],
  "recommendedVerticals": ["string"],
  "summary": "string"
}

RULES:
- Base insights on real market patterns, not fabrication
- Assign confidence based on evidence strength
- Focus on verticals where the operator has relevant experience or clear capability fit
- Prioritize verticals with high pain intensity and accessible decision makers
- Do not invent specific company data — use realistic examples with clear reasoning`,
        llm,
        temperature: 0.4,
        maxTokens: 8192,
      });
    }

    async execute(input: MarketResearchInput): Promise<{ data: MarketResearchOutput; tokensUsed: number }> {
      const prompt = this.buildPrompt(input);

      const response = await this.chat(
        [{ role: "user", content: prompt }],
        { jsonMode: true, temperature: 0.4 }
      );

      let data: MarketResearchOutput;
      try {
        data = JSON.parse(response.content);
      } catch {
        // If JSON parse fails, try to extract JSON from response
        const match = response.content.match(/\{[\s\S]*\}/);
        if (match) {
          data = JSON.parse(match[0]);
        } else {
          throw new Error("Failed to parse market research output as JSON");
        }
      }

      // Emit events for each insight
      for (const insight of data.insights) {
        await events.emit({
          eventType: "research.completed",
          actor: "market-intelligence",
          entityType: "vertical",
          entityId: insight.vertical,
          metadata: {
            painPoints: insight.painPoints.length,
            companyExamples: insight.companyExamples.length,
            confidence: insight.confidence,
          },
        });
      }

      return { data, tokensUsed: response.usage.totalTokens };
    }

    buildPrompt(input: MarketResearchInput): string {
      const parts = ["Analyze the following market for freelance client acquisition opportunities:"];

      if (input.vertical) {
        parts.push(`\nFOCUS VERTICAL: ${input.vertical}`);
      } else {
        parts.push("\nAnalyze 3-5 promising verticals based on the operator's capabilities.");
      }

      if (input.geography) parts.push(`GEOGRAPHY: ${input.geography}`);
      if (input.signals?.length) parts.push(`KNOWN SIGNALS: ${input.signals.join(", ")}`);

      const depth = input.depth ?? "standard";
      if (depth === "quick") {
        parts.push("\nProvide a quick overview — focus on top pain points and 2-3 company examples per vertical.");
      } else if (depth === "deep") {
        parts.push("\nProvide deep analysis — comprehensive pain points, multiple company examples, detailed evidence.");
      }

      return parts.join("\n");
    }
  })();
}
