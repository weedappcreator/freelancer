/**
 * Lead Discovery Agent
 * Discovers companies and contacts matching ICP criteria from public/authorized sources.
 * Does NOT equate "found" with "qualified" — that's the Qualification Agent's job.
 */

import { BaseAgent } from "./base.js";
import { type LLMRegistry } from "../providers/llm.js";
import { getOperatorContext } from "../core/operator.js";
import { companyRepo, contactRepo, icpRepo, isDuplicateCompany, type CompanyRow } from "../db/repository.js";
import { events } from "../events/emitter.js";

export interface LeadDiscoveryInput {
  icpId?: string;
  vertical?: string;
  geography?: string;
  count?: number;
  sources?: string[];
}

export interface DiscoveredLead {
  companyName: string;
  domain?: string;
  industry: string;
  geography?: string;
  employeeBand?: string;
  reason: string;
  signals: string[];
  contacts: Array<{
    firstName?: string;
    lastName?: string;
    title?: string;
    roleCategory?: string;
    email?: string;
    linkedinUrl?: string;
  }>;
  evidence: string[];
  source: string;
}

export interface LeadDiscoveryOutput {
  discovered: DiscoveredLead[];
  saved: number;
  duplicatesSkipped: number;
  summary: string;
}

export function createLeadDiscoveryAgent(llm: LLMRegistry) {
  return new (class extends BaseAgent<LeadDiscoveryInput, LeadDiscoveryOutput> {
    constructor() {
      super({
        name: "lead-discovery",
        description: "Discovers companies and contacts matching ICP criteria",
        systemPrompt: `You are a Lead Discovery Agent for a freelance AI automation & growth specialist.

OPERATOR CONTEXT:
${getOperatorContext()}

Your job is to identify REAL businesses that match the given ICP criteria. You generate realistic lead lists based on market knowledge.

For each lead, provide:
1. Company name and domain (if known)
2. Industry and geography
3. WHY this company likely needs the operator's services (specific reason, not generic)
4. Observable buying signals (hiring, tech changes, growth, complaints)
5. Key contacts (decision makers with titles)
6. Evidence sources

OUTPUT FORMAT (JSON):
{
  "discovered": [{
    "companyName": "string",
    "domain": "string or null",
    "industry": "string",
    "geography": "string",
    "employeeBand": "string — e.g. 10-50",
    "reason": "string — specific reason this company is a fit",
    "signals": ["string — observable buying signals"],
    "contacts": [{
      "firstName": "string",
      "lastName": "string",
      "title": "string",
      "roleCategory": "string — founder/marketing/operations/tech",
      "email": "string or null",
      "linkedinUrl": "string or null"
    }],
    "evidence": ["string — how we know this"],
    "source": "string — web-research/linkedin/directory/etc"
  }],
  "summary": "string"
}

RULES:
- Found != qualified. Mark as discovered, not ready for outreach.
- Do not invent email addresses — leave null if unknown.
- Do not fabricate LinkedIn URLs — leave null if not confirmed.
- Be specific about WHY each company is a match, not just that they exist.
- Prefer companies where the decision maker is identifiable and accessible.
- Include realistic evidence for each lead.
- Target the count requested but prioritize quality over quantity.`,
        llm,
        temperature: 0.5,
        maxTokens: 8192,
      });
    }

    async execute(input: LeadDiscoveryInput): Promise<{ data: LeadDiscoveryOutput; tokensUsed: number }> {
      // Load ICP if specified
      let icpContext = "";
      if (input.icpId) {
        const icp = icpRepo.findById(input.icpId);
        if (icp) {
          icpContext = `
ICP: ${icp.name}
Industry: ${icp.industry}
Geography: ${icp.geography ?? "any"}
Company Size: ${icp.company_size ?? "any"}
Business Model: ${icp.business_model ?? "any"}
Pain Intensity: ${icp.pain_intensity ?? "unknown"}
Service Fit: ${icp.service_fit ?? "general"}`;
        }
      }

      const count = input.count ?? 10;
      const prompt = [
        `Discover ${count} companies that match these criteria:`,
        icpContext || `Vertical: ${input.vertical ?? "AI automation-ready businesses"}`,
        input.geography ? `Geography: ${input.geography}` : "",
        `\nFor each company, identify the most relevant decision maker.`,
        `Return JSON with the discovered array.`,
      ].filter(Boolean).join("\n");

      let response = await this.chat(
        [{ role: "user", content: prompt }],
        { jsonMode: true, temperature: 0.5 }
      );

      const parseLeads = (content: unknown): { discovered: DiscoveredLead[]; summary: string } | null => {
        const text = typeof content === "string" ? content : "";
        let candidate: unknown = null;
        try {
          candidate = JSON.parse(text);
        } catch {
          candidate = null;
        }
        if (
          candidate &&
          typeof candidate === "object" &&
          Array.isArray((candidate as { discovered?: unknown }).discovered)
        ) {
          return candidate as { discovered: DiscoveredLead[]; summary: string };
        }
        // Regex-fallback parse for responses wrapped in extra text
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            candidate = JSON.parse(match[0]);
          } catch {
            return null;
          }
          if (
            candidate &&
            typeof candidate === "object" &&
            Array.isArray((candidate as { discovered?: unknown }).discovered)
          ) {
            return candidate as { discovered: DiscoveredLead[]; summary: string };
          }
        }
        return null;
      };

      let parsed = parseLeads(response.content);
      let tokensUsed = response.usage.totalTokens;
      if (!parsed) {
        // Retry the chat call ONCE on invalid shape (e.g. model returned literal `null`)
        response = await this.chat(
          [{ role: "user", content: prompt }],
          { jsonMode: true, temperature: 0.5 }
        );
        tokensUsed += response.usage.totalTokens;
        parsed = parseLeads(response.content);
        if (!parsed) {
          const reason = `Invalid model response after retry (expected object with discovered array, got: ${String(response.content).slice(0, 200)})`;
          return {
            data: { discovered: [], saved: 0, duplicatesSkipped: 0, summary: reason },
            tokensUsed,
          };
        }
      }

      // Save to database with deduplication
      let saved = 0;
      let duplicatesSkipped = 0;

      for (const lead of parsed.discovered) {
        // Check for duplicates
        const dup = isDuplicateCompany(lead.companyName, lead.domain);
        if (dup) {
          duplicatesSkipped++;
          continue;
        }

        // Save company
        const { row: company } = companyRepo.upsert({
          name: lead.companyName,
          domain: lead.domain ?? undefined,
          industry: lead.industry,
          geography: lead.geography ?? undefined,
          employee_band: lead.employeeBand ?? undefined,
          research_summary: lead.reason,
          evidence: JSON.stringify(lead.evidence),
          source: lead.source,
          icp_id: input.icpId ?? undefined,
        });

        // Save contacts
        for (const contact of lead.contacts) {
          contactRepo.upsert({
            company_id: company.id,
            first_name: contact.firstName ?? undefined,
            last_name: contact.lastName ?? undefined,
            title: contact.title ?? undefined,
            role_category: contact.roleCategory ?? undefined,
            email: contact.email ?? undefined,
            linkedin_url: contact.linkedinUrl ?? undefined,
            source: lead.source,
            stage: "LEAD_DISCOVERY",
          });
        }

        await events.emit({
          eventType: "lead.discovered",
          actor: "lead-discovery",
          entityType: "company",
          entityId: company.id,
          metadata: {
            name: lead.companyName,
            signals: lead.signals,
            contactCount: lead.contacts.length,
          },
        });

        saved++;
      }

      return {
        data: {
          discovered: parsed.discovered,
          saved,
          duplicatesSkipped,
          summary: `Discovered ${parsed.discovered.length} leads, saved ${saved}, skipped ${duplicatesSkipped} duplicates`,
        },
        tokensUsed,
      };
    }
  })();
}
