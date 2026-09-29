#!/usr/bin/env node

/**
 * Freelance Revenue OS — CLI Entry Point
 * Primary control surface for all operations.
 */

import { Command } from "commander";
import chalk from "chalk";
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
import { companyRepo, contactRepo, icpRepo } from "../db/repository.js";
import { createCRMAgent } from "../agents/crm.js";

const program = new Command();

program
  .name("freelance")
  .description("Freelance Revenue OS — AI-powered client acquisition system")
  .version("0.1.0");

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

// ─── Campaign ───────────────────────────────────────────────────────

const campaign = program.command("campaign").description("Campaign management");

campaign.command("create").description("Create a new outreach campaign").action(async () => {
  console.log(chalk.yellow("  [Phase 4 — not yet implemented]"));
});

campaign.command("preview <id>").description("Preview campaign messages").action(async (id: string) => {
  console.log(chalk.yellow(`  Preview campaign ${id} [Phase 4]`));
});

campaign.command("approve <id>").description("Approve campaign for execution").action(async (id: string) => {
  console.log(chalk.yellow(`  Approve campaign ${id} [Phase 4]`));
});

// ─── Pipeline ───────────────────────────────────────────────────────

program
  .command("pipeline")
  .description("View opportunity pipeline")
  .action(async () => {
    console.log(chalk.yellow("  [Phase 5 — not yet implemented]"));
  });

// ─── Inbox ──────────────────────────────────────────────────────────

program
  .command("inbox")
  .description("Triage incoming replies")
  .action(async () => {
    console.log(chalk.yellow("  [Phase 4 — not yet implemented]"));
  });

// ─── Analytics ──────────────────────────────────────────────────────

program
  .command("analytics")
  .description("Revenue and funnel analytics")
  .action(async () => {
    console.log(chalk.yellow("  [Phase 7 — not yet implemented]"));
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

program
  .command("dashboard")
  .description("Launch Paperclip agent dashboard")
  .action(async () => {
    const config = loadConfig();
    console.log(chalk.cyan("\n  Launching Paperclip dashboard..."));
    console.log(chalk.dim(`  URL: http://localhost:${config.dashboardPort}`));
    console.log(chalk.dim("  Run: npx paperclipai to start the dashboard server\n"));
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
