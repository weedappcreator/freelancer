#!/usr/bin/env node

/**
 * Freelance Revenue OS — CLI Entry Point
 * Primary control surface for all operations.
 */

import { Command } from "commander";
import chalk from "chalk";
import { z } from "zod";
import { loadConfig } from "../core/config.js";
import { logger } from "../core/logger.js";
import { initializeDatabase } from "../db/database.js";
import { loadOperatorContext } from "../core/operator.js";
import { LLMRegistry } from "../providers/llm.js";
import { events } from "../events/emitter.js";
import { SkillRegistry } from "../skills/loader.js";
import { PaperclipBridge } from "../dashboard/paperclip.js";
import { createMarketIntelligenceAgent } from "../agents/market-intelligence.js";
import { createICPAgent } from "../agents/icp.js";
import { createLeadDiscoveryAgent } from "../agents/lead-discovery.js";
import { createEnrichmentAgent } from "../agents/enrichment.js";
import { createQualificationAgent } from "../agents/qualification.js";
import { createAccountResearchAgent } from "../agents/account-research.js";
import { companyRepo, contactRepo, icpRepo, isDuplicateCompany } from "../db/repository.js";
import { createCRMAgent } from "../agents/crm.js";
import { createOfferStrategist } from "../agents/offer-strategist.js";
import { createPersonalizationAgent } from "../agents/personalization.js";
import { createEmailAgent } from "../agents/email.js";
import { createSalesAgent } from "../agents/sales.js";
import { createProposalAgent } from "../agents/proposal.js";
import { createSocialIntelligenceAgent } from "../agents/social-intelligence.js";
import { createContentIntelligenceAgent } from "../agents/content-intelligence.js";
import { createRevenueAnalystAgent } from "../agents/revenue-analyst.js";
import { getDb } from "../db/database.js";
import { createOrchestrator } from "../agents/orchestrator.js";

const program = new Command();

program
  .name("freelance")
  .description("Freelance Revenue OS — AI-powered client acquisition system")
  .version("0.1.0");

// ─── Run (Orchestrator) ─────────────────────────────────────────────

program
  .command("run")
  .description("Run the full revenue pipeline or a specific mode")
  .option("--mode <m>", "Mode: full-pipeline|daily-ops|discover-only|outreach-only|analytics-only", "full-pipeline")
  .option("--vertical <name>", "Target vertical")
  .option("--geography <geo>", "Target geography")
  .option("--leads <n>", "Number of leads to discover", "10")
  .option("--min-score <n>", "Minimum qualification score", "70")
  .option("--channel <ch>", "Outreach channel: email|linkedin", "email")
  .option("--dry-run", "Draft only, no outreach")
  .action(async (opts) => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);
    loadOperatorContext(config.projectRoot);
    const llm = new LLMRegistry(config);

    console.log(chalk.bold(`\n  Freelance Revenue OS — ${opts.mode}\n`));
    console.log(chalk.dim(`  Provider: ${config.llmProvider} | Approval: Level ${config.approvalLevel}\n`));

    const orchestrator = createOrchestrator(llm, config);
    const result = await orchestrator.run({
      mode: opts.mode,
      vertical: opts.vertical,
      geography: opts.geography,
      leadCount: parseInt(opts.leads, 10),
      minScore: parseInt(opts.minScore, 10),
      channel: opts.channel,
      dryRun: opts.dryRun,
    });

    for (const step of result.steps) {
      const icon = step.status === "completed" ? chalk.green("✓") : step.status === "skipped" ? chalk.yellow("○") : chalk.red("✗");
      const time = step.durationMs > 0 ? chalk.dim(` (${(step.durationMs / 1000).toFixed(1)}s)`) : "";
      console.log(`  ${icon} ${step.step.padEnd(25)} ${step.result ?? ""}${time}`);
    }

    console.log(chalk.bold(`\n  ${result.summary}`));
    console.log(chalk.dim(`  Total: ${result.totalTokens} tokens, ${(result.totalDurationMs / 1000).toFixed(1)}s\n`));
  });

// ─── Status ─────────────────────────────────────────────────────────

program
  .command("status")
  .description("System health check and overview")
  .action(async () => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);
    const llm = new LLMRegistry(config);

    console.log(chalk.bold("\n  Freelance Revenue OS v0.1.0\n"));
    console.log(chalk.dim("  ─────────────────────────────────────"));

    // LLM Providers
    const configured = llm.listConfigured();
    console.log(chalk.cyan("  LLM Providers:"));
    console.log(`    Default: ${chalk.green(config.llmProvider)}`);
    console.log(`    Configured: ${configured.length > 0 ? configured.map(p => chalk.green(p)).join(", ") : chalk.red("none")}`);

    // Operator Context
    const ctx = loadOperatorContext(config.projectRoot);
    console.log(chalk.cyan("\n  Operator Context:"));
    console.log(`    ${ctx.length > 50 ? chalk.green("Loaded") : chalk.yellow("Not found")}`);

    // Database
    console.log(chalk.cyan("\n  Database:"));
    console.log(`    Path: ${config.dbPath}`);
    console.log(`    Status: ${chalk.green("Connected")}`);

    // Approval Level
    const levelLabels = ["READ ONLY", "DRAFT", "BOUNDED EXEC", "AUTO LOW-RISK", "RESTRICTED"];
    console.log(chalk.cyan("\n  Approval Level:"));
    console.log(`    Level ${config.approvalLevel}: ${levelLabels[config.approvalLevel]}`);

    // HubSpot
    console.log(chalk.cyan("\n  Integrations:"));
    console.log(`    HubSpot: ${config.hubspotAccessToken ? chalk.green("Configured") : chalk.dim("Not configured")}`);
    console.log(`    Email:   ${config.smtpHost ? chalk.green("Configured") : chalk.dim("Not configured")}`);

    // Recent events
    const recentEvents = events.query({ limit: 5 });
    console.log(chalk.cyan("\n  Recent Events:"));
    if (recentEvents.length === 0) {
      console.log(chalk.dim("    No events recorded yet"));
    } else {
      for (const e of recentEvents) {
        console.log(`    ${e.occurredAt.split("T")[1]?.slice(0, 8)} ${e.eventType} (${e.actor})`);
      }
    }

    console.log(chalk.dim("\n  ─────────────────────────────────────\n"));
  });

// ─── Doctor ─────────────────────────────────────────────────────────

program
  .command("doctor")
  .description("Diagnose configuration and integration health")
  .action(async () => {
    console.log(chalk.bold("\n  Running diagnostics...\n"));
    const checks: Array<{ name: string; status: "ok" | "warn" | "fail"; detail: string }> = [];

    try {
      const config = loadConfig();
      checks.push({ name: "Config", status: "ok", detail: "Loaded successfully" });

      // DB
      try {
        initializeDatabase(config.dbPath);
        checks.push({ name: "Database", status: "ok", detail: config.dbPath });
      } catch {
        checks.push({ name: "Database", status: "fail", detail: "Cannot initialize" });
      }

      // LLM
      const llm = new LLMRegistry(config);
      const configured = llm.listConfigured();
      if (configured.length > 0) {
        checks.push({ name: "LLM Provider", status: "ok", detail: configured.join(", ") });
      } else {
        checks.push({ name: "LLM Provider", status: "fail", detail: "No API keys configured in .env" });
      }

      // Operator context
      const ctx = loadOperatorContext(config.projectRoot);
      checks.push({
        name: "Operator Context",
        status: ctx.length > 100 ? "ok" : "warn",
        detail: ctx.length > 100 ? "Loaded" : "Missing or empty",
      });

      // HubSpot
      checks.push({
        name: "HubSpot",
        status: config.hubspotAccessToken ? "ok" : "warn",
        detail: config.hubspotAccessToken ? "Token configured" : "Not configured (optional)",
      });

      // Email
      checks.push({
        name: "Email (SMTP)",
        status: config.smtpHost ? "ok" : "warn",
        detail: config.smtpHost ? `${config.smtpHost}:${config.smtpPort}` : "Not configured (optional)",
      });
    } catch (err) {
      checks.push({ name: "Config", status: "fail", detail: String(err) });
    }

    const icons = { ok: chalk.green("  PASS"), warn: chalk.yellow("  WARN"), fail: chalk.red("  FAIL") };
    for (const c of checks) {
      console.log(`  ${icons[c.status]}  ${c.name.padEnd(20)} ${chalk.dim(c.detail)}`);
    }
    console.log();
  });

// ─── Market Intelligence ────────────────────────────────────────────

program
  .command("market")
  .description("Run market intelligence analysis")
  .option("--vertical <name>", "Focus on a specific vertical")
  .option("--geography <geo>", "Target geography")
  .option("--depth <level>", "Analysis depth: quick|standard|deep", "standard")
  .action(async (opts) => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);
    loadOperatorContext(config.projectRoot);
    const llm = new LLMRegistry(config);
    const skills = new SkillRegistry(config.projectRoot);
    skills.loadAll();

    console.log(chalk.cyan("\n  Running market intelligence analysis...\n"));
    const agent = createMarketIntelligenceAgent(llm, skills);
    const result = await agent.run({
      vertical: opts.vertical,
      geography: opts.geography,
      depth: opts.depth,
    });

    if (!result.success || !result.data) {
      console.log(chalk.red(`  Error: ${result.error}`));
      return;
    }

    for (const insight of result.data.insights) {
      console.log(chalk.bold(`\n  ${insight.vertical}`) + chalk.dim(` (confidence: ${(insight.confidence * 100).toFixed(0)}%)`));
      console.log(chalk.cyan("  Pain Points:"));
      insight.painPoints.forEach((p) => console.log(`    - ${p}`));
      console.log(chalk.cyan("  AI Opportunities:"));
      insight.aiOpportunities.forEach((o) => console.log(`    - ${o}`));
      console.log(chalk.cyan("  Company Examples:"));
      insight.companyExamples.forEach((c) => console.log(`    - ${c.name}${c.domain ? ` (${c.domain})` : ""}: ${c.reason}`));
    }

    console.log(chalk.green(`\n  Recommended verticals: ${result.data.recommendedVerticals.join(", ")}`));
    console.log(chalk.dim(`  Tokens used: ${result.tokensUsed} | Duration: ${result.durationMs}ms\n`));
  });

// ─── ICP ────────────────────────────────────────────────────────────

const icpCmd = program.command("icp").description("Ideal Customer Profile management");

icpCmd
  .command("generate")
  .description("Generate ICPs using AI analysis")
  .option("--vertical <name>", "Focus vertical")
  .option("--count <n>", "Number of ICPs to generate", "3")
  .action(async (opts) => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);
    loadOperatorContext(config.projectRoot);
    const llm = new LLMRegistry(config);

    console.log(chalk.cyan("\n  Generating ICPs...\n"));
    const agent = createICPAgent(llm);
    const result = await agent.run({ vertical: opts.vertical, count: parseInt(opts.count, 10) });

    if (!result.success || !result.data) {
      console.log(chalk.red(`  Error: ${result.error}`));
      return;
    }

    for (const p of result.data.profiles) {
      console.log(chalk.bold(`\n  ${p.name}`));
      console.log(`    Industry: ${p.industry} | Size: ${p.companySize} | Budget: ${p.likelyBudget}`);
      console.log(`    Pain: ${chalk[p.painIntensity === "high" ? "red" : p.painIntensity === "medium" ? "yellow" : "dim"](p.painIntensity)} | Urgency: ${p.urgency}`);
      console.log(`    Best service: ${p.serviceFit}`);
      console.log(chalk.dim(`    ${p.rationale}`));
    }

    console.log(chalk.green(`\n  ${result.data.saved.length} ICPs saved to database\n`));
  });

icpCmd
  .command("list")
  .description("List all ICPs")
  .action(async () => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);
    const icps = icpRepo.list();
    if (icps.length === 0) {
      console.log(chalk.dim("\n  No ICPs yet. Run: freelance icp generate\n"));
      return;
    }
    console.log(chalk.bold(`\n  ICPs (${icps.length})\n`));
    for (const i of icps) {
      const status = i.active ? chalk.green("active") : chalk.dim("inactive");
      console.log(`  ${status} ${chalk.bold(i.name)} — ${i.industry} | ${i.company_size ?? "any size"} | ${i.pain_intensity ?? "?"} pain`);
      console.log(chalk.dim(`         ID: ${i.id}`));
    }
    console.log();
  });

// ─── Leads ──────────────────────────────────────────────────────────

const leads = program.command("leads").description("Lead management");

leads
  .command("discover")
  .description("Discover new leads matching an ICP")
  .option("--icp <id>", "ICP identifier")
  .option("--vertical <name>", "Target vertical")
  .option("--count <n>", "Number of leads to find", "10")
  .option("--geography <geo>", "Target geography")
  .action(async (opts) => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);
    loadOperatorContext(config.projectRoot);
    const llm = new LLMRegistry(config);

    console.log(chalk.cyan("\n  Discovering leads...\n"));
    const agent = createLeadDiscoveryAgent(llm);
    const result = await agent.run({
      icpId: opts.icp,
      vertical: opts.vertical,
      count: parseInt(opts.count, 10),
      geography: opts.geography,
    });

    if (!result.success || !result.data) {
      console.log(chalk.red(`  Error: ${result.error}`));
      return;
    }

    for (const lead of result.data.discovered) {
      console.log(chalk.bold(`  ${lead.companyName}`) + (lead.domain ? chalk.dim(` (${lead.domain})`) : ""));
      console.log(`    ${lead.reason}`);
      console.log(chalk.dim(`    Signals: ${lead.signals.join(", ")}`));
      console.log(chalk.dim(`    Contacts: ${lead.contacts.map((c) => `${c.firstName ?? ""} ${c.lastName ?? ""} — ${c.title ?? "?"}`).join("; ")}`));
    }

    console.log(chalk.green(`\n  ${result.data.summary}`));
    console.log(chalk.dim(`  Tokens: ${result.tokensUsed} | Duration: ${result.durationMs}ms\n`));
  });

leads
  .command("qualify")
  .description("Score and qualify pending leads")
  .option("--company <id>", "Qualify a specific company")
  .option("--batch <n>", "Batch size", "10")
  .action(async (opts) => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);
    loadOperatorContext(config.projectRoot);
    const llm = new LLMRegistry(config);

    console.log(chalk.cyan("\n  Qualifying leads...\n"));
    const agent = createQualificationAgent(llm);
    const result = await agent.run({
      companyId: opts.company,
      batchSize: parseInt(opts.batch, 10),
    });

    if (!result.success || !result.data) {
      console.log(chalk.red(`  Error: ${result.error}`));
      return;
    }

    for (const s of result.data.scores) {
      const color = s.totalScore >= 70 ? "green" : s.totalScore >= 50 ? "yellow" : "red";
      console.log(`  ${chalk[color](`${s.totalScore}/100`)} ${chalk.bold(s.companyName)} → ${s.recommendedAction}`);
      console.log(chalk.dim(`    Fit:${s.fitScore} Pain:${s.painScore} Intent:${s.intentScore} Timing:${s.timingScore} Access:${s.accessScore} Offer:${s.offerFit}`));
      console.log(chalk.dim(`    Best offer: ${s.bestOffer}`));
    }

    console.log(chalk.green(`\n  Qualified: ${result.data.qualified} | Rejected: ${result.data.rejected}\n`));
  });

leads
  .command("enrich <companyId>")
  .description("Enrich a company with additional data")
  .action(async (companyId: string) => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);
    loadOperatorContext(config.projectRoot);
    const llm = new LLMRegistry(config);

    console.log(chalk.cyan("\n  Enriching company data...\n"));
    const agent = createEnrichmentAgent(llm);
    const result = await agent.run({ companyId });

    if (!result.success || !result.data) {
      console.log(chalk.red(`  Error: ${result.error}`));
      return;
    }

    const d = result.data.data;
    console.log(chalk.bold(`  ${result.data.companyId}`));
    console.log(`  Industry: ${d.industry} | Geography: ${d.geography} | Size: ${d.employeeBand}`);
    if (d.techStack.length) console.log(`  Tech: ${d.techStack.join(", ")}`);
    if (d.recentSignals.length) console.log(`  Signals: ${d.recentSignals.join("; ")}`);
    console.log(chalk.green(`\n  ${result.data.summary}\n`));
  });

leads
  .command("inspect <id>")
  .description("View detailed company/lead information")
  .action(async (id: string) => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);

    const company = companyRepo.findById(id) ?? companyRepo.search(id)[0];
    if (!company) {
      console.log(chalk.red(`  Company not found: ${id}`));
      return;
    }

    const contacts = contactRepo.findByCompany(company.id);
    console.log(chalk.bold(`\n  ${company.name}`) + (company.domain ? chalk.dim(` (${company.domain})`) : ""));
    console.log(`  ID: ${company.id}`);
    console.log(`  Industry: ${company.industry ?? "?"} | Geography: ${company.geography ?? "?"} | Size: ${company.employee_band ?? "?"}`);
    if (company.total_score !== null) {
      console.log(`  Score: ${company.total_score}/100 (Fit:${company.fit_score} Pain:${company.pain_score} Intent:${company.intent_score})`);
    }
    if (company.research_summary) console.log(`  Research: ${company.research_summary}`);

    if (contacts.length) {
      console.log(chalk.cyan(`\n  Contacts (${contacts.length}):`));
      for (const c of contacts) {
        console.log(`    ${c.first_name ?? ""} ${c.last_name ?? ""} — ${c.title ?? "?"} [${c.stage}]`);
        if (c.email) console.log(chalk.dim(`      ${c.email}`));
      }
    }
    console.log();
  });

leads
  .command("import <file>")
  .description("Import verified web-research leads from a scraper JSON file")
  .option("--icp <id>", "Attach imported companies to an ICP")
  .option("--dry-run", "Show what would be imported without writing")
  .action(async (file: string, opts) => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);

    const { readFileSync, existsSync } = await import("node:fs");
    const { resolve } = await import("node:path");

    const path = resolve(config.projectRoot, file);
    if (!existsSync(path)) {
      console.log(chalk.red(`  File not found: ${file}`));
      return;
    }

    const LeadSchema = z.object({
      name: z.string().min(1),
      domain: z.string().nullable().optional(),
      industry: z.string().nullable().optional(),
      geography: z.string().nullable().optional(),
      employee_estimate: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      contact: z.object({
        email: z.string().nullable().optional(),
        contact_page_url: z.string().nullable().optional(),
        phone: z.string().nullable().optional(),
        address: z.string().nullable().optional(),
      }).catchall(z.unknown()).optional(),
      buying_signals: z.array(z.string()).optional(),
      operational_friction: z.array(z.string()).optional(),
      evidence: z.array(z.string()).optional(),
      services: z.array(z.string()).optional(),
      verified: z.boolean().optional(),
      url: z.string().optional(),
      query: z.string().optional(),
      verification_notes: z.array(z.string()).optional(),
    });
    const PayloadSchema = z.object({
      vertical: z.string().optional(),
      geography: z.string().optional(),
      language: z.string().optional(),
      leads: z.array(LeadSchema),
    });

    let payload: z.infer<typeof PayloadSchema>;
    try {
      payload = PayloadSchema.parse(JSON.parse(readFileSync(path, "utf8")));
    } catch (err) {
      console.log(chalk.red(`  Invalid research file: ${err instanceof Error ? err.message : String(err)}`));
      return;
    }

    console.log(chalk.bold(`\n  Importing ${payload.leads.length} researched leads${opts.dryRun ? " (dry run)" : ""}\n`));

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let inboxes = 0;

    for (const lead of payload.leads) {
      const email = lead.contact?.email ?? null;
      const contactPage = lead.contact?.contact_page_url ?? null;
      const phone = lead.contact?.phone ?? null;
      if (!email && !contactPage && !phone) {
        skipped++;
        console.log(chalk.dim(`  – ${lead.name} (no published contact channel, skipped)`));
        continue;
      }

      const dup = isDuplicateCompany(lead.name, lead.domain ?? undefined);
      const evidence = JSON.stringify({
        source_url: lead.url ?? null,
        search_query: lead.query ?? null,
        buying_signals: lead.buying_signals ?? [],
        operational_friction: lead.operational_friction ?? [],
        quotes: lead.evidence ?? [],
        services: lead.services ?? [],
        verification_notes: lead.verification_notes ?? [],
        contact_page_url: contactPage,
        phone,
        address: lead.contact?.address ?? null,
        verified: lead.verified ?? false,
      });
      const summary = [
        lead.description ?? "",
        lead.buying_signals?.length ? ` Signals: ${lead.buying_signals.slice(0, 3).join("; ")}` : "",
      ].join("").slice(0, 2000);

      if (opts.dryRun) {
        console.log(`  ${dup ? chalk.yellow("~ update") : chalk.green("+ new  ")} ${chalk.bold(lead.name)} ${chalk.dim(lead.domain ?? "")} — ${email ?? contactPage ?? phone}`);
        if (dup) updated++; else created++;
        continue;
      }

      const { row, created: isNew } = companyRepo.upsert({
        name: lead.name,
        domain: lead.domain ?? undefined,
        industry: lead.industry ?? payload.vertical ?? undefined,
        geography: lead.geography ?? payload.geography ?? undefined,
        employee_band: lead.employee_estimate ?? undefined,
        research_summary: summary || undefined,
        evidence,
        source: "web-research",
        icp_id: opts.icp ?? undefined,
      });
      if (isNew) created++; else updated++;

      // Store the business-published inbox so drafts target a real, published channel
      if (email) {
        const { created: inboxNew } = contactRepo.upsert({
          company_id: row.id,
          title: "Published business contact",
          email,
          source: "web-research",
          stage: "LEAD_DISCOVERY",
        });
        if (inboxNew) inboxes++;
      }

      await events.emit({
        eventType: "lead.discovered",
        actor: "research-import",
        entityType: "company",
        entityId: row.id,
        metadata: { name: lead.name, source: "web-research", verified: lead.verified ?? false },
      });

      console.log(`  ${isNew ? chalk.green("+") : chalk.yellow("~")} ${chalk.bold(lead.name)} ${chalk.dim(lead.domain ?? "")} — ${email ?? contactPage ?? phone}`);
    }

    console.log(chalk.green(`\n  Companies created: ${created} | updated: ${updated} | skipped: ${skipped} | business inboxes stored: ${inboxes}\n`));
  });

leads
  .command("list")
  .description("List all companies in the database")
  .option("--min-score <n>", "Minimum qualification score")
  .option("--limit <n>", "Max results", "20")
  .action(async (opts) => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);

    const companies = companyRepo.list({
      minScore: opts.minScore ? parseInt(opts.minScore, 10) : undefined,
      limit: parseInt(opts.limit, 10),
    });

    if (companies.length === 0) {
      console.log(chalk.dim("\n  No leads yet. Run: freelance leads discover\n"));
      return;
    }

    console.log(chalk.bold(`\n  Leads (${companies.length})\n`));
    for (const c of companies) {
      const score = c.total_score !== null ? `${c.total_score}/100` : "unscored";
      const color = (c.total_score ?? 0) >= 70 ? "green" : (c.total_score ?? 0) >= 50 ? "yellow" : "dim";
      console.log(`  ${chalk[color](score.padEnd(10))} ${chalk.bold(c.name)} — ${c.industry ?? "?"} ${chalk.dim(c.domain ?? "")}`);
    }
    console.log();
  });

// ─── Research ───────────────────────────────────────────────────────

program
  .command("research <companyId>")
  .description("Deep research a qualified company")
  .action(async (companyId: string) => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);
    loadOperatorContext(config.projectRoot);
    const llm = new LLMRegistry(config);

    // Try to find by ID or name
    let id = companyId;
    const bySearch = companyRepo.search(companyId);
    if (bySearch.length > 0 && bySearch[0].id !== companyId) {
      id = bySearch[0].id;
      console.log(chalk.dim(`  Matched: ${bySearch[0].name}`));
    }

    console.log(chalk.cyan("\n  Running deep account research...\n"));
    const agent = createAccountResearchAgent(llm);
    const result = await agent.run({ companyId: id });

    if (!result.success || !result.data) {
      console.log(chalk.red(`  Error: ${result.error}`));
      return;
    }

    const r = result.data;
    console.log(chalk.bold(`  ${r.companyName}\n`));
    console.log(chalk.cyan("  What they do:") + ` ${r.whatTheyDo}`);
    console.log(chalk.cyan("  Decision maker:") + ` ${r.decisionMaker}`);
    console.log(chalk.cyan("  Recent changes:") + ` ${r.recentChanges}`);
    console.log(chalk.cyan("  Observable problem:") + ` ${r.observableProblem}`);
    console.log(chalk.cyan("  Our match:") + ` ${r.operatorCapabilityMatch}`);
    console.log(chalk.cyan("  Outreach angle:") + ` ${r.outreachAngle}`);
    console.log(chalk.cyan("  Recommended offer:") + ` ${r.recommendedOffer}`);
    console.log(chalk.red("\n  Do NOT claim:"));
    r.doNotClaim.forEach((d) => console.log(`    - ${d}`));
    console.log(chalk.green("\n  Personalization hooks:"));
    r.personalizationHooks.forEach((h) => console.log(`    - ${h}`));
    console.log(chalk.dim(`\n  Tokens: ${result.tokensUsed} | Duration: ${result.durationMs}ms\n`));
  });

// ─── CRM ────────────────────────────────────────────────────────────

const crm = program.command("crm").description("HubSpot CRM management");

crm
  .command("sync")
  .description("Sync local data to HubSpot")
  .option("--company <id>", "Sync a specific company")
  .option("--batch <n>", "Batch size", "20")
  .action(async (opts) => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);
    const llm = new LLMRegistry(config);

    console.log(chalk.cyan("\n  Syncing to HubSpot...\n"));
    const agent = createCRMAgent(llm, config);
    const result = await agent.run({ action: "push", companyId: opts.company, batchSize: parseInt(opts.batch, 10) });

    if (!result.success || !result.data) {
      console.log(chalk.red(`  Error: ${result.error}`));
      return;
    }

    console.log(chalk.green(`  ${result.data.summary}`));
    if (result.data.errors.length) {
      console.log(chalk.yellow(`\n  Errors (${result.data.errors.length}):`));
      result.data.errors.forEach((e) => console.log(chalk.dim(`    - ${e}`)));
    }
    console.log();
  });

crm
  .command("status")
  .description("Check HubSpot connection and sync status")
  .action(async () => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);
    const llm = new LLMRegistry(config);

    const agent = createCRMAgent(llm, config);
    const result = await agent.run({ action: "status" });

    if (!result.success || !result.data) {
      console.log(chalk.red(`  Error: ${result.error}`));
      return;
    }

    console.log(chalk.bold("\n  CRM Status\n"));
    console.log(`  ${result.data.summary}`);
    console.log();
  });

// ─── Offer ──────────────────────────────────────────────────────────

program
  .command("offer <companyId>")
  .description("Design a targeted offer for a company")
  .action(async (companyId: string) => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);
    loadOperatorContext(config.projectRoot);
    const llm = new LLMRegistry(config);

    let id = companyId;
    const bySearch = companyRepo.search(companyId);
    if (bySearch.length > 0 && bySearch[0].id !== companyId) {
      id = bySearch[0].id;
      console.log(chalk.dim(`  Matched: ${bySearch[0].name}`));
    }

    console.log(chalk.cyan("\n  Designing targeted offer...\n"));
    const agent = createOfferStrategist(llm);
    const result = await agent.run({ companyId: id });

    if (!result.success || !result.data) {
      console.log(chalk.red(`  Error: ${result.error}`));
      return;
    }

    const o = result.data;
    console.log(chalk.bold(`  ${o.offerTitle}`) + chalk.dim(` (${o.offerFamily})`));
    console.log(chalk.cyan("\n  Problem:") + ` ${o.problemStatement}`);
    console.log(chalk.cyan("  Outcome:") + ` ${o.proposedOutcome}`);
    console.log(chalk.cyan("  Scope:") + ` ${o.scope}`);
    console.log(chalk.cyan("  Why credible:") + ` ${o.whyCredible}`);
    console.log(chalk.cyan("  Value:") + ` ${o.estimatedValue}`);
    console.log(chalk.green("\n  CTA:") + ` ${o.cta}`);
    if (o.proofPoints.length) {
      console.log(chalk.cyan("\n  Proof points:"));
      o.proofPoints.forEach((p) => console.log(`    - ${p}`));
    }
    if (o.doNotPromise.length) {
      console.log(chalk.red("\n  Do NOT promise:"));
      o.doNotPromise.forEach((d) => console.log(`    - ${d}`));
    }
    console.log(chalk.dim(`\n  Tokens: ${result.tokensUsed} | Duration: ${result.durationMs}ms\n`));
  });

// ─── Outreach ───────────────────────────────────────────────────────

const outreach = program.command("outreach").description("Outreach copy and email management");

outreach
  .command("draft <companyId>")
  .description("Generate personalized outreach copy for a company")
  .option("--channel <ch>", "Channel: email|linkedin", "email")
  .option("--contact <id>", "Specific contact ID")
  .action(async (companyId: string, opts) => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);
    loadOperatorContext(config.projectRoot);
    const llm = new LLMRegistry(config);

    let id = companyId;
    const bySearch = companyRepo.search(companyId);
    if (bySearch.length > 0 && bySearch[0].id !== companyId) {
      id = bySearch[0].id;
      console.log(chalk.dim(`  Matched: ${bySearch[0].name}`));
    }

    console.log(chalk.cyan(`\n  Drafting ${opts.channel} outreach...\n`));
    const agent = createPersonalizationAgent(llm);
    const result = await agent.run({
      companyId: id,
      contactId: opts.contact,
      channel: opts.channel,
    });

    if (!result.success || !result.data) {
      console.log(chalk.red(`  Error: ${result.error}`));
      return;
    }

    const m = result.data;
    console.log(chalk.bold(`  Subject: ${m.subjectLine}`));
    console.log(chalk.dim(`  Channel: ${m.channel} | Words: ${m.wordCount} | Tone: ${m.tone}\n`));
    console.log(chalk.white(m.fullMessage));
    if (m.evidenceCited.length) {
      console.log(chalk.cyan("\n  Evidence cited:"));
      m.evidenceCited.forEach((e) => console.log(`    - ${e}`));
    }
    if (m.claimsAvoided.length) {
      console.log(chalk.red("\n  Claims avoided:"));
      m.claimsAvoided.forEach((c) => console.log(`    - ${c}`));
    }
    console.log(chalk.dim(`\n  Tokens: ${result.tokensUsed} | Duration: ${result.durationMs}ms\n`));
  });

outreach
  .command("followup <contactId>")
  .description("Draft a follow-up email in the sequence")
  .option("--channel <ch>", "Channel: email|linkedin", "email")
  .action(async (contactId: string, opts) => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);
    const llm = new LLMRegistry(config);

    console.log(chalk.cyan("\n  Drafting follow-up...\n"));
    const agent = createEmailAgent(llm);
    const result = await agent.run({ action: "draft", contactId, channel: opts.channel });

    if (!result.success || !result.data) {
      console.log(chalk.red(`  Error: ${result.error}`));
      return;
    }

    if (result.data.drafts?.length) {
      const d = result.data.drafts[0];
      console.log(chalk.bold(`  Step ${d.sequenceStep}/4`));
      console.log(chalk.cyan("  Subject:") + ` ${d.subject}`);
      console.log(chalk.white(`\n${d.body}\n`));
      console.log(chalk.dim(`  Status: ${d.status} | ID: ${d.id}`));
    }
    console.log(chalk.green(`\n  ${result.data.summary}\n`));
  });

outreach
  .command("classify")
  .description("Classify a reply and suggest next action")
  .option("--contact <id>", "Contact ID for stage update")
  .option("--text <reply>", "Reply text to classify")
  .action(async (opts) => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);
    const llm = new LLMRegistry(config);

    if (!opts.text) {
      console.log(chalk.red("  --text <reply> is required"));
      return;
    }

    console.log(chalk.cyan("\n  Classifying reply...\n"));
    const agent = createEmailAgent(llm);
    const result = await agent.run({ action: "classify", contactId: opts.contact, replyText: opts.text });

    if (!result.success || !result.data?.classification) {
      console.log(chalk.red(`  Error: ${result.error}`));
      return;
    }

    const c = result.data.classification;
    const color = ["positive_interest", "meeting_request"].includes(c.classification)
      ? "green"
      : ["unsubscribe", "negative", "bounce"].includes(c.classification)
        ? "red"
        : "yellow";
    console.log(chalk[color](`  Classification: ${c.classification}`) + chalk.dim(` (${Math.round(c.confidence * 100)}%)`));
    console.log(chalk.cyan("  Sentiment:") + ` ${c.sentiment}`);
    console.log(chalk.cyan("  Action:") + ` ${c.suggestedAction}`);
    console.log(chalk.cyan("  Follow up:") + ` ${c.shouldFollowUp ? `Yes (in ${c.followUpDelayDays ?? "?"}d)` : "No"}`);
    if (c.suggestedReply) {
      console.log(chalk.cyan("\n  Suggested reply:"));
      console.log(chalk.white(`  ${c.suggestedReply}`));
    }
    console.log(chalk.dim(`\n  ${c.notes}\n`));
  });

outreach
  .command("check-followups")
  .description("Check which contacts are due for follow-up")
  .action(async () => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);
    const llm = new LLMRegistry(config);

    const agent = createEmailAgent(llm);
    const result = await agent.run({ action: "followup" });

    if (!result.success || !result.data) {
      console.log(chalk.red(`  Error: ${result.error}`));
      return;
    }

    console.log(chalk.bold("\n  Follow-up Check\n"));
    console.log(`  ${result.data.summary}`);
    console.log();
  });

// ─── Campaign ───────────────────────────────────────────────────────

const campaign = program.command("campaign").description("Campaign management (batch outreach)");

campaign
  .command("create")
  .description("Create outreach for all qualified leads")
  .option("--min-score <n>", "Minimum score", "70")
  .option("--channel <ch>", "Channel: email|linkedin", "email")
  .option("--limit <n>", "Max companies", "10")
  .action(async (opts) => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);
    loadOperatorContext(config.projectRoot);
    const llm = new LLMRegistry(config);

    const companies = companyRepo.list({
      minScore: parseInt(opts.minScore, 10),
      limit: parseInt(opts.limit, 10),
    });

    if (companies.length === 0) {
      console.log(chalk.yellow("\n  No qualified companies found. Run: freelance leads qualify\n"));
      return;
    }

    console.log(chalk.cyan(`\n  Creating ${opts.channel} outreach for ${companies.length} companies...\n`));
    const agent = createPersonalizationAgent(llm);
    let drafted = 0;
    let errors = 0;

    for (const company of companies) {
      try {
        const result = await agent.run({ companyId: company.id, channel: opts.channel });
        if (result.success) {
          drafted++;
          console.log(chalk.green(`  ✓ ${company.name}`) + chalk.dim(` — ${result.data?.subjectLine ?? "drafted"}`));
        } else {
          errors++;
          console.log(chalk.red(`  ✗ ${company.name}: ${result.error}`));
        }
      } catch (err) {
        errors++;
        console.log(chalk.red(`  ✗ ${company.name}: ${err instanceof Error ? err.message : String(err)}`));
      }
    }

    console.log(chalk.green(`\n  Drafted: ${drafted} | Errors: ${errors}\n`));
  });

// ─── Meetings ───────────────────────────────────────────────────────

const meetings = program.command("meetings").description("Sales meeting preparation and post-call processing");

meetings
  .command("brief <companyId>")
  .description("Prepare a meeting brief for a company")
  .option("--contact <id>", "Specific contact")
  .option("--context <text>", "Meeting context", "initial discovery call")
  .action(async (companyId: string, opts) => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);
    loadOperatorContext(config.projectRoot);
    const llm = new LLMRegistry(config);

    let id = companyId;
    const bySearch = companyRepo.search(companyId);
    if (bySearch.length > 0 && bySearch[0].id !== companyId) {
      id = bySearch[0].id;
      console.log(chalk.dim(`  Matched: ${bySearch[0].name}`));
    }

    console.log(chalk.cyan("\n  Preparing meeting brief...\n"));
    const agent = createSalesAgent(llm);
    const result = await agent.run({ action: "meeting-brief", companyId: id, contactId: opts.contact, dealContext: opts.context });

    if (!result.success || !result.data?.meetingBrief) {
      console.log(chalk.red(`  Error: ${result.error}`));
      return;
    }

    const b = result.data.meetingBrief;
    console.log(chalk.bold(`  Meeting Brief: ${b.companyName}\n`));
    console.log(chalk.cyan("  Contact:") + ` ${b.contactName} — ${b.contactTitle}`);
    console.log(chalk.cyan("  Background:") + ` ${b.companyBackground}`);
    console.log(chalk.cyan("  Problem:") + ` ${b.observableProblem}`);
    console.log(chalk.cyan("  Our match:") + ` ${b.ourMatch}`);

    console.log(chalk.cyan("\n  Discovery Questions:"));
    b.discoveryQuestions.forEach((q, i) => console.log(`    ${i + 1}. ${q}`));

    console.log(chalk.cyan("\n  Pain Hypotheses:"));
    b.painHypotheses.forEach((h) => console.log(`    - ${h}`));

    console.log(chalk.cyan("\n  Objection Prep:"));
    b.objectionPrep.forEach((o) => {
      console.log(`    "${o.objection}"`);
      console.log(chalk.dim(`    → ${o.response}`));
    });

    console.log(chalk.red("\n  Do NOT claim:"));
    b.doNotClaim.forEach((d) => console.log(`    - ${d}`));

    console.log(chalk.green("\n  Ideal outcome:") + ` ${b.idealOutcome}`);
    console.log(chalk.green("  If positive:") + ` ${b.nextStepIfPositive}`);
    console.log(chalk.yellow("  If unclear:") + ` ${b.nextStepIfUnclear}`);
    console.log(chalk.dim(`\n  Tokens: ${result.tokensUsed} | Duration: ${result.durationMs}ms\n`));
  });

meetings
  .command("post-call <companyId>")
  .description("Process meeting notes and generate follow-up")
  .option("--notes <text>", "Meeting notes")
  .action(async (companyId: string, opts) => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);
    loadOperatorContext(config.projectRoot);
    const llm = new LLMRegistry(config);

    if (!opts.notes) {
      console.log(chalk.red("  --notes <text> is required"));
      return;
    }

    console.log(chalk.cyan("\n  Processing post-call...\n"));
    const agent = createSalesAgent(llm);
    const result = await agent.run({ action: "post-call", companyId, meetingNotes: opts.notes });

    if (!result.success || !result.data?.postCall) {
      console.log(chalk.red(`  Error: ${result.error}`));
      return;
    }

    const p = result.data.postCall;
    console.log(chalk.bold("  Post-Call Summary\n"));
    console.log(chalk.cyan("  Summary:") + ` ${p.summary}`);
    console.log(chalk.cyan("  Stage:") + ` ${p.dealStageRecommendation}`);

    if (p.painConfirmed.length) {
      console.log(chalk.green("\n  Pains confirmed:"));
      p.painConfirmed.forEach((pc) => console.log(`    + ${pc}`));
    }
    if (p.painRejected.length) {
      console.log(chalk.red("\n  Pains rejected:"));
      p.painRejected.forEach((pr) => console.log(`    - ${pr}`));
    }

    console.log(chalk.cyan("\n  Next actions:"));
    p.nextActions.forEach((a) => console.log(`    - ${a}`));

    console.log(chalk.cyan("\n  Follow-up draft:"));
    console.log(chalk.white(`  ${p.followUpDraft}`));
    console.log(chalk.dim(`\n  Tokens: ${result.tokensUsed}\n`));
  });

// ─── Proposals ──────────────────────────────────────────────────────

program
  .command("proposal <companyId>")
  .description("Generate a scoped proposal for a company")
  .option("--scope <text>", "Agreed scope")
  .option("--budget <text>", "Budget indication")
  .option("--timeline <text>", "Timeline")
  .action(async (companyId: string, opts) => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);
    loadOperatorContext(config.projectRoot);
    const llm = new LLMRegistry(config);

    let id = companyId;
    const bySearch = companyRepo.search(companyId);
    if (bySearch.length > 0 && bySearch[0].id !== companyId) {
      id = bySearch[0].id;
      console.log(chalk.dim(`  Matched: ${bySearch[0].name}`));
    }

    console.log(chalk.cyan("\n  Generating proposal...\n"));
    const agent = createProposalAgent(llm);
    const result = await agent.run({
      companyId: id,
      agreedScope: opts.scope,
      budget: opts.budget,
      timeline: opts.timeline,
    });

    if (!result.success || !result.data) {
      console.log(chalk.red(`  Error: ${result.error}`));
      return;
    }

    const pr = result.data;
    console.log(chalk.bold(`  ${pr.proposalTitle}\n`));
    console.log(chalk.cyan("  Problem:") + ` ${pr.problem}`);
    console.log(chalk.cyan("  Outcome:") + ` ${pr.desiredOutcome}`);
    console.log(chalk.cyan("  Scope:") + ` ${pr.scope}`);
    console.log(chalk.cyan("  Investment:") + ` ${pr.investment}`);
    console.log(chalk.cyan("  Timeline:") + ` ${pr.timeline}`);

    console.log(chalk.cyan("\n  Deliverables:"));
    pr.deliverables.forEach((d) => console.log(`    - ${d}`));

    console.log(chalk.red("\n  Exclusions:"));
    pr.exclusions.forEach((e) => console.log(`    - ${e}`));

    console.log(chalk.green("\n  Next step:") + ` ${pr.nextStep}`);
    console.log(chalk.dim(`  Valid until: ${pr.validUntil}`));
    console.log(chalk.dim(`\n  Tokens: ${result.tokensUsed} | Duration: ${result.durationMs}ms\n`));
  });

// ─── Pipeline ───────────────────────────────────────────────────────

program
  .command("pipeline")
  .description("View opportunity pipeline")
  .action(async () => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);

    console.log(chalk.bold("\n  Revenue Pipeline\n"));

    // Stage counts
    const stages = ["LEAD_DISCOVERY", "ENRICHMENT", "QUALIFICATION", "ACCOUNT_RESEARCH", "OUTREACH", "MEETING", "OPPORTUNITY", "PROPOSAL", "WON", "REJECTED", "NURTURE"];
    const stageColors: Record<string, string> = {
      LEAD_DISCOVERY: "dim", ENRICHMENT: "dim", QUALIFICATION: "yellow",
      ACCOUNT_RESEARCH: "yellow", OUTREACH: "cyan", MEETING: "green",
      OPPORTUNITY: "green", PROPOSAL: "green", WON: "green",
      REJECTED: "red", NURTURE: "yellow",
    };

    console.log(chalk.cyan("  Contact Pipeline:"));
    for (const stage of stages) {
      const contacts = contactRepo.listByStage(stage);
      if (contacts.length > 0) {
        const color = stageColors[stage] ?? "dim";
        console.log(`    ${(chalk as unknown as Record<string, (s: string) => string>)[color](stage.padEnd(20))} ${contacts.length}`);
      }
    }

    // Deals
    try {
      const db = getDb();
      const deals = db.prepare(`SELECT d.*, c.name as company_name FROM deals d LEFT JOIN companies c ON d.company_id = c.id ORDER BY d.updated_at DESC`).all() as Array<Record<string, unknown>>;
      if (deals.length > 0) {
        console.log(chalk.cyan("\n  Active Deals:"));
        for (const d of deals) {
          const stage = d.stage as string ?? "?";
          const color = stage === "WON" ? "green" : stage === "LOST" ? "red" : "yellow";
          const value = d.expected_value ? ` ($${d.expected_value})` : "";
          console.log(`    ${(chalk as unknown as Record<string, (s: string) => string>)[color](stage.padEnd(12))} ${d.company_name ?? "?"}${value}`);
          if (d.next_action) console.log(chalk.dim(`             Next: ${d.next_action}`));
        }
      }
    } catch { /* no deals */ }

    // Summary
    const totalCompanies = companyRepo.count();
    const totalContacts = contactRepo.count();
    console.log(chalk.dim(`\n  Total: ${totalCompanies} companies, ${totalContacts} contacts\n`));
  });

// ─── Content ────────────────────────────────────────────────────────

const content = program.command("content").description("Content intelligence and planning");

content
  .command("ideas")
  .description("Generate content opportunities from sales intelligence")
  .option("--industry <name>", "Target industry")
  .option("--channel <ch>", "Channel: tiktok|instagram|linkedin|blog|all", "all")
  .action(async (opts) => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);
    loadOperatorContext(config.projectRoot);
    const llm = new LLMRegistry(config);

    console.log(chalk.cyan("\n  Generating content opportunities...\n"));
    const agent = createContentIntelligenceAgent(llm);
    const result = await agent.run({
      action: "generate-opportunities",
      industry: opts.industry,
      channel: opts.channel,
    });

    if (!result.success || !result.data) {
      console.log(chalk.red(`  Error: ${result.error}`));
      return;
    }

    for (const opp of result.data.opportunities) {
      const pColor = opp.priority === "high" ? "green" : opp.priority === "medium" ? "yellow" : "dim";
      console.log(`  ${(chalk as unknown as Record<string, (s: string) => string>)[pColor](opp.priority.toUpperCase().padEnd(8))} ${chalk.bold(opp.title)}`);
      console.log(chalk.dim(`           ${opp.channel} | ${opp.format} | ${opp.funnelStage}`));
      console.log(chalk.dim(`           Hook: ${opp.hook}`));
    }
    console.log(chalk.dim(`\n  ${result.data.summary}\n`));
  });

content
  .command("calendar")
  .description("Generate a content calendar")
  .option("--weeks <n>", "Number of weeks", "2")
  .option("--industry <name>", "Target industry")
  .action(async (opts) => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);
    loadOperatorContext(config.projectRoot);
    const llm = new LLMRegistry(config);

    console.log(chalk.cyan("\n  Generating content calendar...\n"));
    const agent = createContentIntelligenceAgent(llm);
    const result = await agent.run({
      action: "calendar",
      weekCount: parseInt(opts.weeks, 10),
      industry: opts.industry,
    });

    if (!result.success || !result.data) {
      console.log(chalk.red(`  Error: ${result.error}`));
      return;
    }

    for (const week of result.data.calendarWeeks) {
      console.log(chalk.bold(`\n  Week ${week.week}`));
      for (const post of week.posts) {
        console.log(`    ${chalk.cyan(post.day.padEnd(12))} ${post.channel.padEnd(12)} ${post.format.padEnd(12)} ${post.title}`);
      }
    }
    console.log(chalk.dim(`\n  ${result.data.summary}\n`));
  });

// ─── Social ─────────────────────────────────────────────────────────

const social = program.command("social").description("Social media intelligence");

social
  .command("research <companyId>")
  .description("Research a company's social presence")
  .option("--platform <p>", "Platform: tiktok|instagram|linkedin|all", "all")
  .action(async (companyId: string, opts) => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);
    loadOperatorContext(config.projectRoot);
    const llm = new LLMRegistry(config);

    console.log(chalk.cyan("\n  Researching social presence...\n"));
    const agent = createSocialIntelligenceAgent(llm);
    const result = await agent.run({ action: "research-account", companyId, platform: opts.platform });

    if (!result.success || !result.data) {
      console.log(chalk.red(`  Error: ${result.error}`));
      return;
    }

    if (result.data.signals.length) {
      console.log(chalk.cyan("  Signals:"));
      for (const s of result.data.signals) {
        console.log(`    ${chalk.yellow(s.signalType.padEnd(18))} ${s.description} ${chalk.dim(`(${Math.round(s.confidence * 100)}%)`)}`);
      }
    }

    if (result.data.recommendations.length) {
      console.log(chalk.green("\n  Recommendations:"));
      result.data.recommendations.forEach((r) => console.log(`    - ${r}`));
    }
    console.log(chalk.dim(`\n  ${result.data.summary}\n`));
  });

social
  .command("trends")
  .description("Analyze industry social trends")
  .option("--industry <name>", "Target industry")
  .option("--platform <p>", "Platform", "all")
  .action(async (opts) => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);
    loadOperatorContext(config.projectRoot);
    const llm = new LLMRegistry(config);

    console.log(chalk.cyan("\n  Analyzing social trends...\n"));
    const agent = createSocialIntelligenceAgent(llm);
    const result = await agent.run({ action: "industry-trends", industry: opts.industry, platform: opts.platform });

    if (!result.success || !result.data) {
      console.log(chalk.red(`  Error: ${result.error}`));
      return;
    }

    if (result.data.contentPatterns.length) {
      console.log(chalk.cyan("  Content Patterns:"));
      for (const p of result.data.contentPatterns) {
        console.log(chalk.bold(`    ${p.format}`));
        console.log(chalk.dim(`      Hook: ${p.hook}`));
        console.log(chalk.dim(`      Why: ${p.whyItWorks}`));
      }
    }

    if (result.data.opportunities.length) {
      console.log(chalk.green("\n  Opportunities:"));
      result.data.opportunities.forEach((o) => console.log(`    - ${o}`));
    }
    console.log(chalk.dim(`\n  ${result.data.summary}\n`));
  });

// ─── Inbox ──────────────────────────────────────────────────────────

program
  .command("inbox")
  .description("Triage incoming replies and check follow-ups")
  .action(async () => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);
    const llm = new LLMRegistry(config);

    console.log(chalk.bold("\n  Inbox Triage\n"));

    // Check follow-ups
    const agent = createEmailAgent(llm);
    const followups = await agent.run({ action: "followup" });
    if (followups.success && followups.data) {
      console.log(chalk.cyan("  Follow-ups:") + ` ${followups.data.summary}`);
    }

    // Show contacts in outreach stage
    const outreach = contactRepo.listByStage("OUTREACH");
    const meeting = contactRepo.listByStage("MEETING");

    console.log(chalk.cyan("\n  Pipeline:"));
    console.log(`    In outreach: ${chalk.yellow(String(outreach.length))}`);
    console.log(`    Meeting stage: ${chalk.green(String(meeting.length))}`);

    if (meeting.length > 0) {
      console.log(chalk.green("\n  Hot leads (meeting stage):"));
      for (const c of meeting) {
        const company = companyRepo.findById(c.company_id);
        console.log(`    ${c.first_name ?? ""} ${c.last_name ?? ""} — ${company?.name ?? "?"} (${c.email ?? "no email"})`);
      }
    }

    console.log(chalk.dim("\n  Use 'freelance outreach classify --text \"...\"' to classify replies"));
    console.log(chalk.dim("  Use 'freelance outreach followup <contactId>' to draft follow-ups\n"));
  });

// ─── Analytics ──────────────────────────────────────────────────────

const analytics = program.command("analytics").description("Revenue and funnel analytics");

analytics
  .command("funnel")
  .description("Analyze the full sales funnel")
  .action(async () => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);
    loadOperatorContext(config.projectRoot);
    const llm = new LLMRegistry(config);

    console.log(chalk.cyan("\n  Analyzing funnel...\n"));
    const agent = createRevenueAnalystAgent(llm);
    const result = await agent.run({ action: "funnel" });

    if (!result.success || !result.data) {
      console.log(chalk.red(`  Error: ${result.error}`));
      return;
    }

    if (result.data.funnel) {
      const f = result.data.funnel;
      console.log(chalk.bold("  Funnel Metrics"));
      console.log(`    Companies: ${f.totalCompanies} | Contacts: ${f.totalContacts} | ICPs: ${f.totalICPs}`);
      console.log(`    Qualified rate: ${(f.qualifiedRate * 100).toFixed(0)}% | Avg score: ${f.avgScore}`);
      console.log(`    Pipeline: ${f.pipelineValue} | Deals open: ${f.dealsOpen} | Won: ${f.dealsWon}`);
      if (f.revenue > 0) console.log(chalk.green(`    Revenue: $${f.revenue.toLocaleString()}`));

      if (f.topScoring.length) {
        console.log(chalk.cyan("\n  Top prospects:"));
        f.topScoring.forEach((t) => console.log(`    ${chalk.green(`${t.score}/100`)} ${t.name}`));
      }
    }

    if (result.data.insights.length) {
      console.log(chalk.cyan("\n  Insights:"));
      result.data.insights.forEach((i) => console.log(`    - ${i}`));
    }

    if (result.data.recommendations.length) {
      console.log(chalk.green("\n  Recommendations:"));
      result.data.recommendations.forEach((r) => console.log(`    - ${r}`));
    }

    if (result.data.risks.length) {
      console.log(chalk.red("\n  Risks:"));
      result.data.risks.forEach((r) => console.log(`    - ${r}`));
    }

    console.log(chalk.dim(`\n  ${result.data.summary}\n`));
  });

analytics
  .command("weekly")
  .description("Generate weekly revenue operations report")
  .action(async () => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);
    loadOperatorContext(config.projectRoot);
    const llm = new LLMRegistry(config);

    console.log(chalk.cyan("\n  Generating weekly report...\n"));
    const agent = createRevenueAnalystAgent(llm);
    const result = await agent.run({ action: "weekly-report" });

    if (!result.success || !result.data) {
      console.log(chalk.red(`  Error: ${result.error}`));
      return;
    }

    console.log(chalk.bold("  Weekly Revenue Report\n"));
    console.log(chalk.white(`  ${result.data.summary}\n`));

    if (result.data.insights.length) {
      console.log(chalk.cyan("  Highlights:"));
      result.data.insights.forEach((i) => console.log(`    - ${i}`));
    }
    if (result.data.recommendations.length) {
      console.log(chalk.green("\n  Priority actions:"));
      result.data.recommendations.forEach((r) => console.log(`    - ${r}`));
    }
    console.log();
  });

analytics
  .command("experiment")
  .description("Get next experiment recommendation")
  .action(async () => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);
    loadOperatorContext(config.projectRoot);
    const llm = new LLMRegistry(config);

    console.log(chalk.cyan("\n  Recommending next experiment...\n"));
    const agent = createRevenueAnalystAgent(llm);
    const result = await agent.run({ action: "experiment-recommendation" });

    if (!result.success || !result.data) {
      console.log(chalk.red(`  Error: ${result.error}`));
      return;
    }

    if (result.data.recommendations.length) {
      console.log(chalk.bold("  Recommended Experiment\n"));
      result.data.recommendations.forEach((r) => console.log(`  ${r}\n`));
    }
    console.log(chalk.dim(`  ${result.data.summary}\n`));
  });

// ─── Audit ──────────────────────────────────────────────────────────

program
  .command("audit")
  .description("Audit trail and system logs")
  .option("--limit <n>", "Number of events to show", "20")
  .action(async (opts) => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);

    const recentEvents = events.query({ limit: parseInt(opts.limit, 10) });
    if (recentEvents.length === 0) {
      console.log(chalk.dim("  No events recorded yet."));
      return;
    }

    console.log(chalk.bold("\n  Recent Events\n"));
    for (const e of recentEvents) {
      const time = e.occurredAt.split("T")[1]?.slice(0, 8) ?? "";
      console.log(`  ${chalk.dim(time)} ${chalk.cyan(e.eventType.padEnd(25))} ${e.actor} ${chalk.dim(e.entityId ?? "")}`);
    }
    console.log();
  });

// ─── Skills ─────────────────────────────────────────────────────────

program
  .command("skills")
  .description("List loaded skills and knowledge modules")
  .option("--category <cat>", "Filter by category")
  .option("--search <query>", "Search skills by keyword")
  .action(async (opts) => {
    const config = loadConfig();
    const registry = new SkillRegistry(config.projectRoot);
    const count = registry.loadAll();

    if (opts.search) {
      const results = registry.search(opts.search);
      console.log(chalk.bold(`\n  Skills matching "${opts.search}" (${results.length})\n`));
      for (const s of results) {
        console.log(`  ${chalk.cyan(s.category.padEnd(15))} ${chalk.green(s.source.padEnd(18))} ${s.name}`);
      }
    } else if (opts.category) {
      const results = registry.byCategory(opts.category);
      console.log(chalk.bold(`\n  Skills in "${opts.category}" (${results.length})\n`));
      for (const s of results) {
        console.log(`  ${chalk.green(s.source.padEnd(18))} ${s.name}`);
      }
    } else {
      const all = registry.list();
      const categories = new Map<string, number>();
      for (const s of all) {
        categories.set(s.category, (categories.get(s.category) ?? 0) + 1);
      }
      console.log(chalk.bold(`\n  Loaded ${count} skills\n`));
      for (const [cat, n] of categories) {
        console.log(`  ${chalk.cyan(cat.padEnd(20))} ${n} skills`);
      }
    }
    console.log();
  });

// ─── Dashboard ──────────────────────────────────────────────────────

const dash = program.command("dashboard").description("Paperclip agent dashboard");

dash
  .command("run")
  .description("Launch Paperclip dashboard server")
  .action(async () => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);

    console.log(chalk.bold("\n  Freelance Revenue OS — Dashboard\n"));
    console.log(chalk.cyan("  Starting Paperclip dashboard...\n"));

    // Show agent roster
    const roster = PaperclipBridge.defaultRoster();
    console.log(chalk.cyan("  Registered agents:"));
    for (const a of roster) {
      console.log(`    ${chalk.green(a.name.padEnd(25))} ${chalk.dim(a.role)}`);
    }

    console.log(chalk.dim(`\n  URL: http://localhost:${config.dashboardPort}`));
    console.log(chalk.yellow("\n  Starting Paperclip server..."));
    console.log(chalk.dim("  Press Ctrl+C to stop\n"));

    // Launch paperclipai run
    const { execSync } = await import("node:child_process");
    try {
      execSync("paperclipai run", { stdio: "inherit", cwd: config.projectRoot });
    } catch {
      console.log(chalk.yellow("\n  Paperclip exited. Run 'paperclipai run' manually if needed.\n"));
    }
  });

dash
  .command("status")
  .description("Show dashboard agent status")
  .action(async () => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);

    console.log(chalk.bold("\n  Agent Dashboard Status\n"));

    const roster = PaperclipBridge.defaultRoster();
    for (const a of roster) {
      const statusIcon = a.status === "working" ? chalk.green("●") : a.status === "error" ? chalk.red("●") : chalk.dim("○");
      console.log(`  ${statusIcon} ${a.name.padEnd(25)} ${chalk.dim(a.role.padEnd(20))} ${a.status}`);
    }

    // DB stats
    const totalCompanies = companyRepo.count();
    const totalContacts = contactRepo.count();
    const recentEvts = events.query({ limit: 5 });

    console.log(chalk.cyan("\n  System:"));
    console.log(`    Companies: ${totalCompanies} | Contacts: ${totalContacts}`);
    console.log(`    Recent events: ${recentEvts.length > 0 ? recentEvts.map(e => e.eventType).join(", ") : "none"}`);
    console.log(chalk.dim(`\n  Launch dashboard: freelance dashboard run\n`));
  });

dash
  .command("watch")
  .description("Live terminal view of agent activity")
  .option("--interval <s>", "Refresh interval in seconds", "2")
  .option("--once", "Render a single frame and exit")
  .action(async (opts) => {
    const config = loadConfig();
    initializeDatabase(config.dbPath);

    const intervalMs = Math.max(1, parseInt(opts.interval, 10) || 2) * 1000;
    const roster = PaperclipBridge.defaultRoster();
    const stages = ["LEAD_DISCOVERY", "ENRICHMENT", "QUALIFICATION", "ACCOUNT_RESEARCH", "OUTREACH", "MEETING", "OPPORTUNITY", "PROPOSAL", "WON", "REJECTED", "NURTURE"];

    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const ago = (iso: string): string => {
      const diff = Math.max(0, Date.now() - new Date(iso).getTime());
      const s = Math.floor(diff / 1000);
      if (s < 60) return `${s}s`;
      const m = Math.floor(s / 60);
      if (m < 60) return `${m}m`;
      const h = Math.floor(m / 60);
      if (h < 24) return `${h}h`;
      return `${Math.floor(h / 24)}d`;
    };
    const lifecycleStatus = (eventType: string): "working" | "idle" | "error" | null => {
      if (eventType.endsWith(".failed")) return "error";
      if (eventType.endsWith(".started")) return "working";
      if (eventType.endsWith(".completed")) return "idle";
      return null;
    };

    interface AgentState {
      status: "working" | "idle" | "error" | "stale";
      lastAt: string;
      lastType: string;
      detail: string;
    }

    const buildStates = (evts: ReturnType<typeof events.query>): Map<string, AgentState> => {
      const states = new Map<string, AgentState>();
      const seenLifecycle = new Set<string>();
      for (const e of evts) {
        // Events arrive newest-first: only the most recent lifecycle event sets status
        const cycle = lifecycleStatus(e.eventType);
        const existing = states.get(e.actor);
        if (!existing) {
          states.set(e.actor, {
            status: cycle ?? "idle",
            lastAt: e.occurredAt,
            lastType: e.eventType,
            detail: typeof e.metadata?.summary === "string" ? e.metadata.summary : "",
          });
          if (cycle) seenLifecycle.add(e.actor);
          continue;
        }
        if (!seenLifecycle.has(e.actor) && cycle) {
          existing.status = cycle;
          existing.lastType = e.eventType;
          seenLifecycle.add(e.actor);
        }
      }
      return states;
    };

    const render = (): string => {
      const out: string[] = [];
      const evts = events.query({ limit: 400 });
      const states = buildStates(evts);
      // A "started" with no completion for >10 min means the run died silently
      for (const state of states.values()) {
        if (state.status === "working" && state.lastAt &&
            Date.now() - new Date(state.lastAt).getTime() > 10 * 60 * 1000) {
          state.status = "stale";
        }
      }

      out.push("");
      out.push(`  ${chalk.bold("Freelance Revenue OS")} ${chalk.dim("— live agent monitor")}`);
      out.push(chalk.dim("  ─────────────────────────────────────────────────────────"));
      out.push(`  Provider: ${chalk.green(config.llmProvider)}   Approval: ${chalk.yellow(`Level ${config.approvalLevel} (DRAFT)`)}   ${chalk.dim(`refresh ${intervalMs / 1000}s`)}`);
      out.push("");

      const statusIcon = (s: AgentState["status"]) =>
        s === "working" ? chalk.green("● working") : s === "error" ? chalk.red("✗ error  ") : s === "stale" ? chalk.yellow("◌ stale  ") : chalk.dim("○ idle   ");

      const seen = new Set<string>();
      out.push(chalk.cyan("  Agents"));
      for (const a of roster) {
        const match = [...states.entries()].find(([actor]) => {
          const x = normalize(actor);
          const y = normalize(a.id);
          return x === y || x.includes(y) || y.includes(x);
        });
        seen.add(match?.[0] ?? a.id);
        const state: AgentState = match?.[1] ?? { status: "idle", lastAt: "", lastType: "", detail: "" };
        const when = state.lastAt ? chalk.dim(` ${ago(state.lastAt)} ago`) : "";
        const last = state.lastAt ? chalk.dim(` ${state.lastType}`) : "";
        out.push(`   ${statusIcon(state.status)}  ${a.name.padEnd(24)} ${chalk.dim(a.role.padEnd(20))}${when}${last}`);
      }
      const extra = [...states.keys()].filter((actor) => ![...seen].some((s) => {
        const x = normalize(actor);
        const y = normalize(s);
        return x === y || x.includes(y) || y.includes(x);
      }));
      if (extra.length) {
        out.push(chalk.cyan("\n  Other actors"));
        for (const actor of extra) {
          const state = states.get(actor)!;
          out.push(`   ${statusIcon(state.status)}  ${actor.padEnd(44)} ${chalk.dim(ago(state.lastAt) + " ago " + state.lastType)}`);
        }
      }

      out.push("");
      out.push(chalk.cyan("  Data"));
      let drafts = 0;
      let openDeals = 0;
      try {
        const db = getDb();
        drafts = (db.prepare(`SELECT COUNT(*) AS c FROM messages WHERE status = 'draft'`).get() as { c: number }).c;
        openDeals = (db.prepare(`SELECT COUNT(*) AS c FROM deals WHERE stage NOT IN ('WON','LOST')`).get() as { c: number }).c;
      } catch { /* tables may not exist yet */ }
      out.push(`   Companies ${chalk.bold(String(companyRepo.count()))}   Contacts ${chalk.bold(String(contactRepo.count()))}   ICPs ${chalk.bold(String(icpRepo.count()))}   Drafts ${chalk.bold(String(drafts))}   Open deals ${chalk.bold(String(openDeals))}`);

      const stageRows = stages
        .map((s) => ({ stage: s, n: contactRepo.listByStage(s, 200).length }))
        .filter((r) => r.n > 0);
      if (stageRows.length) {
        out.push(`   ${stageRows.map((r) => `${chalk.dim(r.stage)} ${r.n}`).join("   ")}`);
      } else {
        out.push(chalk.dim("   No contacts in pipeline yet"));
      }

      out.push("");
      out.push(chalk.cyan("  Recent events"));
      const recent = evts.slice(0, 8);
      if (!recent.length) {
        out.push(chalk.dim("   none yet — run a command such as 'freelance leads discover'"));
      } else {
        for (const e of recent) {
          const color = e.eventType.endsWith(".failed") ? chalk.red : e.eventType.endsWith(".completed") ? chalk.green : chalk.white;
          out.push(`   ${chalk.dim(ago(e.occurredAt).padStart(4))}  ${color(e.eventType.padEnd(24))} ${chalk.dim(e.actor)}`);
        }
      }

      out.push("");
      out.push(chalk.dim("  Ctrl+C to exit"));
      out.push("");
      return out.join("\n");
    };

    if (opts.once || !process.stdout.isTTY) {
      process.stdout.write(render());
      return;
    }

    const tick = () => process.stdout.write("\x1b[2J\x1b[H" + render());
    tick();
    const timer = setInterval(tick, intervalMs);
    const stop = () => {
      clearInterval(timer);
      process.stdout.write("\n");
      process.exit(0);
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  });

// ─── Providers ──────────────────────────────────────────────────────

program
  .command("providers")
  .description("List configured LLM providers")
  .action(async () => {
    const config = loadConfig();
    const llm = new LLMRegistry(config);
    const configured = llm.listConfigured();

    console.log(chalk.bold("\n  LLM Providers\n"));
    console.log(`  Default: ${chalk.green(config.llmProvider)}`);
    console.log(`  Active:  ${configured.map(p => chalk.green(p)).join(", ") || chalk.red("none")}`);
    console.log(chalk.dim(`\n  Models:`));
    console.log(`    Anthropic:   ${config.anthropicModel}`);
    console.log(`    OpenRouter:  ${config.openrouterModel}`);
    console.log(`    OpenAI:      ${config.openaiModel}`);
    console.log(`    Ollama:      ${config.ollamaModel}`);
    console.log();
  });

// ─── Parse & Run ────────────────────────────────────────────────────

program.parse();
