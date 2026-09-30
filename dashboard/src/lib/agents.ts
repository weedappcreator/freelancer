/**
 * In-memory agent state store.
 * Agents POST heartbeats here; the dashboard reads from it.
 */

export interface AgentState {
  id: string;
  name: string;
  role: string;
  status: "idle" | "working" | "error" | "paused";
  currentTask?: string;
  tokensUsed: number;
  lastHeartbeat?: string;
  eventsProcessed: number;
}

// Default roster matching PaperclipBridge.defaultRoster()
const DEFAULT_AGENTS: AgentState[] = [
  { id: "orchestrator", name: "Orchestrator", role: "Growth Director", status: "idle", tokensUsed: 0, eventsProcessed: 0 },
  { id: "market-intel", name: "Market Intelligence", role: "Research Analyst", status: "idle", tokensUsed: 0, eventsProcessed: 0 },
  { id: "icp-agent", name: "ICP Agent", role: "Strategy", status: "idle", tokensUsed: 0, eventsProcessed: 0 },
  { id: "lead-discovery", name: "Lead Discovery", role: "SDR", status: "idle", tokensUsed: 0, eventsProcessed: 0 },
  { id: "enrichment", name: "Enrichment Agent", role: "Data Analyst", status: "idle", tokensUsed: 0, eventsProcessed: 0 },
  { id: "qualification", name: "Qualification Agent", role: "Sales Ops", status: "idle", tokensUsed: 0, eventsProcessed: 0 },
  { id: "account-research", name: "Account Research", role: "Account Executive", status: "idle", tokensUsed: 0, eventsProcessed: 0 },
  { id: "offer-strategist", name: "Offer Strategist", role: "Product Marketing", status: "idle", tokensUsed: 0, eventsProcessed: 0 },
  { id: "personalization", name: "Copy Agent", role: "Copywriter", status: "idle", tokensUsed: 0, eventsProcessed: 0 },
  { id: "email-agent", name: "Email Agent", role: "Email Ops", status: "idle", tokensUsed: 0, eventsProcessed: 0 },
  { id: "follow-up", name: "Follow-Up Agent", role: "SDR", status: "idle", tokensUsed: 0, eventsProcessed: 0 },
  { id: "reply-intel", name: "Reply Intelligence", role: "Sales Ops", status: "idle", tokensUsed: 0, eventsProcessed: 0 },
  { id: "sales-agent", name: "Sales Agent", role: "AE", status: "idle", tokensUsed: 0, eventsProcessed: 0 },
  { id: "proposal", name: "Proposal Agent", role: "Solutions", status: "idle", tokensUsed: 0, eventsProcessed: 0 },
  { id: "crm-agent", name: "CRM Agent", role: "Rev Ops", status: "idle", tokensUsed: 0, eventsProcessed: 0 },
  { id: "content-intel", name: "Content Intelligence", role: "Content Strategy", status: "idle", tokensUsed: 0, eventsProcessed: 0 },
  { id: "revenue-analyst", name: "Revenue Analyst", role: "Analytics", status: "idle", tokensUsed: 0, eventsProcessed: 0 },
];

class AgentStore {
  private agents = new Map<string, AgentState>();
  private listeners = new Set<(agents: AgentState[]) => void>();

  constructor() {
    for (const a of DEFAULT_AGENTS) {
      this.agents.set(a.id, { ...a });
    }
  }

  getAll(): AgentState[] {
    return [...this.agents.values()];
  }

  update(id: string, patch: Partial<AgentState>): AgentState | null {
    const agent = this.agents.get(id);
    if (!agent) return null;
    Object.assign(agent, patch, { lastHeartbeat: new Date().toISOString() });
    this.notify();
    return agent;
  }

  onUpdate(fn: (agents: AgentState[]) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    const all = this.getAll();
    for (const fn of this.listeners) fn(all);
  }
}

export const agentStore = new AgentStore();
