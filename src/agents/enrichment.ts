/**
 * Enrichment Agent
 * Resolves company/contact identity and enriches with additional data.
 */

import { BaseAgent } from "./base.js";
import { type LLMRegistry } from "../providers/llm.js";
import { getOperatorContext } from "../core/operator.js";
import { companyRepo, contactRepo, type CompanyRow } from "../db/repository.js";
import { events } from "../events/emitter.js";

export interface EnrichmentInput {
  companyId: string;
}

export interface EnrichmentData {
  domain: string | null;
  industry: string;
  geography: string;
  employeeBand: string;
  revenueBand: string | null;
  techStack: string[];
  socialPresence: { platform: string; url: string }[];
  recentSignals: string[];
  contactEnrichments: Array<{
    contactId: string;
    roleCategory: string;
    seniorityLevel: string;
  }>;
}

export interface EnrichmentOutput {
  companyId: string;
  enriched: boolean;
  data: EnrichmentData;
  summary: string;
}

export function createEnrichmentAgent(llm: LLMRegistry) {
  return new (class extends BaseAgent<EnrichmentInput, EnrichmentOutput> {
    constructor() {
      super({
        name: "enrichment",
        description: "Enriches company and contact data with additional signals",
        systemPrompt: `You are an Enrichment Agent. Given a company and its known contacts, enrich the data with:
- Industry classification
- Geography/HQ location
- Employee count band (1-10, 10-50, 50-200, 200-1000, 1000+)
- Revenue band if estimable
- Likely technology stack (CRM, website platform, marketing tools)
- Social media presence
- Recent signals (hiring, funding, product launches, complaints)
- Contact role categorization (founder, c-suite, vp, director, manager, individual)

OPERATOR CONTEXT:
${getOperatorContext()}

OUTPUT FORMAT (JSON):
{
  "domain": "string or null",
  "industry": "string",
  "geography": "string",
  "employeeBand": "string",
  "revenueBand": "string or null",
  "techStack": ["string"],
  "socialPresence": [{"platform": "string", "url": "string"}],
  "recentSignals": ["string"],
  "contactEnrichments": [{"contactId": "string", "roleCategory": "string", "seniorityLevel": "string"}],
  "summary": "string"
}

RULES:
- Only state what can be reasonably inferred. Mark unknowns as null.
- Attach source reasoning to signals.
- Do not fabricate social URLs or tech stack — infer from typical industry patterns.`,
        llm,
        temperature: 0.2,
        maxTokens: 2500,
      });
    }

    async execute(input: EnrichmentInput): Promise<{ data: EnrichmentOutput; tokensUsed: number }> {
      const company = companyRepo.findById(input.companyId);
      if (!company) throw new Error(`Company ${input.companyId} not found`);

      const contacts = contactRepo.findByCompany(input.companyId);

      const prompt = `Enrich this company:
Name: ${company.name}
Domain: ${company.domain ?? "unknown"}
Industry: ${company.industry ?? "unknown"}
Geography: ${company.geography ?? "unknown"}
Existing research: ${company.research_summary ?? "none"}

Known contacts:
${contacts.map((c) => `- ${c.first_name ?? ""} ${c.last_name ?? ""} — ${c.title ?? "unknown title"} (ID: ${c.id})`).join("\n") || "None"}

Return enriched JSON.`;

      const response = await this.chat([{ role: "user", content: prompt }], { jsonMode: true });

      let enriched: EnrichmentData & { summary: string };
      try {
        enriched = JSON.parse(response.content);
      } catch {
        const match = response.content.match(/\{[\s\S]*\}/);
        enriched = match ? JSON.parse(match[0]) : { domain: null, industry: company.industry ?? "", geography: "", employeeBand: "", revenueBand: null, techStack: [], socialPresence: [], recentSignals: [], contactEnrichments: [], summary: "Parse error" };
      }

      // Update company
      companyRepo.update(input.companyId, {
        domain: enriched.domain ?? company.domain,
        industry: enriched.industry,
        geography: enriched.geography,
        employee_band: enriched.employeeBand,
        revenue_band: enriched.revenueBand,
        last_researched_at: new Date().toISOString(),
      });

      // Update contacts
      for (const ce of enriched.contactEnrichments) {
        if (ce.contactId) {
          contactRepo.update(ce.contactId, { role_category: ce.roleCategory });
        }
      }

      await events.emit({
        eventType: "lead.enriched",
        actor: "enrichment",
        entityType: "company",
        entityId: input.companyId,
        metadata: { signals: enriched.recentSignals.length, techStack: enriched.techStack.length },
      });

      return {
        data: {
          companyId: input.companyId,
          enriched: true,
          data: enriched,
          summary: enriched.summary,
        },
        tokensUsed: response.usage.totalTokens,
      };
    }
  })();
}
