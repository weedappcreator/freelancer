/**
 * Orchestrator Agent
 * Coordinates the full revenue loop — dispatches agents in sequence,
 * enforces dependencies, prevents duplicate work, validates outputs.
 */

import { type LLMRegistry } from "../providers/llm.js";
import { type Config } from "../core/config.js";
import { companyRepo, contactRepo, icpRepo } from "../db/repository.js";
import { events } from "../events/emitter.js";
import { logger } from "../core/logger.js";
import { createMarketIntelligenceAgent } from "./market-intelligence.js";
import { createICPAgent } from "./icp.js";
import { createLeadDiscoveryAgent } from "./lead-discovery.js";
import { createEnrichmentAgent } from "./enrichment.js";
import { createQualificationAgent } from "./qualification.js";
import { createAccountResearchAgent } from "./account-research.js";
import { createOfferStrategist } from "./offer-strategist.js";
import { createPersonalizationAgent } from "./personalization.js";
import { createEmailAgent } from "./email.js";
import { createCRMAgent } from "./crm.js";
import { createRevenueAnalystAgent } from "./revenue-analyst.js";
import { SkillRegistry } from "../skills/loader.js";

export interface OrchestratorInput {
  mode: "full-pipeline" | "daily-ops" | "discover-only" | "outreach-only" | "analytics-only";
  vertical?: string;
  geography?: string;
  leadCount?: number;
  minScore?: number;
  channel?: "email" | "linkedin";
  dryRun?: boolean;
}

export interface PipelineStep {
  step: string;
  status: "completed" | "skipped" | "failed";
  result?: string;
  tokensUsed: number;
  durationMs: number;
}

export interface OrchestratorOutput {
  mode: string;
  steps: PipelineStep[];
  summary: string;
  totalTokens: number;
  totalDurationMs: number;
}

export function createOrchestrator(llm: LLMRegistry, config: Config) {
  const skills = new SkillRegistry(config.projectRoot);
  skills.loadAll();

  return {
    async run(input: OrchestratorInput): Promise<OrchestratorOutput> {
      const startTime = Date.now();
      const steps: PipelineStep[] = [];
      let totalTokens = 0;

      await events.emit({
        eventType: "agent.started",
        actor: "orchestrator",
        metadata: { mode: input.mode },
      });

      logger.info(`Orchestrator starting: ${input.mode}`, { mode: input.mode }, "orchestrator");

      try {
        switch (input.mode) {
          case "full-pipeline":
            await runFullPipeline(input, steps);
            break;
          case "daily-ops":
            await runDailyOps(input, steps);
            break;
          case "discover-only":
            await runDiscoverOnly(input, steps);
            break;
          case "outreach-only":
            await runOutreachOnly(input, steps);
            break;
          case "analytics-only":
            await runAnalyticsOnly(steps);
            break;
        }
      } catch (err) {
        steps.push({
          step: "error",
          status: "failed",
          result: err instanceof Error ? err.message : String(err),
          tokensUsed: 0,
          durationMs: 0,
        });
      }

      totalTokens = steps.reduce((s, st) => s + st.tokensUsed, 0);
      const totalDurationMs = Date.now() - startTime;

      const completed = steps.filter((s) => s.status === "completed").length;
      const failed = steps.filter((s) => s.status === "failed").length;

      await events.emit({
        eventType: "agent.completed",
        actor: "orchestrator",
        metadata: { mode: input.mode, steps: steps.length, completed, failed, totalTokens, totalDurationMs },
      });

      return {
        mode: input.mode,
        steps,
        summary: `${input.mode}: ${completed} completed, ${failed} failed, ${totalTokens} tokens, ${(totalDurationMs / 1000).toFixed(1)}s`,
        totalTokens,
        totalDurationMs,
      };
    },
  };

  async function runStep(
    name: string,
    fn: () => Promise<{ tokensUsed?: number; result?: string }>,
    steps: PipelineStep[]
  ) {
    const start = Date.now();
    try {
      const { tokensUsed, result } = await fn();
      steps.push({ step: name, status: "completed", result, tokensUsed: tokensUsed ?? 0, durationMs: Date.now() - start });
      logger.info(`Step completed: ${name}`, { result }, "orchestrator");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      steps.push({ step: name, status: "failed", result: msg, tokensUsed: 0, durationMs: Date.now() - start });
      logger.error(`Step failed: ${name}`, { error: msg }, "orchestrator");
    }
  }

  async function runFullPipeline(input: OrchestratorInput, steps: PipelineStep[]) {
    // 1. Market Intelligence
    await runStep("market-intelligence", async () => {
      const agent = createMarketIntelligenceAgent(llm, skills);
      const r = await agent.run({ vertical: input.vertical, geography: input.geography, depth: "standard" });
      return { tokensUsed: r.tokensUsed, result: r.data ? `${r.data.insights.length} insights, recommended: ${r.data.recommendedVerticals.join(", ")}` : r.error };
    }, steps);

    // 2. ICP Generation (if none exist)
    const existingICPs = icpRepo.list();
    if (existingICPs.length === 0) {
      await runStep("icp-generation", async () => {
        const agent = createICPAgent(llm);
        const r = await agent.run({ vertical: input.vertical, count: 3 });
        return { tokensUsed: r.tokensUsed, result: r.data ? `${r.data.profiles.length} ICPs created` : r.error };
      }, steps);
    } else {
      steps.push({ step: "icp-generation", status: "skipped", result: `${existingICPs.length} ICPs already exist`, tokensUsed: 0, durationMs: 0 });
    }

    // 3. Lead Discovery
    await runStep("lead-discovery", async () => {
      const agent = createLeadDiscoveryAgent(llm);
      const icps = icpRepo.listActive();
      const r = await agent.run({
        icpId: icps[0]?.id,
        vertical: input.vertical,
        count: input.leadCount ?? 10,
        geography: input.geography,
      });
      return { tokensUsed: r.tokensUsed, result: r.data?.summary ?? r.error };
    }, steps);

    // 4. Qualification
    await runStep("qualification", async () => {
      const agent = createQualificationAgent(llm);
      const r = await agent.run({ batchSize: 20 });
      return { tokensUsed: r.tokensUsed, result: r.data ? `Qualified: ${r.data.qualified}, Rejected: ${r.data.rejected}` : r.error };
    }, steps);

    // 5. Account Research (top qualified)
    const qualified = companyRepo.list({ minScore: input.minScore ?? 70, limit: 5 });
    if (qualified.length > 0) {
      await runStep("account-research", async () => {
        const agent = createAccountResearchAgent(llm);
        let researched = 0;
        let tokens = 0;
        for (const company of qualified.slice(0, 3)) {
          const r = await agent.run({ companyId: company.id });
          if (r.success) researched++;
          tokens += r.tokensUsed;
        }
        return { tokensUsed: tokens, result: `Researched ${researched}/${Math.min(3, qualified.length)} companies` };
      }, steps);

      // 6. Offer Design
      await runStep("offer-design", async () => {
        const agent = createOfferStrategist(llm);
        let designed = 0;
        let tokens = 0;
        for (const company of qualified.slice(0, 3)) {
          const r = await agent.run({ companyId: company.id });
          if (r.success) designed++;
          tokens += r.tokensUsed;
        }
        return { tokensUsed: tokens, result: `${designed} offers designed` };
      }, steps);

      // 7. Outreach Drafts (if not dry run)
      if (!input.dryRun) {
        await runStep("outreach-drafts", async () => {
          const agent = createPersonalizationAgent(llm);
          let drafted = 0;
          let tokens = 0;
          for (const company of qualified.slice(0, 3)) {
            const r = await agent.run({ companyId: company.id, channel: input.channel ?? "email" });
            if (r.success) drafted++;
            tokens += r.tokensUsed;
          }
          return { tokensUsed: tokens, result: `${drafted} outreach messages drafted` };
        }, steps);
      }
    } else {
      steps.push({ step: "account-research", status: "skipped", result: "No qualified leads yet", tokensUsed: 0, durationMs: 0 });
    }

    // 8. CRM Sync
    await runStep("crm-sync", async () => {
      const agent = createCRMAgent(llm, config);
      const r = await agent.run({ action: "push", batchSize: 20 });
      return { tokensUsed: r.tokensUsed, result: r.data?.summary ?? r.error };
    }, steps);

    // 9. Analytics
    await runStep("analytics", async () => {
      const agent = createRevenueAnalystAgent(llm);
      const r = await agent.run({ action: "funnel" });
      return { tokensUsed: r.tokensUsed, result: r.data?.summary ?? r.error };
    }, steps);
  }

  async function runDailyOps(input: OrchestratorInput, steps: PipelineStep[]) {
    // 1. Check follow-ups
    await runStep("check-followups", async () => {
      const agent = createEmailAgent(llm);
      const r = await agent.run({ action: "followup" });
      return { tokensUsed: r.tokensUsed, result: r.data?.summary ?? r.error };
    }, steps);

    // 2. Qualify pending leads
    await runStep("qualify-pending", async () => {
      const agent = createQualificationAgent(llm);
      const r = await agent.run({ batchSize: 10 });
      return { tokensUsed: r.tokensUsed, result: r.data ? `Qualified: ${r.data.qualified}` : r.error };
    }, steps);

    // 3. Research newly qualified
    const newlyQualified = companyRepo.list({ minScore: 70, limit: 3 });
    const unresearched = newlyQualified.filter((c) => !c.last_researched_at);
    if (unresearched.length > 0) {
      await runStep("research-new", async () => {
        const agent = createAccountResearchAgent(llm);
        let tokens = 0;
        for (const c of unresearched.slice(0, 2)) {
          const r = await agent.run({ companyId: c.id });
          tokens += r.tokensUsed;
        }
        return { tokensUsed: tokens, result: `Researched ${Math.min(2, unresearched.length)} new leads` };
      }, steps);
    }

    // 4. CRM sync
    await runStep("crm-sync", async () => {
      const agent = createCRMAgent(llm, config);
      const r = await agent.run({ action: "push", batchSize: 20 });
      return { tokensUsed: r.tokensUsed, result: r.data?.summary ?? r.error };
    }, steps);

    // 5. Quick analytics
    await runStep("daily-analytics", async () => {
      const agent = createRevenueAnalystAgent(llm);
      const r = await agent.run({ action: "funnel" });
      return { tokensUsed: r.tokensUsed, result: r.data?.summary ?? r.error };
    }, steps);
  }

  async function runDiscoverOnly(input: OrchestratorInput, steps: PipelineStep[]) {
    await runStep("market-intelligence", async () => {
      const agent = createMarketIntelligenceAgent(llm, skills);
      const r = await agent.run({ vertical: input.vertical, geography: input.geography, depth: "standard" });
      return { tokensUsed: r.tokensUsed, result: r.data ? `${r.data.insights.length} insights` : r.error };
    }, steps);

    await runStep("lead-discovery", async () => {
      const agent = createLeadDiscoveryAgent(llm);
      const r = await agent.run({ vertical: input.vertical, count: input.leadCount ?? 10, geography: input.geography });
      return { tokensUsed: r.tokensUsed, result: r.data?.summary ?? r.error };
    }, steps);

    await runStep("enrichment", async () => {
      const agent = createEnrichmentAgent(llm);
      const companies = companyRepo.list({ limit: 10 });
      let tokens = 0;
      let enriched = 0;
      for (const c of companies.slice(0, 5)) {
        const r = await agent.run({ companyId: c.id });
        if (r.success) enriched++;
        tokens += r.tokensUsed;
      }
      return { tokensUsed: tokens, result: `Enriched ${enriched} companies` };
    }, steps);

    await runStep("qualification", async () => {
      const agent = createQualificationAgent(llm);
      const r = await agent.run({ batchSize: 20 });
      return { tokensUsed: r.tokensUsed, result: r.data ? `Qualified: ${r.data.qualified}` : r.error };
    }, steps);
  }

  async function runOutreachOnly(input: OrchestratorInput, steps: PipelineStep[]) {
    const qualified = companyRepo.list({ minScore: input.minScore ?? 70, limit: 5 });
    if (qualified.length === 0) {
      steps.push({ step: "outreach", status: "skipped", result: "No qualified leads", tokensUsed: 0, durationMs: 0 });
      return;
    }

    await runStep("research-and-offer", async () => {
      const researchAgent = createAccountResearchAgent(llm);
      const offerAgent = createOfferStrategist(llm);
      let tokens = 0;
      for (const c of qualified.slice(0, 3)) {
        const r1 = await researchAgent.run({ companyId: c.id });
        const r2 = await offerAgent.run({ companyId: c.id });
        tokens += r1.tokensUsed + r2.tokensUsed;
      }
      return { tokensUsed: tokens, result: `Researched and designed offers for ${Math.min(3, qualified.length)} companies` };
    }, steps);

    await runStep("draft-outreach", async () => {
      const agent = createPersonalizationAgent(llm);
      let tokens = 0;
      let drafted = 0;
      for (const c of qualified.slice(0, 3)) {
        const r = await agent.run({ companyId: c.id, channel: input.channel ?? "email" });
        if (r.success) drafted++;
        tokens += r.tokensUsed;
      }
      return { tokensUsed: tokens, result: `${drafted} messages drafted` };
    }, steps);
  }

  async function runAnalyticsOnly(steps: PipelineStep[]) {
    await runStep("funnel-analysis", async () => {
      const agent = createRevenueAnalystAgent(llm);
      const r = await agent.run({ action: "funnel" });
      return { tokensUsed: r.tokensUsed, result: r.data?.summary ?? r.error };
    }, steps);

    await runStep("weekly-report", async () => {
      const agent = createRevenueAnalystAgent(llm);
      const r = await agent.run({ action: "weekly-report" });
      return { tokensUsed: r.tokensUsed, result: r.data?.summary ?? r.error };
    }, steps);

    await runStep("experiment-recommendation", async () => {
      const agent = createRevenueAnalystAgent(llm);
      const r = await agent.run({ action: "experiment-recommendation" });
      return { tokensUsed: r.tokensUsed, result: r.data?.summary ?? r.error };
    }, steps);
  }
}
