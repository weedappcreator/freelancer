/**
 * Paperclip Dashboard Integration
 * Bridges Freelance Revenue OS agents with the Paperclip orchestration dashboard.
 * Paperclip provides: org charts, budgets, goal tracking, agent coordination, React UI.
 */

import { logger } from "../core/logger.js";
import { events } from "../events/emitter.js";
import type { Config } from "../core/config.js";

export interface PaperclipAgent {
  id: string;
  name: string;
  role: string;
  status: "idle" | "working" | "error" | "paused";
  currentTask?: string;
  tokensUsed: number;
  lastHeartbeat?: string;
}

export interface PaperclipGoal {
  id: string;
  title: string;
  description: string;
  assignedAgents: string[];
  progress: number;
  status: "active" | "completed" | "blocked";
}

/**
 * Paperclip Bridge
 * Exposes Revenue OS agent activity as Paperclip-compatible events
 * so the dashboard can visualize and control agent work.
 */
export class PaperclipBridge {
  private agents = new Map<string, PaperclipAgent>();
  private baseUrl: string;

  constructor(config: Config) {
    this.baseUrl = `http://localhost:${config.dashboardPort}`;
    this.setupEventBridge();
  }

  /** Register a Revenue OS agent with Paperclip */
  registerAgent(agent: PaperclipAgent) {
    this.agents.set(agent.id, agent);
    logger.info(`Paperclip: registered agent ${agent.name}`, { role: agent.role });
  }

  /** Update agent status (called by agent framework) */
  updateAgentStatus(agentId: string, status: PaperclipAgent["status"], task?: string) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = status;
      agent.currentTask = task;
      agent.lastHeartbeat = new Date().toISOString();
    }
    this.postHeartbeat({ agent: agentId, status, currentTask: task });
  }

  /** POST heartbeat to the Vercel dashboard */
  private async postHeartbeat(payload: Record<string, unknown>) {
    try {
      await fetch(`${this.baseUrl}/api/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // Dashboard may not be running — silent fail
    }
  }

  /** Bridge Revenue OS events to dashboard */
  private setupEventBridge() {
    events.on("*", async (event) => {
      const heartbeat = {
        agent: event.actor,
        status: "working",
        event: {
          eventType: event.eventType,
          actor: event.actor,
          entityType: event.entityType,
          entityId: event.entityId,
          occurredAt: event.occurredAt,
          metadata: event.metadata,
        },
      };

      logger.debug("Paperclip heartbeat", heartbeat);
      this.postHeartbeat(heartbeat);
    });
  }

  /** Get all registered agents and their status */
  getAgentStatus(): PaperclipAgent[] {
    return [...this.agents.values()];
  }

  /** Revenue OS agent roster for Paperclip */
  static defaultRoster(): PaperclipAgent[] {
    return [
      { id: "orchestrator", name: "Orchestrator", role: "CEO", status: "idle", tokensUsed: 0 },
      { id: "market-intel", name: "Market Intelligence", role: "Research Analyst", status: "idle", tokensUsed: 0 },
      { id: "icp-agent", name: "ICP Agent", role: "Strategy", status: "idle", tokensUsed: 0 },
      { id: "lead-discovery", name: "Lead Discovery", role: "SDR", status: "idle", tokensUsed: 0 },
      { id: "enrichment", name: "Enrichment Agent", role: "Data Analyst", status: "idle", tokensUsed: 0 },
      { id: "qualification", name: "Qualification Agent", role: "Sales Ops", status: "idle", tokensUsed: 0 },
      { id: "account-research", name: "Account Research", role: "Account Executive", status: "idle", tokensUsed: 0 },
      { id: "offer-strategist", name: "Offer Strategist", role: "Product Marketing", status: "idle", tokensUsed: 0 },
      { id: "personalization", name: "Copy Agent", role: "Copywriter", status: "idle", tokensUsed: 0 },
      { id: "email-agent", name: "Email Agent", role: "Email Ops", status: "idle", tokensUsed: 0 },
      { id: "follow-up", name: "Follow-Up Agent", role: "SDR", status: "idle", tokensUsed: 0 },
      { id: "reply-intel", name: "Reply Intelligence", role: "Sales Ops", status: "idle", tokensUsed: 0 },
      { id: "sales-agent", name: "Sales Agent", role: "AE", status: "idle", tokensUsed: 0 },
      { id: "proposal", name: "Proposal Agent", role: "Solutions", status: "idle", tokensUsed: 0 },
      { id: "crm-agent", name: "CRM Agent", role: "Rev Ops", status: "idle", tokensUsed: 0 },
      { id: "content-intel", name: "Content Intelligence", role: "Content Strategy", status: "idle", tokensUsed: 0 },
      { id: "revenue-analyst", name: "Revenue Analyst", role: "Analytics", status: "idle", tokensUsed: 0 },
    ];
  }
}
