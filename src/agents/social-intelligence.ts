/**
 * Social Intelligence Agent
 * Research public TikTok/Instagram/LinkedIn signals relevant to accounts,
 * industries, content structures, and market demand.
 */

import { BaseAgent } from "./base.js";
import { type LLMRegistry } from "../providers/llm.js";
import { getOperatorContext } from "../core/operator.js";
import { companyRepo } from "../db/repository.js";
import { events } from "../events/emitter.js";

export interface SocialIntelInput {
  action: "research-account" | "industry-trends" | "content-analysis" | "competitor-scan";
  companyId?: string;
  platform?: "tiktok" | "instagram" | "linkedin" | "all";
  accountHandle?: string;
  industry?: string;
  competitors?: string[];
}

export interface SocialSignal {
  platform: string;
  signalType: string;
  description: string;
  relevance: string;
  confidence: number;
  source: string;
}

export interface ContentPattern {
  format: string;
  hook: string;
  structure: string;
  cta: string;
  estimatedEngagement: string;
  whyItWorks: string;
}

export interface SocialIntelOutput {
  action: string;
  signals: SocialSignal[];
  contentPatterns: ContentPattern[];
  opportunities: string[];
  recommendations: string[];
  summary: string;
}

export function createSocialIntelligenceAgent(llm: LLMRegistry) {
  return new (class extends BaseAgent<SocialIntelInput, SocialIntelOutput> {
    constructor() {
      super({
        name: "social-intelligence",
        description: "Research social signals for accounts, industries, and content",
        systemPrompt: `You are a Social Intelligence Agent. You research public social media signals relevant to business development.

OPERATOR CONTEXT:
${getOperatorContext().slice(0, 1500)}

PLATFORMS: TikTok, Instagram, LinkedIn

YOU ANALYZE:
1. Account-level signals (company social presence, posting patterns, engagement)
2. Industry trends (what's being discussed, common pain points surfacing)
3. Content patterns (hooks, formats, structures that perform well)
4. Competitor intelligence (what competitors are doing on social)

SIGNAL TYPES:
- hiring_signal: company is growing/hiring (indicates budget + need)
- pain_signal: company or industry expressing frustration publicly
- tech_signal: technology adoption or migration
- growth_signal: expansion, funding, new products
- content_gap: missing or weak content presence
- engagement_pattern: unusual engagement spikes
- market_shift: industry-wide trend changes

CONTENT ANALYSIS:
- Hook decomposition (first 3 seconds / first line)
- Narrative structure (problem → agitate → solve, story, tutorial, etc.)
- CTA type and placement
- Format (video, carousel, static, reel, story)
- Estimated engagement tier

RULES:
- Separate FACT from INFERENCE from HYPOTHESIS
- Never mass-DM from social signals alone
- Social research feeds into the qualification pipeline
- Content patterns inform our own content strategy
- Cite observable evidence, not assumptions`,
        llm,
        temperature: 0.4,
        maxTokens: 3000,
      });
    }

    async execute(input: SocialIntelInput): Promise<{ data: SocialIntelOutput; tokensUsed: number }> {
      const company = input.companyId ? companyRepo.findById(input.companyId) : null;
      const platform = input.platform ?? "all";

      let prompt: string;

      switch (input.action) {
        case "research-account":
          prompt = `Research the social media presence of this company:
Company: ${company?.name ?? input.accountHandle ?? "unknown"}
Domain: ${company?.domain ?? "unknown"}
Industry: ${company?.industry ?? input.industry ?? "unknown"}
Platform focus: ${platform}
Handle: ${input.accountHandle ?? "search by company name"}

Analyze their social presence and identify:
1. Key signals (hiring, pain, tech, growth)
2. Content patterns they use
3. Gaps in their social strategy
4. Opportunities for our outreach angle`;
          break;

        case "industry-trends":
          prompt = `Analyze social media trends for this industry:
Industry: ${input.industry ?? company?.industry ?? "unknown"}
Platform focus: ${platform}

Identify:
1. Top pain points being discussed publicly
2. Content formats performing well
3. Emerging topics and demands
4. Opportunities for our operator to provide value`;
          break;

        case "content-analysis":
          prompt = `Analyze content patterns on ${platform} for:
Industry: ${input.industry ?? company?.industry ?? "unknown"}
${input.competitors?.length ? `Competitors: ${input.competitors.join(", ")}` : ""}

Decompose winning content:
1. Hook patterns (first 3 seconds / first line)
2. Narrative structures
3. CTA approaches
4. Format preferences
5. Engagement drivers`;
          break;

        case "competitor-scan":
          prompt = `Scan social presence of these competitors:
${input.competitors?.map((c) => `- ${c}`).join("\n") ?? "Identify competitors for " + (input.industry ?? company?.industry ?? "the operator's space")}
Platform: ${platform}

For each, analyze:
1. Posting frequency and consistency
2. Content themes and formats
3. Engagement levels
4. Strengths and gaps
5. What we can learn for our strategy`;
          break;
      }

      prompt += `\n\nReturn JSON:
{
  "signals": [{"platform": "string", "signalType": "string", "description": "string", "relevance": "string", "confidence": 0.0-1.0, "source": "string"}],
  "contentPatterns": [{"format": "string", "hook": "string", "structure": "string", "cta": "string", "estimatedEngagement": "string", "whyItWorks": "string"}],
  "opportunities": ["string — actionable opportunities"],
  "recommendations": ["string — what we should do based on this intel"],
  "summary": "string — 2-3 sentence executive summary"
}`;

      const response = await this.chat([{ role: "user", content: prompt }], { jsonMode: true });

      let data: SocialIntelOutput;
      try {
        data = { action: input.action, ...JSON.parse(response.content) };
      } catch {
        const match = response.content.match(/\{[\s\S]*\}/);
        const parsed = match ? JSON.parse(match[0]) : {};
        data = {
          action: input.action,
          signals: parsed.signals ?? [],
          contentPatterns: parsed.contentPatterns ?? [],
          opportunities: parsed.opportunities ?? [],
          recommendations: parsed.recommendations ?? [],
          summary: parsed.summary ?? "",
        };
      }

      await events.emit({
        eventType: "social.researched",
        actor: "social-intelligence",
        entityType: input.companyId ? "company" : "market",
        entityId: input.companyId ?? input.industry ?? "general",
        metadata: { action: input.action, platform, signals: data.signals.length },
      });

      return { data, tokensUsed: response.usage.totalTokens };
    }
  })();
}
