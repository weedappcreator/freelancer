#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

function loadEnv() {
  const env = {};
  const file = path.join(ROOT, ".env");
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

const ENV = loadEnv();
const ANTHROPIC_KEY = ENV.ANTHROPIC_API_KEY;
const MODEL = ENV.AUDIT_MODEL || ENV.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const POOL_PATH = path.join(ROOT, getArg("pool", "data/research/v2_pool.json"));
const OUT_PATH = path.join(ROOT, getArg("out", "data/research/craft_shard.json"));
const LIMIT = Number(getArg("limit", "0"));
const NICHE = getArg("niche", "all");
const START = Number(getArg("start", "0"));
const RETRY = args.includes("--retry");

const JUNK_MAIL = [
  "example.com", "sentry", "webpack", "schema.org", "wixpress", "googleapis",
  "sentry.io", "wix.com", "@2x", "yourdomain", "domain.com", "email.com",
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", "@type", "react", "vuejs",
  "godaddy", "cloudflare", "noreply", "no-reply", ".js", "bootstrapcdn",
];

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extractEmails(text) {
  const found = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [];
  const cleaned = found
    .map((e) => e.toLowerCase().replace(/[.,;:)]+$/, ""))
    .filter((e) => e.length >= 6 && e.length < 60)
    .filter((e) => !JUNK_MAIL.some((j) => e.includes(j)))
    .filter((e) => /@(gmail|yahoo|outlook|hotmail|icloud|aol|proton(mail)?|live|msn|me|comcast|verizon|att)\./.test(e) || e.includes("@"));
  return [...new Set(cleaned)];
}

const PERSONAL_LOCALPARTS = new Set([
  "info", "hello", "contact", "office", "admin", "reception", "front", "frontdesk",
  "team", "support", "service", "services", "mail", "email", "enquiries", "inquiries",
  "book", "booking", "appointments", "schedule", "smilemaker", "owner", "marketing",
  "sales", "help", "webmaster", "postmaster", "no-reply", "noreply", "billing",
  "care", "patients", "welcome", "connect", "biz", "business", "inbox", "dm", "hi",
]);

function classifyEmail(email) {
  const [local, domain] = email.split("@");
  if (!PERSONAL_LOCALPARTS.has(local)) return "person";
  if (["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com", "icloud.com", "proton.me", "protonmail.com", "live.com", "msn.com", "me.com", "comcast.net", "verizon.net", "att.net"].includes(domain)) {
    return "personal";
  }
  return "role";
}

async function fetchText(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
    });
    const body = await resp.text();
    return { status: resp.status, ok: resp.ok, finalUrl: resp.url, body };
  } catch (err) {
    return { status: 0, ok: false, finalUrl: url, body: "", error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

async function gatherSite(website) {
  const base = website.startsWith("http") ? website : `https://${website}`;
  const home = await fetchText(base);
  const dossier = {
    homepage_status: home.status,
    homepage_final_url: home.finalUrl,
    homepage_text: "",
    contact_emails: [],
    contact_page_tried: [],
    tech_signals: [],
    booking_or_chat_detected: false,
    forms_detected: 0,
    https: home.finalUrl.startsWith("https://"),
  };

  if (!home.body) return dossier;

  const html = home.body;
  dossier.forms_detected = (html.match(/<form[\s>]/gi) ?? []).length;

  const techPatterns = [
    [/book(ing)?|appointments?|schedule|calendly|setmore|momentis|nexhealth|practicebetter|dentrix|sodat|weave|curve|carestream|patientpop|opencare/i, "online booking / scheduling tooling present"],
    [/tawk\.to|intercom|zendesk|livechat|crisp|tidio|drift|hubspot.*chat|chatwoot|hubspot/i, "chat / CRM / marketing tooling present"],
    [/google-analytics|googletagmanager|gtag\(|facebook\.net|fbevents|hotjar|clarity\.ms/i, "analytics / tracking pixels present"],
    [/next\.js|nuxt|gatsby|webflow|wix|squarespace|shopify|wordpress/i, "site platform fingerprint present"],
    [/schema\.org|application\/ld\+json/i, "structured data present"],
    [/recaptcha|hcaptcha/i, "bot protection present"],
  ];
  for (const [re, label] of techPatterns) {
    if (re.test(html) || re.test(dossier.homepage_text)) dossier.tech_signals.push(label);
  }

  const contactLinks = [...html.matchAll(/href=["']([^"'#]*(contact|kontakt|contacto|reach|get-in-touch|book|appointment|request|schedule|about|team|office)[^"']*)["']/gi)]
    .map((m) => m[1])
    .filter((h) => h.startsWith("http") || h.startsWith("/"))
    .slice(0, 4)
    .map((h) => (h.startsWith("/") ? new URL(h, home.finalUrl).toString() : h));

  const emails = new Set(extractEmails(html));
  for (const m of html.matchAll(/mailto:([^"'?>\s]+)/gi)) emails.add(m[1].toLowerCase());
  for (const m of html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:)?email["'][^>]+content=["']([^"']+@[^"']+)["']/gi)) {
    emails.add(m[1].toLowerCase());
  }

  const commonPaths = ["/contact", "/contact-us", "/contacto", "/kontakt", "/appointments", "/request-appointment"];
  const origin = (() => {
    try {
      return new URL(home.finalUrl).origin;
    } catch {
      return null;
    }
  })();
  if (origin) {
    for (const p of commonPaths) {
      if (!contactLinks.some((l) => l.replace(/\/$/, "").endsWith(p))) contactLinks.push(`${origin}${p}`);
    }
  }

  for (const link of contactLinks.slice(0, 6)) {
    dossier.contact_page_tried.push(link);
    const page = await fetchText(link, 12000);
    if (!page.body) continue;
    if (page.status !== 200 && page.status !== 301 && page.status !== 302) continue;
    for (const e of extractEmails(page.body)) emails.add(e);
    for (const m of page.body.matchAll(/mailto:([^"'?>\s]+)/gi)) emails.add(m[1].toLowerCase());
  }

  dossier.contact_emails = [...emails].slice(0, 6);
  dossier.booking_or_chat_detected = dossier.tech_signals.some((t) => /booking|chat/i.test(t));
  dossier.homepage_text = stripHtml(html).slice(0, 7000);
  dossier.security_markers = findSecurityMarkers(dossier.homepage_text);
  return dossier;
}

const SECURITY_MARKER_RE = [
  /hacked|hacking|defaced|defacement|ransomware|malware|virus|compromised|breach(ed)?\b|unauthorized access|site was hacked|password reset|web shell|exploit|your site has been/i,
];

function findSecurityMarkers(text) {
  const found = [];
  for (const re of SECURITY_MARKER_RE) {
    const m = text.match(re);
    if (m) found.push(m[0]);
  }
  return [...new Set(found)].slice(0, 4);
}

const BANNED = [
  "i hope this email finds you well", "i came across", "i noticed your profile",
  "hope you're doing well", "touching base", "circle back", "synergy", "leverage",
  "best-in-class", "cutting-edge", "game-changer", "revolutioniz", "unlock the potential",
  "seamless", "empower", "supercharge", "10x", "guarantee", "act now", "limited time",
  "free consultation", "click here", "unsubscribe", "p.s.", "hope this helps",
  "let me know if", "i'd love to", "i'm reaching out", "reaching out", "quick question",
  "hacked", "defaced", "compromised", "taken down", "blackhat", "malware", "virus",
];

const SECURITY_CLAIM_PHRASES = new Set(["hacked", "defaced", "compromised", "malware", "virus"]);

const NICHE_NOTE = {
  dental:
    "For a dental practice the commercially costly problems are almost always one of: unanswered new-patient inquiries after hours, no-shows from unconfirmed appointments, unscheduled treatment-plan follow-up (the money is already earned but not booked), slow response to new Google leads, no review-request automation, front-desk phone tag for booking, or a website that cannot capture a patient at all. Pick the one their evidence actually supports.",
  agency:
    "For a small marketing/branding agency the costly problems are almost always one of: manual client reporting eating hours every month, proposals written from scratch, lead follow-up slipping, inconsistent content production, scope creep, slow onboarding, or a website with no conversion path. Pick the one their evidence actually supports.",
};

function buildPrompt(lead, dossier) {
  const facts = [
    `Business name: ${lead.name}`,
    `Niche: ${lead.niche === "dental" ? "dental practice in Miami, FL" : "marketing/branding agency in Miami, FL"}`,
    lead.address ? `Address: ${lead.address}` : null,
    lead.phone ? `Phone: ${lead.phone}` : null,
    `Website: ${lead.website}`,
    `Google rating: ${lead.rating ?? "unknown"}${lead.reviews_count != null ? ` (${lead.reviews_count} reviews)` : ""}`,
    `HTTPS: ${dossier.https}`,
    `Homepage HTTP status: ${dossier.homepage_status}`,
    `Contact forms on homepage: ${dossier.forms_detected}`,
    `Published email addresses found on their own site: ${dossier.contact_emails.length ? dossier.contact_emails.join(", ") : "NONE"}`,
    `Tech signals detected in their HTML: ${dossier.tech_signals.length ? dossier.tech_signals.join("; ") : "none detected"}`,
    `Site readability: ${dossier.homepage_status === 200 && dossier.homepage_text.length > 200 ? "readable (HTTP 200)" : `NOT readable (HTTP ${dossier.homepage_status}) — base the audit only on the Google Maps facts above and set confidence low`}`,
    `Verified security/graffiti text found on their own homepage: ${dossier.security_markers?.length ? dossier.security_markers.join(", ") : "none — do NOT claim the site is hacked, defaced or compromised"}`,
    `Site self-describes as: ${lead.query ?? "n/a"}`,
  ]
    .filter(Boolean)
    .join("\n");

  return `You are a cold-email strategist doing a genuine pre-send audit of ONE real small business, then writing them one email.

TARGET BUSINESS — verified facts (Google Maps listing + their own live website):
${facts}

THEIR OWN WEBSITE TEXT (verbatim, this is the only thing you may cite as evidence):
"""
${dossier.homepage_text || "(homepage text unavailable)"}
"""

HARD RULES
1. Evidence only. Every observation must be traceable to the facts above or to a short verbatim quote from their website text. If you cannot verify it, do not claim it. Never invent metrics, review counts, staff counts, prices, or technologies.
2. Do not assume a problem exists. If their site is genuinely fine in some area, say so.
3. Never claim their site is hacked, defaced, compromised, or taken down — you cannot verify that, and a false security claim destroys trust. Never claim a bug, a vulnerability, or an outage.
4. Treat a non-200 HTTP status or a bot-block as "could not read the site", NOT as a finding. Say the site could not be verified instead of inventing a defect.
5. ${NICHE_NOTE[lead.niche]}
6. NEVER fabricate an email address. The only permitted recipient addresses are the ones listed as "Published email addresses found on their own site". If that line says NONE, set recipient_email to null.

STEP 1 — FULL AUDIT (this is mandatory, be specific)
- what_they_do: 1 sentence, factual.
- verified_observations: 3-5 items, each a concrete fact about their business or site, with a short supporting quote or fact reference. Examples of acceptable specificity: no booking widget present in their HTML; homepage has 1 contact form and no scheduling link; no published email anywhere on the site; 4.6 stars with 300+ reviews; site is not HTTPS; no testimonial or case-study content on the homepage. Reject vague items like "could improve marketing".
- single_biggest_problem: the ONE issue that is most likely costing them money or hours, stated as a consequence for their business, not as a feature gap.
- why_now: why a small business owner would feel this pain this month.

STEP 2 — THE ANSWER (the core of the email)
- diagnosis_title: 2 to 5 words naming their specific situation, all lowercase, no punctuation, no emoji, no business name. This becomes the subject line, so it must be complete and self-contained on its own.
- answer_steps: 2-4 concrete steps that actually solve the problem above, in plain language, no jargon, no product names, no pitch. These are what you will show the reader. Be genuinely useful: e.g. put a booking link on the homepage above the fold, add a form that captures name + phone + requested time, send a confirmation text 2 hours before each appointment, ask for a review by SMS within 2 hours of a completed visit, auto-assign every new inquiry to one person with a 10-minute response SLA.
- the_answer_summary: 1 sentence, the takeaway, written for them not about you.

STEP 3 — THE EMAIL
Write a plain-text email that is genuinely helpful, not a pitch.
- subject: use diagnosis_title EXACTLY. HARD REQUIREMENT: 2 to 5 words, all lowercase, no punctuation, no emoji, no business name, no sales language. Count your words. It must read like an internal note from a colleague, and it must be complete — never end mid-phrase. Every recipient in this batch gets a different subject.
- body rules:
  * Open by naming THEIR specific situation, in one or two sentences. No "I hope this email finds you well", no "my name is", no "I came across".
  * Give the answer immediately: the 2-4 steps above, written conversationally. You are handing them the fix.
  * No selling. No service description. No credentials. No pricing. No "I build AI systems that...". No mention of what you offer beyond a single short clause at most, and only after the value is delivered.
  * One low-friction ask at the end, one line, easy to answer with a short reply. Interest-based, not a meeting request.
  * 70-130 words total. Contractions. Short sentences. Plain text, no HTML, no links, no signature block longer than name + one line.
  * Sign as: Weed Kerwing Edouard
  * Absolutely no: flattery, fake familiarity, hype words, emoji, "just checking in", "quick question", "p.s.", fake Re:/Fwd:.

Return ONLY valid JSON, no markdown fences:
{
  "recipient_email": string|null,
  "email_type": "role"|"person"|"personal"|null,
  "audit": {
    "what_they_do": string,
    "verified_observations": [{"observation": string, "evidence": string}],
    "single_biggest_problem": string,
    "why_now": string,
    "answer_steps": [string],
    "confidence": "high"|"medium"|"low"
  },
  "email": {
    "subject": string,
    "body": string,
    "word_count": number
  }
}`;
}

async function callClaude(prompt) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      temperature: 0.4,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!resp.ok) {
    throw new Error(`anthropic ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  }
  const data = await resp.json();
  const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("");
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("no JSON in model response");
  return JSON.parse(match[0]);
}

function tokens(s) {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function words(s) {
  return s.split(/\s+/).filter(Boolean);
}

function overlap(a, b) {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.min(ta.size, tb.size);
}

async function compressSubject(rawTitle, usedSubjects) {
  const prompt = `Rewrite this email subject line so it is 2 to 5 words, all lowercase, no punctuation, no emoji, no business name, no sales language.

Original: "${rawTitle}"

Rules:
- Keep the specific meaning. Do not end mid-phrase.
- It must be a complete, self-contained thought.
- ${usedSubjects.length ? `It must NOT be similar to these existing subjects (vary your wording): ${usedSubjects.slice(-12).map((s) => `"${s}"`).join(", ")}` : ""}

Return ONLY the new subject line, nothing else.`;
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 60,
        temperature: 0.9,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("");
    const cleaned = text
      .split("\n")[0]
      .replace(/^["'\s]+|["'\s.]+$/g, "")
      .toLowerCase();
    if (!cleaned) return null;
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length < 2 || words.length > 5) return null;
    return words.join(" ");
  } catch {
    return null;
  }
}

function normalizeSubject(subject, fallbackTitle) {
  let s = (subject || fallbackTitle || "")
    .toLowerCase()
    .replace(/["'‘’“”]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = s.split(" ").filter(Boolean);
  if (words.length < 2) {
    const alt = (fallbackTitle || "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
    s = alt || "quick note";
  }
  const finalWords = s.split(" ").filter(Boolean).slice(0, 5);
  return finalWords.join(" ");
}

function ensureSignature(body) {
  const b = (body ?? "").trim();
  if (/weed kerwing edouard/i.test(b)) return b;
  return `${b}\n\nWeed Kerwing Edouard`;
}

function validateEmail(email, recipientEmail, allowSecurity) {
  const problems = [];
  const subject = (email?.subject ?? "").trim();
  const body = (email?.body ?? "").trim();
  if (!subject) problems.push("empty subject");
  if (subject !== subject.toLowerCase()) problems.push("subject not lowercase");
  const words = subject.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5) problems.push(`subject word count ${words.length}`);
  if (/[A-Z]/.test(subject)) problems.push("subject has uppercase");
  const bodyWords = body.split(/\s+/).filter(Boolean).length;
  if (bodyWords < 55 || bodyWords > 165) problems.push(`body word count ${bodyWords}`);
  const lower = body.toLowerCase();
  for (const phrase of BANNED) {
    if (!allowSecurity && SECURITY_CLAIM_PHRASES.has(phrase)) continue;
    if (lower.includes(phrase)) problems.push(`banned phrase: ${phrase}`);
  }
  if (!/weed kerwing edouard/i.test(body)) problems.push("missing signature");
  if (/<[a-z/][^>]*>/i.test(body)) problems.push("html detected");
  if ((body.match(/https?:\/\//g) ?? []).length > 0) problems.push("link detected");
  if (!recipientEmail) problems.push("no published recipient email");
  return problems;
}

async function main() {
  if (!ANTHROPIC_KEY) {
    console.error("ANTHROPIC_API_KEY missing from .env");
    process.exit(1);
  }
  const pool = JSON.parse(fs.readFileSync(POOL_PATH, "utf8"));
  let leads = pool.leads;
  if (NICHE !== "all") leads = leads.filter((l) => l.niche === NICHE);
  leads = leads.slice(START, LIMIT ? START + LIMIT : undefined);

  const existing = fs.existsSync(OUT_PATH)
    ? JSON.parse(fs.readFileSync(OUT_PATH, "utf8"))
    : { generated_at: new Date().toISOString(), results: [] };
  const done = new Set(RETRY ? [] : existing.results.map((r) => r.domain ?? r.name));

  const results = existing.results;
  const byKey = new Map(results.map((r, i) => [r.domain ?? r.name, i]));
  const record = (entry) => {
    const key = entry.domain ?? entry.name;
    const at = byKey.get(key);
    if (at !== undefined) results[at] = entry;
    else {
      byKey.set(key, results.length);
      results.push(entry);
    }
  };
  const subjects = new Set(results.map((r) => r.email?.subject).filter(Boolean));
  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const [i, lead] of leads.entries()) {
    if (done.has(lead.domain ?? lead.name)) {
      skipped++;
      continue;
    }
    if (!lead.website) {
      console.log(`[${i + 1}/${leads.length}] no-website ${lead.name}`);
      skipped++;
      continue;
    }
    let dossier;
    try {
      dossier = await gatherSite(lead.website);
    } catch (err) {
      console.log(`[${i + 1}/${leads.length}] site-fail ${lead.name}: ${err.message}`);
      failed++;
      continue;
    }
    if (dossier.homepage_status === 0 && !dossier.homepage_text) {
      record({
        name: lead.name,
        domain: lead.domain,
        website: lead.website,
        niche: lead.niche,
        phone: lead.phone,
        address: lead.address,
        status: "site_unreachable",
        site_status: dossier.homepage_status,
        site_error: dossier.error ?? null,
      });
      console.log(`[${i + 1}/${leads.length}] unreachable ${lead.name}`);
      skipped++;
      continue;
    }

    let crafted;
    try {
      crafted = await callClaude(buildPrompt(lead, dossier));
    } catch (err) {
      console.log(`[${i + 1}/${leads.length}] llm-fail ${lead.name}: ${err.message}`);
      failed++;
      continue;
    }

    const recipient = crafted.recipient_email ?? null;
    const type = crafted.email_type ?? (recipient ? classifyEmail(recipient) : null);
    const allowSecurity = (dossier.security_markers?.length ?? 0) > 0;
    const rawTitle = (crafted.email?.subject ?? crafted.audit?.diagnosis_title ?? "").trim();
    const rawWords = rawTitle.split(/\s+/).filter(Boolean).length;
    const tooSimilar = [...subjects].some((s) => overlap(s, rawTitle) >= 0.6);

    let subject = normalizeSubject(rawTitle, crafted.audit?.diagnosis_title);
    if (rawWords > 5 || tooSimilar || words(subject) < 2) {
      const compressed = await compressSubject(rawTitle, [...subjects]);
      if (compressed && !subjects.has(compressed)) subject = compressed;
    }
    subjects.add(subject);
    const body = ensureSignature(crafted.email?.body);

    const problems = validateEmail({ subject, body }, recipient, allowSecurity);
    record({
      name: lead.name,
      domain: lead.domain,
      website: lead.website,
      niche: lead.niche,
      phone: lead.phone,
      address: lead.address,
      rating: lead.rating,
      reviews_count: lead.reviews_count,
      status: problems.length === 0 ? "ready" : "needs_review",
      validation_problems: problems,
      recipient_email: recipient,
      email_type: type,
      published_emails_found: dossier.contact_emails,
      site: {
        http_status: dossier.homepage_status,
        final_url: dossier.homepage_final_url,
        https: dossier.https,
        forms: dossier.forms_detected,
        tech_signals: dossier.tech_signals,
        contact_pages_checked: dossier.contact_page_tried.length,
      },
      audit: crafted.audit,
      email: { subject, body, word_count: body.split(/\s+/).filter(Boolean).length },
    });

    if (problems.length === 0) ok++;
    else console.log(`[${i + 1}/${leads.length}] review ${lead.name}: ${problems.join("; ")}`);
    console.log(
      `[${i + 1}/${leads.length}] ${problems.length === 0 ? "ok" : "rev"} ${lead.name.slice(0, 34).padEnd(34)} -> ${recipient ?? "NO-EMAIL"} | ${subject}`
    );

    fs.writeFileSync(OUT_PATH, JSON.stringify({ ...existing, results }, null, 2));
  }

  const ready = results.filter((r) => r.status === "ready").length;
  const withEmail = results.filter((r) => r.recipient_email).length;
  console.log(
    `\nshard done: ${results.length} processed | ready ${ready} | with published email ${withEmail} | new-ok ${ok} | review ${skipped} | llm/site fails ${failed}`
  );
  console.log(`output: ${path.relative(ROOT, OUT_PATH)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
