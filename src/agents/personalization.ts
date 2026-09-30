/**
 * Personalization / Copy Agent
 * Generates evidence-based outreach copy — no fake familiarity, no invented compliments.
 * Follows Section 7.9 rules from the master prompt.
 */

import { BaseAgent } from "./base.js";
import { type LLMRegistry } from "../providers/llm.js";
import { getOperatorContext } from "../core/operator.js";
import { companyRepo, contactRepo } from "../db/repository.js";
import { events } from "../events/emitter.js";

export interface PersonalizationInput {
  companyId: string;
  contactId?: string;
  researchSummary?: string;
  observableProblem?: string;
  offerTitle?: string;
  personalizationHooks?: string[];
  outreachAngle?: string;
  channel?: "email" | "linkedin" | "cold-call-script";
}

export interface PersonalizationOutput {
  companyId: string;
  contactId: string;
  channel: string;
  subjectLine: string;
  openingLine: string;
  body: string;
  cta: string;
  psDrop?: string;
  fullMessage: string;
  wordCount: number;
  evidenceCited: string[];
  claimsAvoided: string[];
  tone: string;
}

export function createPersonalizationAgent(llm: LLMRegistry) {
  return new (class extends BaseAgent<PersonalizationInput, PersonalizationOutput> {
    constructor() {
      super({
        name: "personalization",
        description: "Generates evidence-based outreach copy",
        systemPrompt: `You are an Outreach Copy Agent. You generate concise, evidence-based outreach messages.

OPERATOR CONTEXT:
${getOperatorContext().slice(0, 2000)}

OUTREACH RULES (non-negotiable):
1. NO fake familiarity — do not pretend you know them or have been following their work
2. NO invented compliments — "I love what you're doing with X" is banned unless citing specific evidence
3. NO fake urgency — "limited spots", "prices going up" is banned
4. NO laundry list of services — ONE problem, ONE offer
5. ONE primary CTA — low-friction (15-min call, async review, quick audit)
6. Make relevance visible in the first two sentences — they should immediately see why you're reaching out
7. Keep it short — under 150 words for email, under 100 for LinkedIn
8. Lead with their problem, not your capabilities
9. Only cite evidence that actually exists in the research
10. Sign off naturally — no "best regards" corporate closings

STRUCTURE (email):
- Subject: specific to their situation, no clickbait
- Opening: observable problem + why you noticed
- Bridge: how this typically plays out (consequence)
- Offer: specific bounded thing you can do
- CTA: low-friction next step
- P.S. (optional): one relevant proof point

STRUCTURE (LinkedIn):
- Hook: their problem in one line
- Context: what you noticed + credibility
- CTA: simple ask

OUTPUT FORMAT (JSON):
{
  "companyId": "string",
  "contactId": "string",
  "channel": "email|linkedin|cold-call-script",
  "subjectLine": "string — specific, not clickbait",
  "openingLine": "string — the first sentence",
  "body": "string — the full message body",
  "cta": "string — the call to action",
  "psDrop": "string|null — optional P.S. line",
  "fullMessage": "string — the complete assembled message",
  "wordCount": number,
  "evidenceCited": ["string — each piece of evidence used"],
  "claimsAvoided": ["string — things we deliberately did NOT claim"],
  "tone": "string — description of tone used"
}`,
        llm,
        temperature: 0.5,
        maxTokens: 2000,
      });
    }

    async execute(input: PersonalizationInput): Promise<{ data: PersonalizationOutput; tokensUsed: number }> {
      const company = companyRepo.findById(input.companyId);
      if (!company) throw new Error(`Company ${input.companyId} not found`);

      const contacts = contactRepo.findByCompany(input.companyId);
      const contact = input.contactId
        ? contacts.find((c) => c.id === input.contactId) ?? contacts[0]
        : contacts[0];

      if (!contact) throw new Error(`No contacts found for company ${input.companyId}`);

      const channel = input.channel ?? "email";

      const prompt = `Write a ${channel} outreach message for this prospect:

Company: ${company.name}
Domain: ${company.domain ?? "unknown"}
Industry: ${company.industry ?? "unknown"}
Size: ${company.employee_band ?? "unknown"}

Contact: ${contact.first_name ?? ""} ${contact.last_name ?? ""}
Title: ${contact.title ?? "unknown"}

Research: ${input.researchSummary ?? company.research_summary ?? "minimal"}
Observable problem: ${input.observableProblem ?? "not specified"}
Offer: ${input.offerTitle ?? "not specified"}
Outreach angle: ${input.outreachAngle ?? "not specified"}
Personalization hooks: ${(input.personalizationHooks ?? []).join("; ") || "none provided"}

Remember:
- Lead with THEIR problem, not your capabilities
- Be specific and evidence-based
- Under ${channel === "linkedin" ? "100" : "150"} words
- ONE CTA only
- No fake familiarity or invented compliments

Return JSON.`;

      const response = await this.chat([{ role: "user", content: prompt }], { jsonMode: true });

      let data: PersonalizationOutput;
      try {
        data = JSON.parse(response.content);
      } catch {
        const match = response.content.match(/\{[\s\S]*\}/);
        data = match
          ? JSON.parse(match[0])
          : {
              companyId: input.companyId,
              contactId: contact.id,
              channel,
              subjectLine: "",
              openingLine: "",
              body: "",
              cta: "",
              fullMessage: "",
              wordCount: 0,
              evidenceCited: [],
              claimsAvoided: [],
              tone: "",
            };
      }

      // Ensure IDs are correct
      data.companyId = input.companyId;
      data.contactId = contact.id;
      data.channel = channel;

      await events.emit({
        eventType: "outreach.drafted",
        actor: "personalization",
        entityType: "contact",
        entityId: contact.id,
        metadata: { channel, wordCount: data.wordCount, companyId: input.companyId },
      });

      return { data, tokensUsed: response.usage.totalTokens };
    }
  })();
}
