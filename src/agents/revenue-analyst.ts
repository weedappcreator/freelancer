/**
 * Revenue Analyst Agent
 * Analyzes the entire funnel — what generates revenue, where it leaks,
 * which ICPs/offers/channels convert, and what to experiment next.
 */

import { BaseAgent } from "./base.js";
import { type LLMRegistry } from "../providers/llm.js";
import { companyRepo, contactRepo, icpRepo } from "../db/repository.js";
import { events } from "../events/emitter.js";
import { getDb } from "../db/database.js";

export interface AnalyticsInput {
  action: "funnel" | "icp-performance" | "channel-efficiency" | "experiment-recommendation" | "weekly-report";
  dateRange?: { from: string; to: string };
}

export interface FunnelMetrics {
  totalCompanies: number;
  totalContacts: number;
  totalICPs: number;
  byStage: Record<string, number>;
  qualifiedRate: number;
  avgScore: number;
  topScoring: Array<{ name: string; score: number }>;
  recentEvents: Array<{ type: string; count: number }>;
  pipelineValue: string;
  dealsOpen: number;
  dealsWon: number;
  revenue: number;
}

export interface AnalyticsOutput {
  action: string;
  funnel?: FunnelMetrics;
  insights: string[];
  recommendations: string[];
  risks: string[];
  summary: string;
}

export function createRevenueAnalystAgent(llm: LLMRegistry) {
  return new (class extends BaseAgent<AnalyticsInput, AnalyticsOutput> {
    constructor() {
      super({
        name: "revenue-analyst",
        description: "Funnel analytics, attribution, and experiment recommendations",
        systemPrompt: `You are a Revenue Analyst Agent. You analyze the sales funnel and recommend optimizations.

ANALYSIS FRAMEWORK:
1. What generated revenue?
2. What generated qualified pipeline?
3. Which ICPs underperform?
4. Which offers convert?
5. Which messages create positive replies?
6. Where does the funnel leak?
7. Which channels are efficient?
8. What experiment should run next?

RULES:
- Use actual data, not assumptions
- Distinguish correlation from causation
- Small sample sizes mean low confidence — say so
- Never optimize a proxy metric if it degrades downstream revenue quality
- Recommendations should be specific and actionable
- Always identify the biggest funnel leak first`,
        llm,
        temperature: 0.2,
        maxTokens: 3000,
      });
    }

    async execute(input: AnalyticsInput): Promise<{ data: AnalyticsOutput; tokensUsed: number }> {
      const metrics = this.gatherMetrics();

      switch (input.action) {
        case "funnel":
          return this.analyzeFunnel(metrics);
        case "icp-performance":
          return this.analyzeICPPerformance(metrics);
        case "channel-efficiency":
          return this.analyzeChannels(metrics);
        case "experiment-recommendation":
          return this.recommendExperiment(metrics);
        case "weekly-report":
          return this.weeklyReport(metrics);
        default:
          return { data: { action: input.action, insights: [], recommendations: [], risks: [], summary: "Unknown action" }, tokensUsed: 0 };
      }
    }

    gatherMetrics(): FunnelMetrics {
      const totalCompanies = companyRepo.count();
      const totalContacts = contactRepo.count();
      const totalICPs = icpRepo.count();

      // Stage distribution
      const byStage: Record<string, number> = {};
      const stages = ["LEAD_DISCOVERY", "ENRICHMENT", "QUALIFICATION", "ACCOUNT_RESEARCH", "OUTREACH", "MEETING", "OPPORTUNITY", "PROPOSAL", "WON", "REJECTED", "NURTURE"];
      for (const stage of stages) {
        const contacts = contactRepo.listByStage(stage);
        if (contacts.length > 0) byStage[stage] = contacts.length;
      }

      // Scoring
      const allCompanies = companyRepo.list({ limit: 1000 });
      const scored = allCompanies.filter((c) => c.total_score !== null && c.total_score !== undefined);
      const qualified = scored.filter((c) => (c.total_score ?? 0) >= 70);
      const avgScore = scored.length > 0 ? scored.reduce((s, c) => s + (c.total_score ?? 0), 0) / scored.length : 0;

      const topScoring = scored
        .sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0))
        .slice(0, 5)
        .map((c) => ({ name: c.name, score: c.total_score ?? 0 }));

      // Deals
      let dealsOpen = 0;
      let dealsWon = 0;
      let revenue = 0;
      let pipelineValue = 0;
      try {
        const db = getDb();
        const deals = db.prepare(`SELECT * FROM deals`).all() as Array<Record<string, unknown>>;
        for (const d of deals) {
          if (d.stage === "WON") {
            dealsWon++;
            revenue += Number(d.revenue ?? 0);
          } else {
            dealsOpen++;
            pipelineValue += Number(d.expected_value ?? 0);
          }
        }
      } catch { /* no deals table or empty */ }

      // Recent events
      const recentEvents = events.query({ limit: 100 });
      const eventCounts: Record<string, number> = {};
      for (const e of recentEvents) {
        eventCounts[e.eventType] = (eventCounts[e.eventType] ?? 0) + 1;
      }
      const recentEventSummary = Object.entries(eventCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([type, count]) => ({ type, count }));

      return {
        totalCompanies,
        totalContacts,
        totalICPs,
        byStage,
        qualifiedRate: scored.length > 0 ? qualified.length / scored.length : 0,
        avgScore: Math.round(avgScore),
        topScoring,
        recentEvents: recentEventSummary,
        pipelineValue: `$${pipelineValue.toLocaleString()}`,
        dealsOpen,
        dealsWon,
        revenue,
      };
    }

    async analyzeFunnel(metrics: FunnelMetrics): Promise<{ data: AnalyticsOutput; tokensUsed: number }> {
      const prompt = `Analyze this sales funnel and identify issues:

${JSON.stringify(metrics, null, 2)}

Return JSON:
{
  "insights": ["string — key observations"],
  "recommendations": ["string — specific actions to take"],
  "risks": ["string — things to watch out for"],
  "summary": "string — 2-3 sentence executive summary"
}

Focus on:
1. Where is the biggest leak?
2. What stage needs the most attention?
3. What's working well?
4. What should change?`;

      const response = await this.chat([{ role: "user", content: prompt }], { jsonMode: true });
      let parsed: { insights: string[]; recommendations: string[]; risks: string[]; summary: string };
      try {
        parsed = JSON.parse(response.content);
      } catch {
        const match = response.content.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : { insights: [], recommendations: [], risks: [], summary: "" };
      }

      return {
        data: { action: "funnel", funnel: metrics, ...parsed },
        tokensUsed: response.usage.totalTokens,
      };
    }

    async analyzeICPPerformance(metrics: FunnelMetrics): Promise<{ data: AnalyticsOutput; tokensUsed: number }> {
      const icps = icpRepo.list();

      const prompt = `Analyze ICP performance:

ICPs: ${JSON.stringify(icps.map((i) => ({ name: i.name, industry: i.industry, active: i.active })), null, 2)}
Funnel: ${JSON.stringify(metrics, null, 2)}

Return JSON with insights about which ICPs are performing and which should be adjusted.`;

      const response = await this.chat([{ role: "user", content: prompt }], { jsonMode: true });
      let parsed: { insights: string[]; recommendations: string[]; risks: string[]; summary: string };
      try {
        parsed = JSON.parse(response.content);
      } catch {
        parsed = { insights: [], recommendations: [], risks: [], summary: response.content.slice(0, 200) };
      }

      return { data: { action: "icp-performance", funnel: metrics, ...parsed }, tokensUsed: response.usage.totalTokens };
    }

    async analyzeChannels(metrics: FunnelMetrics): Promise<{ data: AnalyticsOutput; tokensUsed: number }> {
      const prompt = `Analyze channel efficiency based on event data:

${JSON.stringify(metrics, null, 2)}

Return JSON with insights about which channels (email, linkedin, social) are most efficient.`;

      const response = await this.chat([{ role: "user", content: prompt }], { jsonMode: true });
      let parsed: { insights: string[]; recommendations: string[]; risks: string[]; summary: string };
      try {
        parsed = JSON.parse(response.content);
      } catch {
        parsed = { insights: [], recommendations: [], risks: [], summary: response.content.slice(0, 200) };
      }

      return { data: { action: "channel-efficiency", funnel: metrics, ...parsed }, tokensUsed: response.usage.totalTokens };
    }

    async recommendExperiment(metrics: FunnelMetrics): Promise<{ data: AnalyticsOutput; tokensUsed: number }> {
      const prompt = `Based on this funnel data, recommend the next highest-value experiment:

${JSON.stringify(metrics, null, 2)}

Return JSON:
{
  "insights": ["string — what the data tells us"],
  "recommendations": ["string — specific experiment to run with hypothesis and metric"],
  "risks": ["string — what could go wrong"],
  "summary": "string"
}

Experiment should have: hypothesis, primary metric, test design, minimum sample size.`;

      const response = await this.chat([{ role: "user", content: prompt }], { jsonMode: true });
      let parsed: { insights: string[]; recommendations: string[]; risks: string[]; summary: string };
      try {
        parsed = JSON.parse(response.content);
      } catch {
        parsed = { insights: [], recommendations: [], risks: [], summary: response.content.slice(0, 200) };
      }

      return { data: { action: "experiment-recommendation", funnel: metrics, ...parsed }, tokensUsed: response.usage.totalTokens };
    }

    async weeklyReport(metrics: FunnelMetrics): Promise<{ data: AnalyticsOutput; tokensUsed: number }> {
      const prompt = `Generate a weekly revenue operations report:

${JSON.stringify(metrics, null, 2)}

Return JSON:
{
  "insights": ["string — this week's highlights"],
  "recommendations": ["string — priority actions for next week"],
  "risks": ["string — things that need attention"],
  "summary": "string — executive summary (3-5 sentences)"
}

Structure: Pipeline health → Wins → Losses → Content → Next actions`;

      const response = await this.chat([{ role: "user", content: prompt }], { jsonMode: true });
      let parsed: { insights: string[]; recommendations: string[]; risks: string[]; summary: string };
      try {
        parsed = JSON.parse(response.content);
      } catch {
        parsed = { insights: [], recommendations: [], risks: [], summary: response.content.slice(0, 200) };
      }

      await events.emit({
        eventType: "analytics.report_generated",
        actor: "revenue-analyst",
        entityType: "system",
        entityId: "weekly",
        metadata: { totalCompanies: metrics.totalCompanies, revenue: metrics.revenue },
      });

      return { data: { action: "weekly-report", funnel: metrics, ...parsed }, tokensUsed: response.usage.totalTokens };
    }
  })();
}
