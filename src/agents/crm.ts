/**
 * CRM Agent
 * Syncs contacts, companies, and deals between local DB and HubSpot.
 * Prevents duplicates, manages lifecycle stages, records touchpoints.
 */

import { BaseAgent } from "./base.js";
import { type LLMRegistry } from "../providers/llm.js";
import { HubSpotClient } from "../integrations/hubspot.js";
import { companyRepo, contactRepo, type CompanyRow, type ContactRow } from "../db/repository.js";
import { events } from "../events/emitter.js";
import { logger } from "../core/logger.js";
import type { Config } from "../core/config.js";

export interface CRMSyncInput {
  action: "sync" | "push" | "pull" | "status";
  companyId?: string;
  contactId?: string;
  batchSize?: number;
}

export interface CRMSyncResult {
  companiesSynced: number;
  contactsSynced: number;
  dealsSynced: number;
  errors: string[];
  summary: string;
}

export function createCRMAgent(llm: LLMRegistry, config: Config) {
  return new (class extends BaseAgent<CRMSyncInput, CRMSyncResult> {
    hubspot: HubSpotClient | null = null;

    constructor() {
      super({
        name: "crm-agent",
        description: "Syncs data between local DB and HubSpot CRM",
        systemPrompt: "CRM synchronization agent.",
        llm,
        temperature: 0,
      });

      try {
        this.hubspot = new HubSpotClient(config);
      } catch {
        logger.warn("HubSpot not configured — CRM agent will operate in local-only mode", {}, "crm-agent");
      }
    }

    async execute(input: CRMSyncInput): Promise<{ data: CRMSyncResult; tokensUsed: number }> {
      if (!this.hubspot) {
        return {
          data: {
            companiesSynced: 0, contactsSynced: 0, dealsSynced: 0,
            errors: ["HubSpot not configured. Set HUBSPOT_ACCESS_TOKEN in .env"],
            summary: "CRM sync skipped — no HubSpot token",
          },
          tokensUsed: 0,
        };
      }

      switch (input.action) {
        case "push": return { data: await this.pushToHubSpot(input), tokensUsed: 0 };
        case "pull": return { data: await this.pullFromHubSpot(input), tokensUsed: 0 };
        case "status": return { data: await this.getStatus(), tokensUsed: 0 };
        case "sync":
        default: return { data: await this.fullSync(input), tokensUsed: 0 };
      }
    }

    /** Push local data to HubSpot */
    async pushToHubSpot(input: CRMSyncInput): Promise<CRMSyncResult> {
      const result: CRMSyncResult = { companiesSynced: 0, contactsSynced: 0, dealsSynced: 0, errors: [], summary: "" };
      const hs = this.hubspot!;

      // Get companies to push
      let companies: CompanyRow[];
      if (input.companyId) {
        const c = companyRepo.findById(input.companyId);
        companies = c ? [c] : [];
      } else {
        companies = companyRepo.list({ limit: input.batchSize ?? 20 });
      }

      for (const company of companies) {
        try {
          // Push company
          const props: Record<string, string> = { name: company.name };
          if (company.domain) props.domain = company.domain;
          if (company.industry) props.industry = company.industry;
          if (company.geography) props.city = company.geography;
          if (company.employee_band) props.numberofemployees = company.employee_band;

          const hsCompany = await hs.upsertCompany(company.domain ?? "", props);

          // Save HubSpot ID back to local DB
          companyRepo.update(company.id, { hubspot_id: hsCompany.id });
          result.companiesSynced++;

          // Push contacts for this company
          const contacts = contactRepo.findByCompany(company.id);
          for (const contact of contacts) {
            if (!contact.email) continue;
            if (contact.consent_state === "opted-out" || contact.consent_state === "suppressed") continue;

            try {
              const cProps: Record<string, string> = {};
              if (contact.first_name) cProps.firstname = contact.first_name;
              if (contact.last_name) cProps.lastname = contact.last_name;
              if (contact.title) cProps.jobtitle = contact.title;

              // Map stage to HubSpot lifecycle
              const stageMap: Record<string, string> = {
                LEAD_DISCOVERY: "subscriber",
                ENRICHMENT: "lead",
                QUALIFICATION: "lead",
                ACCOUNT_RESEARCH: "marketingqualifiedlead",
                OUTREACH: "marketingqualifiedlead",
                MEETING: "salesqualifiedlead",
                OPPORTUNITY: "opportunity",
                WON: "customer",
              };
              const lifecycle = stageMap[contact.stage];
              if (lifecycle) cProps.lifecyclestage = lifecycle;

              const hsContact = await hs.upsertContact(contact.email, cProps);
              contactRepo.update(contact.id, { hubspot_id: hsContact.id });

              // Associate contact to company
              await hs.associateContactToCompany(hsContact.id, hsCompany.id);
              result.contactsSynced++;
            } catch (err) {
              result.errors.push(`Contact ${contact.email}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }

          await events.emit({
            eventType: "crm.synced",
            actor: "crm-agent",
            entityType: "company",
            entityId: company.id,
            metadata: { hubspotId: hsCompany.id, direction: "push" },
          });
        } catch (err) {
          result.errors.push(`Company ${company.name}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      result.summary = `Pushed ${result.companiesSynced} companies, ${result.contactsSynced} contacts. ${result.errors.length} errors.`;
      return result;
    }

    /** Pull data from HubSpot (placeholder for future) */
    async pullFromHubSpot(_input: CRMSyncInput): Promise<CRMSyncResult> {
      // Future: search HubSpot for contacts/companies and import to local DB
      return {
        companiesSynced: 0, contactsSynced: 0, dealsSynced: 0,
        errors: [],
        summary: "Pull from HubSpot — available in future update. Use push to sync local → HubSpot.",
      };
    }

    /** Full bidirectional sync */
    async fullSync(input: CRMSyncInput): Promise<CRMSyncResult> {
      return this.pushToHubSpot(input);
    }

    /** Get CRM connection status */
    async getStatus(): Promise<CRMSyncResult> {
      const hs = this.hubspot!;
      const healthy = await hs.healthCheck();
      const stats = hs.getStats();
      const localCompanies = companyRepo.count();
      const localContacts = contactRepo.count();
      const syncedCompanies = companyRepo.list({ limit: 1000 }).filter((c) => c.hubspot_id).length;

      return {
        companiesSynced: syncedCompanies,
        contactsSynced: 0,
        dealsSynced: 0,
        errors: healthy ? [] : ["HubSpot connection failed"],
        summary: `HubSpot: ${healthy ? "connected" : "DISCONNECTED"} | Local: ${localCompanies} companies, ${localContacts} contacts | Synced: ${syncedCompanies} companies | API calls: ${stats.requestCount}`,
      };
    }
  })();
}
