#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const RESEARCH = path.join(ROOT, "data", "research");

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq > 0) env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return env;
}

const ENV = loadEnv();
const KEY = ENV.ANTHROPIC_API_KEY;
const MODEL = ENV.AUDIT_MODEL || ENV.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

const BANNED = [
  "i hope this email finds you well", "i came across", "hope you're doing well",
  "touching base", "circle back", "synergy", "leverage", "best-in-class",
  "cutting-edge", "game-changer", "revolutioniz", "unlock the potential", "seamless",
  "empower", "supercharge", "guarantee", "act now", "limited time", "free consultation",
  "click here", "p.s.", "hope this helps", "let me know if", "i'd love to",
  "i'm reaching out", "reaching out", "quick question", "hacked", "defaced", "compromised",
];

const CTA_BANNED = [
  "quick call", "15-minute", "15 minute", "15 min", "hop on a call", "schedule a call",
  "book a call", "quick chat", "jump on a call", "chat this week", "coffee",
];

const shards = fs
  .readdirSync(RESEARCH)
  .filter((f) => /^craft_(d|a)\d+\.json$/.test(f))
  .map((f) => path.join(RESEARCH, f));

const merged = new Map();
for (const file of shards) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const r of data.results ?? []) {
    const key = r.domain ?? r.name;
    merged.set(key, r);
  }
}

const PLACEHOLDER = /@(company|example|domain|yourdomain|test|mail|email|site|website)\./i;

function validate(r) {
  const problems = [];
  const published = new Set((r.published_emails_found ?? []).map((e) => e.toLowerCase()));
  let recipient = r.recipient_email ? String(r.recipient_email).toLowerCase().trim() : null;

  if (recipient && !published.has(recipient)) {
    problems.push(`recipient not in published set (${recipient})`);
    recipient = null;
  }
  if (recipient && PLACEHOLDER.test(recipient)) {
    problems.push(`placeholder address (${recipient})`);
    recipient = null;
  }
  if (!recipient) problems.push("no verified published recipient email");

  const subject = (r.email?.subject ?? "").trim();
  const body = (r.email?.body ?? "").trim();
  if (!subject) problems.push("empty subject");
  if (subject !== subject.toLowerCase()) problems.push("subject not lowercase");
  const sw = subject.split(/\s+/).filter(Boolean);
  if (sw.length < 2 || sw.length > 5) problems.push(`subject word count ${sw.length}`);
  const bw = body.split(/\s+/).filter(Boolean).length;
  if (bw < 55 || bw > 190) problems.push(`body word count ${bw}`);
  const lower = body.toLowerCase();
  for (const p of BANNED) if (lower.includes(p)) problems.push(`banned phrase: ${p}`);
  for (const p of CTA_BANNED) if (lower.includes(p)) problems.push(`meeting CTA: ${p}`);
  if (/\d{1,3}\s?%/.test(body)) problems.push("percentage claim (unverifiable stat)");
  if (/\b\d{2,}\s?(percent|x)\b/i.test(body)) problems.push("numeric performance claim");
  if (!/weed kerwing edouard/i.test(body)) problems.push("missing signature");
  if (/<[a-z/][^>]*>/i.test(body)) problems.push("html detected");
  if ((body.match(/https?:\/\//g) ?? []).length > 0) problems.push("link detected");

  return { problems, recipient };
}

function tokens(s) {
  return new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2));
}

function overlap(a, b) {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.min(ta.size, tb.size);
}

async function claude(prompt, maxTokens = 1200, temperature = 0.5) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, temperature, messages: [{ role: "user", content: prompt }] }),
  });
  if (!resp.ok) throw new Error(`anthropic ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const data = await resp.json();
  const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("no JSON");
  return JSON.parse(m[0]);
}

async function rewrite(r, problems) {
  const prompt = `Rewrite this cold email. It is going to a real ${r.niche === "dental" ? "dental practice" : "marketing agency"} in Miami.

The current version FAILED our quality checks for these reasons:
${problems.map((p) => `- ${p}`).join("\n")}

CURRENT SUBJECT: ${r.email?.subject ?? "(none)"}
CURRENT BODY:
"""
${r.email?.body ?? ""}
"""

THEIR AUDIT (ground truth, do not contradict or add new facts):
- what they do: ${r.audit?.what_they_do ?? "n/a"}
- single biggest problem: ${r.audit?.single_biggest_problem ?? "n/a"}
- the answer steps already identified: ${(r.audit?.answer_steps ?? []).join(" | ")}

Rewrite rules:
- Keep the same helpful, answer-first structure. The reader gets the fix, not a sales pitch.
- 70-140 words. Contractions. Short sentences. Plain text.
- NO statistics, percentages, or numbers about results. You cannot verify them. Never claim what "agencies that do this" achieve.
- The closing line must NOT ask for a call, meeting, demo or chat. It must be a low-friction question about the specific problem, answerable with one short word. Example: "Is that something your team could set up this week?" or "Would you want the exact steps?"
- No banned phrases at all, including: ${problems.filter((p) => p.startsWith("banned")).map((p) => p.split(": ")[1]).join(", ") || "the usual AI filler"}.
- Do NOT mention any service, product, price, credential, or what I offer.
- Sign with: Weed Kerwing Edouard
- Subject: keep it 2-5 words, all lowercase, no punctuation, no emoji. Keep the current subject unless it is the problem.

Return ONLY JSON: {"subject": string, "body": string}`;
  const out = await claude(prompt);
  return out;
}

function scrubCta(body) {
  const patterns = [/15[-\s]?minute/i, /book a call/i, /quick call/i, /quick question/i, /schedule a call/i, /hop on a call/i, /jump on a call/i, /15[-\s]?min\b/i, /quick chat/i];
  let lines = body
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  lines = lines.filter((l) => {
    if (/weed kerwing edouard/i.test(l)) return true;
    return !patterns.some((p) => p.test(l));
  });

  const content = lines.filter((l) => !/weed kerwing edouard/i.test(l));
  if (!content.some((l) => l.includes("?"))) {
    const idx = lines.findIndex((l) => /weed kerwing edouard/i.test(l));
    const closer = "Is that something your team could set up this week?";
    if (idx >= 0) lines.splice(idx, 0, closer, "");
    else lines.push(closer, "", "Weed Kerwing Edouard");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

const results = [...merged.values()].sort((a, b) => (a.niche === b.niche ? a.name.localeCompare(b.name) : a.niche.localeCompare(b.niche)));

let purged = 0;
for (const r of results) {
  const { problems, recipient } = validate(r);
  if (r.recipient_email && !recipient) purged++;
  r.recipient_email = recipient;
  r.validation_problems = problems;
  r.status = r.status === "site_unreachable" ? "site_unreachable" : problems.length === 0 ? "ready" : "needs_review";
}

const fixable = results.filter(
  (r) => r.status === "needs_review" && r.recipient_email && r.email && r.validation_problems.some((p) => !p.startsWith("recipient") && !p.startsWith("placeholder") && !p.startsWith("no verified"))
);

console.log(`merged ${results.length} | ready ${results.filter((r) => r.status === "ready").length} | with verified email ${results.filter((r) => r.recipient_email).length} | purgeable recipients ${purged} | to rewrite ${fixable.length}`);

let rewritten = 0;
const usedSubjects = new Set(results.filter((r) => r.status === "ready").map((r) => r.email.subject));

for (const r of fixable) {
  try {
    const fixed = await rewrite(r, r.validation_problems);
    const subject = (fixed.subject ?? r.email.subject).toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 5).join(" ");
    const body = /weed kerwing edouard/i.test(fixed.body) ? fixed.body.trim() : `${fixed.body.trim()}\n\nWeed Kerwing Edouard`;
    r.email = { subject, body, word_count: body.split(/\s+/).filter(Boolean).length };
    const recheck = validate(r);
    r.validation_problems = recheck.problems;
    r.status = recheck.problems.length === 0 ? "ready" : "needs_review";
    rewritten++;
    console.log(`  ${r.status === "ready" ? "fixed" : "still"} ${r.name.slice(0, 34).padEnd(34)} ${recheck.problems.join("; ") || "ok"}`);
  } catch (err) {
    console.log(`  rewrite-fail ${r.name}: ${err.message}`);
  }
  usedSubjects.add(r.email.subject);
}

let dupes = 0;

for (const r of results) {
  if (r.status === "needs_review" || r.status === "ready") {
    if (!r.email) continue;
    const before = r.email.body;
    const scrubbed = scrubCta(before);
    if (scrubbed !== before) {
      r.email = { ...r.email, body: scrubbed, word_count: scrubbed.split(/\s+/).filter(Boolean).length };
      const recheck = validate(r);
      r.validation_problems = recheck.problems;
      r.status = recheck.problems.length === 0 ? "ready" : "needs_review";
    }
  }
}
for (const r of results.filter((x) => x.status === "ready")) {
  const seen = new Set();
  for (const other of results.filter((x) => x.status === "ready")) {
    if (other.email.subject === r.email.subject) {
      if (seen.has(other.email.subject)) {
        r.validation_problems = [...r.validation_problems, "duplicate subject line"];
        r.status = "needs_review";
        dupes++;
        break;
      }
      seen.add(other.email.subject);
    }
  }
}

const stage2 = results.filter(
  (r) => r.status === "needs_review" && r.recipient_email && r.email
);

for (const r of stage2) {
  const problems = r.validation_problems;
  const isShort = problems.some((p) => p.startsWith("body word count"));
  const dupeSubject = problems.some((p) => p === "duplicate subject line");
  try {
    if (isShort) {
      const out = await claude(
        `This cold email is too short after an edit and needs to be rebuilt at proper length.

CURRENT BODY (${(r.email.body.match(/\b\w+\b/g) ?? []).length} words):
"""
${r.email.body}
"""

THEIR SPECIFIC PROBLEM: ${r.audit?.single_biggest_problem ?? "n/a"}
THEIR ANSWER STEPS: ${(r.audit?.answer_steps ?? []).join(" | ")}

Rebuild it at 95-130 words. Keep the same helpful, answer-first structure: name their situation, give the concrete fix, close with ONE low-friction question about whether they can implement it.
- Absolutely no statistics, percentages, or performance numbers.
- Never ask for a call, meeting, demo or chat.
- No pitch, no mention of services, products, or prices.
- Contractions, short sentences, plain text.
- End with the signature line: Weed Kerwing Edouard

Return ONLY JSON: {"body": string}`,
        900,
        0.6
      );
      const body = /weed kerwing edouard/i.test(out.body) ? out.body.trim() : `${out.body.trim()}\n\nWeed Kerwing Edouard`;
      r.email = { ...r.email, body, word_count: body.split(/\s+/).filter(Boolean).length };
    }

    if (dupeSubject || r.status === "needs_review") {
      const others = results.filter((x) => x.email && x.email.subject !== r.email.subject).map((x) => x.email.subject);
      const s = await claude(
        `Write a NEW, unique email subject line for a cold email to this ${r.niche === "dental" ? "dental practice" : "marketing agency"}:
Business: ${r.name}
Their specific problem: ${r.audit?.single_biggest_problem ?? "n/a"}

Rules: 2-5 words, all lowercase, no punctuation, no emoji, no business name, no sales language, complete thought.
It must NOT duplicate or closely resemble any of these already used: ${others.slice(-25).map((x) => `"${x}"`).join(", ")}

Return ONLY JSON: {"subject": string}`,
        80,
        1
      );
      const subject = String(s.subject ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .split(" ")
        .slice(0, 5)
        .join(" ");
      if (subject.split(" ").length >= 2) r.email.subject = subject;
    }

    const recheck = validate(r);
    r.validation_problems = recheck.problems;
    r.status = recheck.problems.length === 0 ? "ready" : "needs_review";
    console.log(`  stage2 ${r.status === "ready" ? "fixed" : "still"} ${r.name.slice(0, 34).padEnd(34)} ${recheck.problems.join("; ") || "ok"}`);
  } catch (err) {
    console.log(`  stage2-fail ${r.name}: ${err.message}`);
  }
}

for (let pass = 0; pass < 3; pass++) {
  let changed = 0;
  for (const r of results) {
    if (!r.email || !r.recipient_email) continue;
    if (r.status === "ready") continue;
    const scrubbed = scrubCta(r.email.body);
    if (scrubbed !== r.email.body) {
      r.email = { ...r.email, body: scrubbed, word_count: scrubbed.split(/\s+/).filter(Boolean).length };
      changed++;
    }
    const recheck = validate(r);
    r.validation_problems = recheck.problems;
    r.status = recheck.problems.length === 0 ? "ready" : "needs_review";
  }
  if (changed === 0) break;
}

for (const r of results.filter((x) => x.status !== "ready" && x.recipient_email && x.email && x.validation_problems.some((p) => p.startsWith("body word count")))) {
  try {
    const out = await claude(
      `Write a fresh cold email, 100-130 words, for this ${r.niche === "dental" ? "dental practice" : "marketing agency"} in Miami.

Business: ${r.name}
Website: ${r.website}
Their single biggest problem: ${r.audit?.single_biggest_problem ?? "n/a"}
The fix that solves it: ${(r.audit?.answer_steps ?? []).join(" | ")}

Structure:
1. One or two sentences naming their specific situation (facts only, from their site).
2. The concrete fix as a short numbered list (2-4 items).
3. One sentence on what changes for them, with no numbers or statistics.
4. One closing question that asks whether they can implement it. It must NOT mention a call, meeting, demo, chat, or any length of time.

Hard rules: no statistics, no percentages, no numbers about results, no pitch, no mention of services or prices, no "15-minute call", contractions, plain text, under 140 words.
End with the signature line: Weed Kerwing Edouard

Return ONLY JSON: {"body": string}`,
      900,
      0.7
    );
    let body = out.body.trim();
    if (!/weed kerwing edouard/i.test(body)) body += "\n\nWeed Kerwing Edouard";
    body = scrubCta(body);
    if (!/weed kerwing edouard/i.test(body)) body += "\n\nWeed Kerwing Edouard";
    r.email = { ...r.email, body, word_count: body.split(/\s+/).filter(Boolean).length };
    const recheck = validate(r);
    r.validation_problems = recheck.problems;
    r.status = recheck.problems.length === 0 ? "ready" : "needs_review";
    console.log(`  stage3 ${r.status} ${r.name}: ${recheck.problems.join("; ") || "ok"}`);
  } catch (err) {
    console.log(`  stage3-fail ${r.name}: ${err.message}`);
  }
}

const out = {
  generated_at: new Date().toISOString(),
  counts: {
    total: results.length,
    dental: results.filter((r) => r.niche === "dental").length,
    agency: results.filter((r) => r.niche === "agency").length,
    ready: results.filter((r) => r.status === "ready").length,
    ready_dental: results.filter((r) => r.status === "ready" && r.niche === "dental").length,
    ready_agency: results.filter((r) => r.status === "ready" && r.niche === "agency").length,
    needs_review: results.filter((r) => r.status === "needs_review").length,
    site_unreachable: results.filter((r) => r.status === "site_unreachable").length,
    phone_only: results.filter((r) => !r.recipient_email && r.phone).length,
    unique_subjects: new Set(results.filter((r) => r.email?.subject).map((r) => r.email.subject)).size,
    rewritten,
    subject_clashes: dupes,
  },
  results,
};

fs.writeFileSync(path.join(RESEARCH, "craft_merged.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out.counts, null, 2));
console.log("wrote data/research/craft_merged.json");
