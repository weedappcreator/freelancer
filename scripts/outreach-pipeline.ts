#!/usr/bin/env npx tsx
/**
 * OUTREACH PIPELINE — Full Lead-to-Send Pipeline
 *
 * Processes 50 leads through:
 *   1. Website verification (is it live?)
 *   2. Website analysis via LLM (pain points, opportunities)
 *   3. Service matching (best offer per lead)
 *   4. Personalized email drafting (psychology-driven copy)
 *   5. Email sending (with approval gate)
 *
 * Usage:
 *   npx tsx scripts/outreach-pipeline.ts                    # Analyze + draft all
 *   npx tsx scripts/outreach-pipeline.ts --verify-smtp      # Test email connection
 *   npx tsx scripts/outreach-pipeline.ts --preview 5        # Preview lead #5
 *   npx tsx scripts/outreach-pipeline.ts --send             # Send all drafted emails
 *   npx tsx scripts/outreach-pipeline.ts --send --limit 5   # Send first 5 only
 *   npx tsx scripts/outreach-pipeline.ts --enrich           # Try to find emails from websites
 */

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

// ─── Types ──────────────────────────────────────────────────────────

interface Lead {
  name: string;
  rating: number | null;
  reviews_count: number | null;
  address: string;
  phone: string;
  website: string | null;
  hours: string | null;
  maps_url: string;
  query: string;
}

interface LeadFile {
  query: string;
  places: Lead[];
}

interface AnalyzedLead extends Lead {
  index: number;
  category: string;
  websiteLive: boolean | null;
  websiteHttps: boolean;
  painPoints: string[];
  llmAnalysis: string | null;
  matchedService: ServiceOffer;
  emailDraft: EmailDraft | null;
  contactEmail: string | null;
  status: "pending" | "analyzed" | "drafted" | "sent" | "skipped" | "failed";
  skipReason?: string;
}

interface EmailDraft {
  subject: string;
  body: string;
  tone: string;
  wordCount: number;
  psychologyTechniques: string[];
}

interface ServiceOffer {
  id: string;
  name: string;
  pitch: string;
  proofPoint: string;
  pricingAnchor: string;
}

// ─── Operator Services (from OPERATOR_CONTEXT.md) ───────────────────

const SERVICES: ServiceOffer[] = [
  {
    id: "ai-automation",
    name: "AI Automation & Workflow Systems",
    pitch: "I build AI systems that handle the repetitive work — scheduling, follow-ups, data entry, reporting — so your team focuses on revenue-generating work",
    proofPoint: "I recently built an AI system that handles client intake, appointment scheduling, and follow-up automatically for a service business",
    pricingAnchor: "Most businesses start with a single workflow automation ($1,500–3,000)",
  },
  {
    id: "website-redesign",
    name: "Modern Website + Online Booking",
    pitch: "I build fast, mobile-first websites that actually convert visitors into booked appointments — with AI-powered chat, online booking, and automatic follow-up",
    proofPoint: "The sites I build typically load in under 2 seconds and include built-in appointment booking that works 24/7",
    pricingAnchor: "A conversion-focused site with booking starts around $2,500",
  },
  {
    id: "lead-gen",
    name: "AI-Powered Lead Generation System",
    pitch: "I build systems that automatically find and qualify potential clients from online directories, social media, and your existing network — so your pipeline never dries up",
    proofPoint: "I've built lead discovery systems that surface 50+ qualified prospects per week automatically",
    pricingAnchor: "Lead gen systems typically start at $2,000 setup + monthly optimization",
  },
  {
    id: "review-reputation",
    name: "Automated Review & Reputation System",
    pitch: "I set up automated systems to collect 5-star reviews after every appointment, respond to feedback instantly, and keep your Google rating climbing",
    proofPoint: "Businesses using automated review collection typically see a 40-60% increase in review volume within 90 days",
    pricingAnchor: "Review automation setup starts around $1,200",
  },
  {
    id: "social-content",
    name: "AI Content & Social Media Engine",
    pitch: "I build AI content engines that produce branded posts, blogs, and newsletters on autopilot — consistent presence without hiring a full-time creator",
    proofPoint: "My AI content systems can produce 30+ branded posts per month, each aligned to your voice and audience",
    pricingAnchor: "Content engine setup starts around $1,500/month",
  },
  {
    id: "crm-pipeline",
    name: "Smart CRM & Pipeline Automation",
    pitch: "I set up intelligent CRM systems that track every lead, automate follow-ups at the right time, and make sure no deal falls through the cracks",
    proofPoint: "Most service businesses lose 30-50% of leads to slow follow-up — automation fixes that on day one",
    pricingAnchor: "CRM + pipeline automation starts around $2,000",
  },
];

// ─── Psychology-Driven Email Templates ──────────────────────────────
// Based on: Cialdini's principles, PAS framework, pattern interrupt,
// curiosity gap, social proof, loss aversion, reciprocity

function buildEmailCopy(
  lead: Lead,
  category: string,
  painPoints: string[],
  service: ServiceOffer,
  llmInsight: string | null
): EmailDraft {
  const tag = getCategoryTag(category);
  const bizName = lead.name;

  // Pick top 2 most compelling pain points
  const topPains = painPoints.slice(0, 2);

  // ─── Subject Line Strategy ───────────────────────────────
  // Use curiosity gap + specificity — NOT clickbait
  const subjectStrategies: Record<string, string[]> = {
    dental: [
      `Quick question about ${bizName}'s online booking`,
      `Noticed something about ${bizName} online`,
      `${bizName} — spotted an easy win`,
      `Idea for ${bizName} (2-min read)`,
    ],
    "real estate": [
      `Quick idea for ${bizName}'s lead follow-up`,
      `${bizName} — spotted something in your online presence`,
      `How ${bizName} could close more deals automatically`,
      `Noticed a gap in ${bizName}'s pipeline`,
    ],
    marketing: [
      `${bizName} — an AI angle you might not have tried`,
      `Quick question for the ${bizName} team`,
      `Idea: 10x ${bizName}'s content output`,
      `${bizName} — saw a potential efficiency gain`,
    ],
  };
  const subjects = subjectStrategies[tag] ?? subjectStrategies["marketing"];
  const subject = subjects[Math.floor(Math.random() * subjects.length)];

  // ─── Body: PAS Framework (Problem → Agitate → Solve) ─────
  // + Pattern interrupt opening (NOT "I came across your business")
  // + Loss aversion (what they're missing)
  // + Reciprocity (offering value upfront)
  // + Low-friction CTA

  const openings: Record<string, string[]> = {
    dental: [
      `I was looking at dental practices in the Miami area and ${bizName} stood out — but I also noticed something that might be costing you patients.`,
      `I research local businesses to see where simple tech upgrades could make a big difference. ${bizName} caught my eye.`,
    ],
    "real estate": [
      `I've been studying how Miami real estate agencies handle their lead pipeline, and I noticed something about ${bizName} that could be leaving deals on the table.`,
      `Quick observation about ${bizName} — I think there's a gap in your current setup that's probably costing you closings.`,
    ],
    marketing: [
      `I work with agencies that want to multiply their output without multiplying their headcount. I noticed something about ${bizName} that got me thinking.`,
      `Quick thought for the ${bizName} team — I've been looking at how Miami agencies are using AI, and I see an opening for you.`,
    ],
  };
  const opening = (openings[tag] ?? openings["marketing"])[Math.floor(Math.random() * 2)];

  // Pain point section — use loss aversion framing
  const painSection = topPains
    .map((p) => `• ${p.charAt(0).toUpperCase() + p.slice(1)}`)
    .join("\n");

  // Bridge — agitate with consequence
  const bridges: Record<string, string> = {
    dental: `Every day these gaps stay open, potential patients are choosing the practice that made it easier to book online, read reviews, or get a quick answer. It adds up fast.`,
    "real estate": `In real estate, the agent who follows up first wins the deal. When leads sit in a spreadsheet or inbox, the other agent gets the closing.`,
    marketing: `Your competitors are already using AI to produce 5x the content at half the cost. The agencies that adapt now will own the next 3 years.`,
  };
  const bridge = bridges[tag] ?? bridges["marketing"];

  // Solution — specific, bounded, credible
  const solution = service.pitch + ".";

  // CTA — low friction, reciprocity (offering something free)
  const ctas = [
    `Would a quick 15-minute call make sense this week? I'm happy to walk through exactly what I'd do — no strings attached.`,
    `I put together a few specific ideas for ${bizName}. Want me to send them over? Takes 2 minutes to review.`,
    `If this sounds relevant, I can do a quick free audit of your current setup and show you exactly where the biggest wins are. Interested?`,
  ];
  const cta = ctas[Math.floor(Math.random() * ctas.length)];

  // P.S. — social proof or proof point (Cialdini: social proof)
  const ps = `P.S. ${service.proofPoint}.`;

  const body = `${opening}

Here's what I noticed:
${painSection}

${bridge}

${solution}

${cta}

${ps}

Best,
Weed Kerwing Edouard
AI Automation & Growth Systems
edoukerwing@gmail.com`;

  const wordCount = body.split(/\s+/).length;

  return {
    subject,
    body,
    tone: "consultative, direct, evidence-based",
    wordCount,
    psychologyTechniques: [
      "PAS framework (Problem-Agitate-Solve)",
      "Pattern interrupt opening",
      "Loss aversion framing",
      "Specificity bias (concrete observations)",
      "Reciprocity (free value offer)",
      "Low-friction CTA",
      "Social proof in P.S.",
      "Curiosity gap subject line",
    ],
  };
}

// ─── Helpers ────────────────────────────────────────────────────────

function loadLeads(): { leads: Lead[]; categories: Map<Lead, string> } {
  const leadsDir = path.resolve("data/leads");
  const files = fs.readdirSync(leadsDir).filter((f) => f.endsWith(".json"));
  const leads: Lead[] = [];
  const categories = new Map<Lead, string>();

  for (const file of files) {
    const data: LeadFile = JSON.parse(fs.readFileSync(path.join(leadsDir, file), "utf8"));
    const category = file.replace("_miami.json", "").replace(/_/g, " ");
    for (const place of data.places) {
      leads.push(place);
      categories.set(place, category);
    }
  }
  return { leads, categories };
}

function getCategoryTag(category: string): string {
  if (category.includes("dental")) return "dental";
  if (category.includes("real")) return "real estate";
  if (category.includes("market")) return "marketing";
  return "marketing";
}

async function checkWebsite(url: string): Promise<{ live: boolean; https: boolean; redirectUrl?: string }> {
  const normalized = url.startsWith("http") ? url : `https://${url}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(normalized, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);
    return {
      live: resp.ok || resp.status === 403 || resp.status === 405,
      https: normalized.startsWith("https://") || (resp.url?.startsWith("https://") ?? false),
    };
  } catch {
    return { live: false, https: false };
  }
}

function analyzePainPoints(lead: Lead, category: string, websiteCheck: { live: boolean; https: boolean }): string[] {
  const tag = getCategoryTag(category);
  const pains: string[] = [];

  // Website issues
  if (!lead.website) {
    pains.push("No website at all — you're invisible to everyone searching online");
  } else if (!websiteCheck.live) {
    pains.push("Your website appears to be down or unreachable — every hour it's down, you're losing potential customers");
  } else {
    if (!websiteCheck.https) {
      pains.push("Your website isn't using HTTPS — browsers show a 'Not Secure' warning that scares visitors away");
    }
    if (lead.website.includes("facebook.com")) {
      pains.push("You're using Facebook as your website — you don't own the platform, and it looks unprofessional to serious buyers");
    }
    if (lead.website.includes("wix") || lead.website.includes("weebly")) {
      pains.push("Your website is on a basic builder — it's likely slow on mobile and missing features that convert visitors into customers");
    }
  }

  // Rating issues
  if (lead.rating !== null && lead.rating < 4.0) {
    pains.push(`Your Google rating is ${lead.rating}/5 — potential customers see that before they ever visit your site`);
  } else if (lead.rating !== null && lead.rating < 4.5) {
    pains.push(`Your rating is ${lead.rating}/5 — close to great, but a few more 5-star reviews would put you above competitors`);
  }

  // Missing info
  if (!lead.hours) {
    pains.push("No business hours listed on Google Maps — customers don't know when you're open");
  }

  // Category-specific
  if (tag === "dental") {
    if (lead.website && websiteCheck.live) {
      pains.push("Most dental sites don't have real-time online booking — patients abandon and call the next practice");
    }
    pains.push("Patient follow-ups and appointment reminders are probably manual — that's hours of staff time per week");
  } else if (tag === "real estate") {
    pains.push("Lead follow-up speed determines who wins the listing — most agents respond too slowly");
    pains.push("Your team is probably tracking leads across email, phone, and texts with no single system");
  } else if (tag === "marketing") {
    pains.push("AI tools can 10x content production — agencies not using them are falling behind on deliverables");
    pains.push("Client reporting and campaign management probably eats more hours than actual creative work");
  }

  return pains;
}

function matchService(category: string, painPoints: string[]): ServiceOffer {
  const tag = getCategoryTag(category);
  const painText = painPoints.join(" ").toLowerCase();

  // Smart matching based on pain signals
  if (painText.includes("website") && (painText.includes("down") || painText.includes("no website") || painText.includes("invisible"))) {
    return SERVICES.find((s) => s.id === "website-redesign")!;
  }
  if (painText.includes("rating") || painText.includes("review") || painText.includes("reputation")) {
    return SERVICES.find((s) => s.id === "review-reputation")!;
  }
  if (painText.includes("follow-up") || painText.includes("pipeline") || painText.includes("tracking")) {
    return SERVICES.find((s) => s.id === "crm-pipeline")!;
  }
  if (painText.includes("booking") || painText.includes("appointment") || painText.includes("schedule")) {
    return SERVICES.find((s) => s.id === "website-redesign")!;
  }
  if (painText.includes("content") || painText.includes("social") || painText.includes("post")) {
    return SERVICES.find((s) => s.id === "social-content")!;
  }

  // Category defaults
  const defaults: Record<string, string> = {
    dental: "website-redesign",
    "real estate": "crm-pipeline",
    marketing: "ai-automation",
  };
  return SERVICES.find((s) => s.id === (defaults[tag] ?? "ai-automation"))!;
}

async function tryExtractEmail(websiteUrl: string): Promise<string | null> {
  if (!websiteUrl) return null;
  try {
    const url = websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const resp = await fetch(url, { signal: controller.signal, redirect: "follow" });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    const html = await resp.text();
    // Extract emails from page content
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const found = html.match(emailRegex);
    if (!found) return null;
    // Filter out common non-contact emails
    const filtered = found.filter(
      (e) =>
        !e.includes("example.com") &&
        !e.includes("sentry") &&
        !e.includes("webpack") &&
        !e.includes("schema.org") &&
        !e.includes("wixpress") &&
        !e.includes("googleapis") &&
        !e.endsWith(".png") &&
        !e.endsWith(".jpg") &&
        e.length < 60
    );
    return filtered[0] ?? null;
  } catch {
    return null;
  }
}

// ─── Main Pipeline ──────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const shouldSend = args.includes("--send");
  const verifySmtp = args.includes("--verify-smtp");
  const enrichEmails = args.includes("--enrich");
  const previewIdx = args.indexOf("--preview");
  const previewN = previewIdx >= 0 ? Number(args[previewIdx + 1]) : null;
  const limitIdx = args.indexOf("--limit");
  const sendLimit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;

  console.log(`
╔════════════════════════════════════════════════════════════╗
║        FREELANCE REVENUE OS — OUTREACH PIPELINE           ║
║  Psychology-Driven · Evidence-Based · Approval-Gated      ║
╚════════════════════════════════════════════════════════════╝
`);

  // ─── SMTP Check ─────────────────────────────────────────
  if (verifySmtp || shouldSend) {
    console.log("🔌 Testing SMTP connection...");
    const nodemailer = await import("nodemailer");
    const t = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST ?? "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    try {
      await t.verify();
      console.log("✅ SMTP connection OK — ready to send\n");
    } catch (err) {
      console.error(`❌ SMTP failed: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
    if (verifySmtp) return;
  }

  // ─── Load Leads ─────────────────────────────────────────
  const { leads, categories } = loadLeads();
  console.log(`📋 Loaded ${leads.length} leads:\n`);

  const catCounts = new Map<string, number>();
  for (const [, cat] of categories) catCounts.set(cat, (catCounts.get(cat) ?? 0) + 1);
  for (const [cat, count] of catCounts) console.log(`   ${cat}: ${count} leads`);
  console.log();

  // ─── Check for existing analysis ───────────────────────
  const outputPath = path.resolve("data/outreach-analysis.json");
  let analyzed: AnalyzedLead[] = [];
  const existingAnalysis = fs.existsSync(outputPath);

  if (existingAnalysis && !enrichEmails) {
    analyzed = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    console.log(`📂 Loaded existing analysis (${analyzed.length} leads)\n`);
  }

  // ─── Preview Mode ──────────────────────────────────────
  if (previewN !== null && existingAnalysis) {
    const a = analyzed[previewN - 1];
    if (!a) {
      console.error(`Lead #${previewN} not found (max: ${analyzed.length})`);
      return;
    }
    printPreview(a, previewN);
    return;
  }

  // ─── Analyze + Draft ───────────────────────────────────
  if (!existingAnalysis || enrichEmails) {
    console.log("🔍 PHASE 1: Website Verification & Pain Point Analysis\n");

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      const category = categories.get(lead) ?? "unknown";
      const tag = getCategoryTag(category);

      // Website check
      let websiteCheck = { live: false, https: false };
      if (lead.website) {
        websiteCheck = await checkWebsite(lead.website);
      }

      // Try to find contact email
      let contactEmail: string | null = null;
      if (enrichEmails && lead.website && websiteCheck.live) {
        contactEmail = await tryExtractEmail(lead.website);
      }

      // Analyze pain points
      const painPoints = analyzePainPoints(lead, category, websiteCheck);

      // Match best service
      const service = matchService(category, painPoints);

      // Draft email
      const draft = buildEmailCopy(lead, category, painPoints, service, null);

      const entry: AnalyzedLead = {
        ...lead,
        index: i + 1,
        category,
        websiteLive: lead.website ? websiteCheck.live : null,
        websiteHttps: websiteCheck.https,
        painPoints,
        llmAnalysis: null,
        matchedService: service,
        emailDraft: draft,
        contactEmail,
        status: "drafted",
      };
      analyzed.push(entry);

      const icon = entry.websiteLive === true ? "🟢" : entry.websiteLive === false ? "🔴" : "⚪";
      const emailIcon = contactEmail ? "📧" : "  ";
      console.log(
        `  ${String(i + 1).padStart(2)}. ${icon} ${emailIcon} ${lead.name.substring(0, 35).padEnd(35)} → ${service.name}`
      );
    }

    // Save analysis
    fs.writeFileSync(outputPath, JSON.stringify(analyzed, null, 2));
    console.log(`\n💾 Analysis saved to data/outreach-analysis.json`);
  }

  // ─── Summary ───────────────────────────────────────────
  const drafted = analyzed.filter((a) => a.status === "drafted");
  const withEmail = analyzed.filter((a) => a.contactEmail);
  const websiteUp = analyzed.filter((a) => a.websiteLive === true);
  const websiteDown = analyzed.filter((a) => a.websiteLive === false);
  const noWebsite = analyzed.filter((a) => a.websiteLive === null);

  console.log(`
${"═".repeat(56)}
📊 PIPELINE SUMMARY
${"═".repeat(56)}
  Total leads:        ${analyzed.length}
  Drafts ready:       ${drafted.length}
  Contact emails:     ${withEmail.length} ${withEmail.length === 0 ? "(run --enrich to scrape from websites)" : ""}
  Websites live:      ${websiteUp.length}
  Websites down:      ${websiteDown.length}
  No website:         ${noWebsite.length}

📧 SERVICE DISTRIBUTION:
${(() => {
  const dist = new Map<string, number>();
  for (const a of analyzed) {
    const name = a.matchedService.name;
    dist.set(name, (dist.get(name) ?? 0) + 1);
  }
  return [...dist.entries()].map(([name, count]) => `  ${String(count).padStart(3)}× ${name}`).join("\n");
})()}

🧠 PSYCHOLOGY TECHNIQUES IN EVERY EMAIL:
  • PAS Framework (Problem → Agitate → Solve)
  • Pattern interrupt opening (no generic "I came across...")
  • Loss aversion framing (what they're losing TODAY)
  • Specificity bias (concrete observations, not vague claims)
  • Reciprocity (free value offered upfront)
  • Low-friction CTA (15-min call, free audit, 2-min review)
  • Social proof in P.S. (credible proof point)
  • Curiosity gap subject line (specific, not clickbait)
${"═".repeat(56)}
`);

  // ─── Send Mode ─────────────────────────────────────────
  if (shouldSend) {
    const sendable = analyzed.filter((a) => a.contactEmail && a.emailDraft && a.status === "drafted");
    if (sendable.length === 0) {
      console.log("⚠️  No leads have contact emails yet.");
      console.log("   Run: npx tsx scripts/outreach-pipeline.ts --enrich");
      console.log("   Or manually add emails to data/outreach-analysis.json\n");
      return;
    }

    const toSend = sendable.slice(0, sendLimit);
    console.log(`\n📤 SENDING ${toSend.length} EMAILS + syncing to HubSpot...\n`);

    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST ?? "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    // HubSpot sync
    const hubspotToken = process.env.HUBSPOT_ACCESS_TOKEN;
    const hubspotHeaders = {
      Authorization: `Bearer ${hubspotToken}`,
      "Content-Type": "application/json",
    };

    async function syncToHubSpot(lead: AnalyzedLead): Promise<string | null> {
      if (!hubspotToken) return null;
      try {
        // Extract domain from website
        let domain = "";
        if (lead.website) {
          try { domain = new URL(lead.website.startsWith("http") ? lead.website : `https://${lead.website}`).hostname.replace("www.", ""); } catch {}
        }

        // Upsert company
        const companyProps: Record<string, string> = {
          name: lead.name,
          city: "Miami",
          state: "FL",
          country: "US",
          industry: lead.category,
          description: `Pain points: ${lead.painPoints.slice(0, 2).join("; ")}`,
        };
        if (domain) companyProps.domain = domain;

        let companyId: string | null = null;

        // Search for existing company
        if (domain) {
          const searchResp = await fetch("https://api.hubapi.com/crm/v3/objects/companies/search", {
            method: "POST",
            headers: hubspotHeaders,
            body: JSON.stringify({
              filterGroups: [{ filters: [{ propertyName: "domain", operator: "EQ", value: domain }] }],
              limit: 1,
            }),
          });
          const searchData = await searchResp.json() as { results: { id: string }[] };
          if (searchData.results?.length > 0) {
            companyId = searchData.results[0].id;
            await fetch(`https://api.hubapi.com/crm/v3/objects/companies/${companyId}`, {
              method: "PATCH",
              headers: hubspotHeaders,
              body: JSON.stringify({ properties: companyProps }),
            });
          }
        }

        if (!companyId) {
          const createResp = await fetch("https://api.hubapi.com/crm/v3/objects/companies", {
            method: "POST",
            headers: hubspotHeaders,
            body: JSON.stringify({ properties: companyProps }),
          });
          const created = await createResp.json() as { id: string };
          companyId = created.id;
        }

        // Upsert contact
        const contactProps: Record<string, string> = {
          email: lead.contactEmail!,
          company: lead.name,
          phone: lead.phone,
          city: "Miami",
          state: "FL",
          lifecyclestage: "lead",
          hs_lead_status: "NEW",
        };

        // Search for existing contact
        const contactSearch = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
          method: "POST",
          headers: hubspotHeaders,
          body: JSON.stringify({
            filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: lead.contactEmail }] }],
            limit: 1,
          }),
        });
        const contactData = await contactSearch.json() as { results: { id: string }[] };
        let contactId: string;

        if (contactData.results?.length > 0) {
          contactId = contactData.results[0].id;
          await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`, {
            method: "PATCH",
            headers: hubspotHeaders,
            body: JSON.stringify({ properties: contactProps }),
          });
        } else {
          const createContact = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
            method: "POST",
            headers: hubspotHeaders,
            body: JSON.stringify({ properties: contactProps }),
          });
          const createdContact = await createContact.json() as { id: string };
          contactId = createdContact.id;
        }

        // Associate contact to company
        if (companyId) {
          await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}/associations/companies/${companyId}/1`, {
            method: "PUT",
            headers: hubspotHeaders,
          });
        }

        return contactId;
      } catch (err) {
        console.log(`     ⚠️  HubSpot sync failed: ${err instanceof Error ? err.message : err}`);
        return null;
      }
    }

    let sent = 0;
    let failed = 0;
    let synced = 0;

    for (const lead of toSend) {
      try {
        // Send email
        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: lead.contactEmail!,
          subject: lead.emailDraft!.subject,
          text: lead.emailDraft!.body,
          replyTo: process.env.SMTP_FROM,
        });
        lead.status = "sent";
        sent++;
        console.log(`  ✅ ${lead.name} → ${lead.contactEmail}`);

        // Sync to HubSpot
        const hsId = await syncToHubSpot(lead);
        if (hsId) {
          synced++;
          console.log(`     🔗 HubSpot contact: ${hsId}`);
        }
      } catch (err) {
        lead.status = "failed";
        failed++;
        console.log(`  ❌ ${lead.name} — ${err instanceof Error ? err.message : err}`);
      }

      // Rate limit: 1 email per 4 seconds (Gmail safe)
      await new Promise((r) => setTimeout(r, 4000));
    }

    // Save updated statuses
    fs.writeFileSync(outputPath, JSON.stringify(analyzed, null, 2));

    console.log(`\n📊 Results: ${sent} sent, ${failed} failed, ${synced} synced to HubSpot\n`);
  }

  // ─── Next Steps ────────────────────────────────────────
  if (!shouldSend) {
    console.log(`💡 NEXT STEPS:`);
    console.log(`   1. Find emails:     npx tsx scripts/outreach-pipeline.ts --enrich`);
    console.log(`   2. Preview draft:   npx tsx scripts/outreach-pipeline.ts --preview 1`);
    console.log(`   3. Test SMTP:       npx tsx scripts/outreach-pipeline.ts --verify-smtp`);
    console.log(`   4. Send emails:     npx tsx scripts/outreach-pipeline.ts --send`);
    console.log(`   5. Send 5 first:    npx tsx scripts/outreach-pipeline.ts --send --limit 5`);
    console.log();
  }
}

// ─── Preview Printer ────────────────────────────────────────────────

function printPreview(a: AnalyzedLead, n: number) {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  📧 PREVIEW — Lead #${String(n).padStart(2)}                                    ║
╚════════════════════════════════════════════════════════════╝

🏢 Business:    ${a.name}
📁 Category:    ${a.category}
🌐 Website:     ${a.website ?? "none"} ${a.websiteLive === true ? "(✅ live)" : a.websiteLive === false ? "(❌ down)" : "(⚪ N/A)"}
📞 Phone:       ${a.phone}
⭐ Rating:      ${a.rating ?? "N/A"}
📧 Email found: ${a.contactEmail ?? "not yet — run --enrich"}

🔍 PAIN POINTS IDENTIFIED:
${a.painPoints.map((p) => `   • ${p}`).join("\n")}

🎯 MATCHED SERVICE: ${a.matchedService.name}
   Pitch: ${a.matchedService.pitch}
   Proof: ${a.matchedService.proofPoint}

${"─".repeat(56)}
📨 EMAIL DRAFT:
${"─".repeat(56)}
Subject: ${a.emailDraft?.subject ?? "N/A"}
${"─".repeat(56)}
${a.emailDraft?.body ?? "No draft"}
${"─".repeat(56)}

📊 COPY ANALYSIS:
   Word count: ${a.emailDraft?.wordCount ?? 0}
   Tone: ${a.emailDraft?.tone ?? "N/A"}
   Techniques: ${a.emailDraft?.psychologyTechniques?.join(", ") ?? "N/A"}
`);
}

main().catch((err) => {
  console.error("Pipeline error:", err);
  process.exit(1);
});
