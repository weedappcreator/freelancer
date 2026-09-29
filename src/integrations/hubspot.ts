/**
 * HubSpot CRM Adapter
 * HTTP client for HubSpot API v3 — contacts, companies, deals.
 * Rate-limited, error-handled, idempotent mutations.
 */

import { logger } from "../core/logger.js";
import type { Config } from "../core/config.js";

const HUBSPOT_API = "https://api.hubapi.com";

interface HubSpotError {
  status: string;
  message: string;
  correlationId: string;
}

interface HubSpotObject {
  id: string;
  properties: Record<string, string | null>;
  createdAt: string;
  updatedAt: string;
}

interface HubSpotSearchResult {
  total: number;
  results: HubSpotObject[];
}

export class HubSpotClient {
  private token: string;
  private requestCount = 0;
  private lastRequestAt = 0;
  private minIntervalMs = 110; // ~9 req/s (HubSpot limit is 10/s)

  constructor(config: Config) {
    if (!config.hubspotAccessToken) {
      throw new Error("HubSpot access token not configured. Set HUBSPOT_ACCESS_TOKEN in .env");
    }
    this.token = config.hubspotAccessToken;
  }

  // ─── Rate Limiting ──────────────────────────────────────────────

  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < this.minIntervalMs) {
      await new Promise((r) => setTimeout(r, this.minIntervalMs - elapsed));
    }
    this.lastRequestAt = Date.now();
    this.requestCount++;
  }

  // ─── HTTP Layer ─────────────────────────────────────────────────

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    await this.throttle();

    const url = `${HUBSPOT_API}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
    };

    logger.debug(`HubSpot ${method} ${path}`, {}, "crm-agent");

    const resp = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      let errMsg: string;
      try {
        const parsed = JSON.parse(errText) as HubSpotError;
        errMsg = parsed.message;
      } catch {
        errMsg = errText;
      }

      if (resp.status === 429) {
        // Rate limited — wait and retry once
        logger.warn("HubSpot rate limited, waiting 10s...", {}, "crm-agent");
        await new Promise((r) => setTimeout(r, 10000));
        return this.request(method, path, body);
      }

      throw new Error(`HubSpot API ${resp.status}: ${errMsg}`);
    }

    if (resp.status === 204) return {} as T;
    return (await resp.json()) as T;
  }

  // ─── Contacts ───────────────────────────────────────────────────

  async createContact(properties: Record<string, string>): Promise<HubSpotObject> {
    return this.request<HubSpotObject>("POST", "/crm/v3/objects/contacts", { properties });
  }

  async updateContact(id: string, properties: Record<string, string>): Promise<HubSpotObject> {
    return this.request<HubSpotObject>("PATCH", `/crm/v3/objects/contacts/${id}`, { properties });
  }

  async getContact(id: string): Promise<HubSpotObject> {
    return this.request<HubSpotObject>("GET", `/crm/v3/objects/contacts/${id}?properties=email,firstname,lastname,jobtitle,lifecyclestage,hs_lead_status`);
  }

  async searchContacts(email: string): Promise<HubSpotSearchResult> {
    return this.request<HubSpotSearchResult>("POST", "/crm/v3/objects/contacts/search", {
      filterGroups: [{
        filters: [{ propertyName: "email", operator: "EQ", value: email }],
      }],
      properties: ["email", "firstname", "lastname", "jobtitle", "lifecyclestage"],
      limit: 1,
    });
  }

  /** Upsert contact — search by email first, create or update */
  async upsertContact(email: string, properties: Record<string, string>): Promise<{ id: string; created: boolean }> {
    const search = await this.searchContacts(email);
    if (search.results.length > 0) {
      const existing = search.results[0];
      await this.updateContact(existing.id, properties);
      logger.info(`HubSpot contact updated: ${email}`, { id: existing.id }, "crm-agent");
      return { id: existing.id, created: false };
    }

    const created = await this.createContact({ ...properties, email });
    logger.info(`HubSpot contact created: ${email}`, { id: created.id }, "crm-agent");
    return { id: created.id, created: true };
  }

  // ─── Companies ──────────────────────────────────────────────────

  async createCompany(properties: Record<string, string>): Promise<HubSpotObject> {
    return this.request<HubSpotObject>("POST", "/crm/v3/objects/companies", { properties });
  }

  async updateCompany(id: string, properties: Record<string, string>): Promise<HubSpotObject> {
    return this.request<HubSpotObject>("PATCH", `/crm/v3/objects/companies/${id}`, { properties });
  }

  async searchCompanies(domain: string): Promise<HubSpotSearchResult> {
    return this.request<HubSpotSearchResult>("POST", "/crm/v3/objects/companies/search", {
      filterGroups: [{
        filters: [{ propertyName: "domain", operator: "EQ", value: domain }],
      }],
      properties: ["name", "domain", "industry", "numberofemployees", "city", "state", "country"],
      limit: 1,
    });
  }

  /** Upsert company — search by domain first */
  async upsertCompany(domain: string, properties: Record<string, string>): Promise<{ id: string; created: boolean }> {
    if (domain) {
      const search = await this.searchCompanies(domain);
      if (search.results.length > 0) {
        const existing = search.results[0];
        await this.updateCompany(existing.id, properties);
        logger.info(`HubSpot company updated: ${domain}`, { id: existing.id }, "crm-agent");
        return { id: existing.id, created: false };
      }
    }

    const created = await this.createCompany({ ...properties, domain });
    logger.info(`HubSpot company created: ${domain}`, { id: created.id }, "crm-agent");
    return { id: created.id, created: true };
  }

  // ─── Deals ──────────────────────────────────────────────────────

  async createDeal(properties: Record<string, string>): Promise<HubSpotObject> {
    return this.request<HubSpotObject>("POST", "/crm/v3/objects/deals", { properties });
  }

  async updateDeal(id: string, properties: Record<string, string>): Promise<HubSpotObject> {
    return this.request<HubSpotObject>("PATCH", `/crm/v3/objects/deals/${id}`, { properties });
  }

  async getDeal(id: string): Promise<HubSpotObject> {
    return this.request<HubSpotObject>("GET", `/crm/v3/objects/deals/${id}?properties=dealname,dealstage,amount,pipeline`);
  }

  // ─── Associations ───────────────────────────────────────────────

  async associateContactToCompany(contactId: string, companyId: string): Promise<void> {
    await this.request("PUT", `/crm/v3/objects/contacts/${contactId}/associations/companies/${companyId}/1`, {});
  }

  async associateDealToCompany(dealId: string, companyId: string): Promise<void> {
    await this.request("PUT", `/crm/v3/objects/deals/${dealId}/associations/companies/${companyId}/5`, {});
  }

  async associateDealToContact(dealId: string, contactId: string): Promise<void> {
    await this.request("PUT", `/crm/v3/objects/deals/${dealId}/associations/contacts/${contactId}/3`, {});
  }

  // ─── Health Check ───────────────────────────────────────────────

  async healthCheck(): Promise<boolean> {
    try {
      await this.request("GET", "/crm/v3/objects/contacts?limit=1");
      return true;
    } catch {
      return false;
    }
  }

  getStats() {
    return { requestCount: this.requestCount };
  }
}
