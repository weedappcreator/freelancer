/**
 * Content Intelligence Agent
 * Uses market research, prospect questions, and sales objections
 * to generate content opportunities for TikTok, Instagram, and other channels.
 */

import { BaseAgent } from "./base.js";
import { type LLMRegistry } from "../providers/llm.js";
import { getOperatorContext } from "../core/operator.js";
import { events } from "../events/emitter.js";

export interface ContentIntelInput {
  action: "generate-opportunities" | "brief" | "repurpose" | "calendar";
  painPoints?: string[];
  objections?: string[];
  questions?: string[];
  industry?: string;
  channel?: "tiktok" | "instagram" | "linkedin" | "blog" | "all";
  existingContent?: string[];
  weekCount?: number;
}

export interface ContentOpportunity {
  title: string;
  channel: string;
  format: string;
  hook: string;
  outline: string;
  cta: string;
  targetAudience: string;
  painAddressed: string;
  funnelStage: "awareness" | "consideration" | "decision";
  priority: "high" | "medium" | "low";
  estimatedEffort: string;
}

export interface ContentBrief {
  title: string;
  channel: string;
  format: string;
  hook: string;
  keyPoints: string[];
  scriptOutline: string;
  visualNotes: string;
  cta: string;
  hashtags: string[];
  schedulingNotes: string;
}

export interface ContentIntelOutput {
  action: string;
  opportunities: ContentOpportunity[];
  briefs: ContentBrief[];
  calendarWeeks: Array<{ week: number; posts: Array<{ day: string; channel: string; title: string; format: string }> }>;
  summary: string;
}

export function createContentIntelligenceAgent(llm: LLMRegistry) {
  return new (class extends BaseAgent<ContentIntelInput, ContentIntelOutput> {
    constructor() {
      super({
        name: "content-intelligence",
        description: "Generates content opportunities from market intelligence",
        systemPrompt: `You are a Content Intelligence Agent. You turn sales intelligence into content that builds authority and creates inbound demand.

OPERATOR CONTEXT:
${getOperatorContext().slice(0, 2000)}

CONTENT LOOP:
prospect questions → recurring pain → content hypothesis → concept → publish → engagement → new research → offer + sales learning

CONTENT PRINCIPLES:
- Content exists to build authority and create inbound demand, not merely increase posting volume
- Every piece should address a real pain point observed in sales/research
- Prefer depth over breadth — one well-executed piece beats five generic ones
- Each piece needs a clear funnel stage: awareness, consideration, or decision
- CTA should match the funnel stage (awareness = follow, consideration = lead magnet, decision = book a call)

CHANNEL FORMATS:
TikTok: 15-60s vertical video, hook in first 3s, problem→solution→CTA
Instagram: Reels (15-90s), Carousels (5-10 slides), Stories
LinkedIn: Text posts (hook + value + CTA), Articles, Document posts
Blog: SEO-optimized, 800-2000 words, internal linking

RULES:
- Never fabricate case studies or results
- Content must be consistent with operator context
- Repurpose across channels but adapt format/tone
- Track which pain points generate the most engagement
- Content ideas should come from real prospect interactions, not generic brainstorming`,
        llm,
        temperature: 0.5,
        maxTokens: 3000,
      });
    }

    async execute(input: ContentIntelInput): Promise<{ data: ContentIntelOutput; tokensUsed: number }> {
      switch (input.action) {
        case "generate-opportunities":
          return this.generateOpportunities(input);
        case "brief":
          return this.generateBrief(input);
        case "repurpose":
          return this.repurposeContent(input);
        case "calendar":
          return this.generateCalendar(input);
        default:
          return { data: { action: input.action, opportunities: [], briefs: [], calendarWeeks: [], summary: "Unknown action" }, tokensUsed: 0 };
      }
    }

    async generateOpportunities(input: ContentIntelInput): Promise<{ data: ContentIntelOutput; tokensUsed: number }> {
      const prompt = `Generate content opportunities from these sales/market signals:

Pain points: ${(input.painPoints ?? []).join("; ") || "general AI/automation pains"}
Objections heard: ${(input.objections ?? []).join("; ") || "none specified"}
Prospect questions: ${(input.questions ?? []).join("; ") || "none specified"}
Industry: ${input.industry ?? "B2B services / SMBs"}
Channel focus: ${input.channel ?? "all"}

Return JSON:
{
  "opportunities": [
    {
      "title": "string",
      "channel": "tiktok|instagram|linkedin|blog",
      "format": "string — reel, carousel, text post, article, etc.",
      "hook": "string — the opening line/visual",
      "outline": "string — key points",
      "cta": "string",
      "targetAudience": "string",
      "painAddressed": "string",
      "funnelStage": "awareness|consideration|decision",
      "priority": "high|medium|low",
      "estimatedEffort": "string"
    }
  ],
  "summary": "string"
}

Generate 5-8 opportunities ranked by priority.`;

      const response = await this.chat([{ role: "user", content: prompt }], { jsonMode: true });

      let parsed: { opportunities: ContentOpportunity[]; summary: string };
      try {
        parsed = JSON.parse(response.content);
      } catch {
        const match = response.content.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : { opportunities: [], summary: "" };
      }

      await events.emit({
        eventType: "content.opportunities_generated",
        actor: "content-intelligence",
        entityType: "content",
        entityId: "batch",
        metadata: { count: parsed.opportunities.length, channel: input.channel ?? "all" },
      });

      return {
        data: { action: "generate-opportunities", opportunities: parsed.opportunities, briefs: [], calendarWeeks: [], summary: parsed.summary },
        tokensUsed: response.usage.totalTokens,
      };
    }

    async generateBrief(input: ContentIntelInput): Promise<{ data: ContentIntelOutput; tokensUsed: number }> {
      const prompt = `Create a detailed content brief:

Topic/Pain: ${(input.painPoints ?? []).join("; ") || "AI automation for small businesses"}
Channel: ${input.channel ?? "tiktok"}
Industry: ${input.industry ?? "B2B"}

Return JSON:
{
  "briefs": [{
    "title": "string",
    "channel": "string",
    "format": "string",
    "hook": "string — first 3 seconds / first line",
    "keyPoints": ["string"],
    "scriptOutline": "string — full script/outline",
    "visualNotes": "string — what to show/design",
    "cta": "string",
    "hashtags": ["string"],
    "schedulingNotes": "string — best time/day"
  }],
  "summary": "string"
}`;

      const response = await this.chat([{ role: "user", content: prompt }], { jsonMode: true });
      let parsed: { briefs: ContentBrief[]; summary: string };
      try {
        parsed = JSON.parse(response.content);
      } catch {
        const match = response.content.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : { briefs: [], summary: "" };
      }

      return {
        data: { action: "brief", opportunities: [], briefs: parsed.briefs, calendarWeeks: [], summary: parsed.summary },
        tokensUsed: response.usage.totalTokens,
      };
    }

    async repurposeContent(input: ContentIntelInput): Promise<{ data: ContentIntelOutput; tokensUsed: number }> {
      const prompt = `Repurpose this content across channels:

Existing content:
${(input.existingContent ?? []).map((c, i) => `${i + 1}. ${c}`).join("\n") || "No content provided"}

Target channels: ${input.channel ?? "tiktok, instagram, linkedin, blog"}

For each piece, show how to adapt it for each channel with format-specific hooks and CTAs.

Return JSON:
{
  "opportunities": [{"title": "string", "channel": "string", "format": "string", "hook": "string", "outline": "string", "cta": "string", "targetAudience": "string", "painAddressed": "string", "funnelStage": "awareness|consideration|decision", "priority": "high|medium|low", "estimatedEffort": "string"}],
  "summary": "string"
}`;

      const response = await this.chat([{ role: "user", content: prompt }], { jsonMode: true });
      let parsed: { opportunities: ContentOpportunity[]; summary: string };
      try {
        parsed = JSON.parse(response.content);
      } catch {
        const match = response.content.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : { opportunities: [], summary: "" };
      }

      return {
        data: { action: "repurpose", opportunities: parsed.opportunities, briefs: [], calendarWeeks: [], summary: parsed.summary },
        tokensUsed: response.usage.totalTokens,
      };
    }

    async generateCalendar(input: ContentIntelInput): Promise<{ data: ContentIntelOutput; tokensUsed: number }> {
      const weeks = input.weekCount ?? 2;

      const prompt = `Generate a ${weeks}-week content calendar:

Industry: ${input.industry ?? "AI/automation services"}
Channels: ${input.channel ?? "tiktok, instagram, linkedin"}
Pain points to address: ${(input.painPoints ?? []).join("; ") || "general AI/automation pains"}

Return JSON:
{
  "calendarWeeks": [
    {
      "week": 1,
      "posts": [
        {"day": "Monday", "channel": "string", "title": "string", "format": "string"}
      ]
    }
  ],
  "summary": "string"
}

Plan 3-5 posts per week, spread across channels. Mix funnel stages.`;

      const response = await this.chat([{ role: "user", content: prompt }], { jsonMode: true });
      let parsed: { calendarWeeks: ContentIntelOutput["calendarWeeks"]; summary: string };
      try {
        parsed = JSON.parse(response.content);
      } catch {
        const match = response.content.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : { calendarWeeks: [], summary: "" };
      }

      return {
        data: { action: "calendar", opportunities: [], briefs: [], calendarWeeks: parsed.calendarWeeks, summary: parsed.summary },
        tokensUsed: response.usage.totalTokens,
      };
    }
  })();
}
