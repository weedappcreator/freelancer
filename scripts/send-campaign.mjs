#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";

const ROOT = path.resolve(import.meta.dirname, "..");

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
const args = process.argv.slice(2);
const arg = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const has = (n) => args.includes(`--${n}`);

const PROVIDER = arg("provider", "auto");
const LIMIT = Number(arg("limit", "0"));
const DRY_RUN = has("dry-run");
const GAP_MS = Number(arg("gap", "8000"));
const SOURCE = path.join(ROOT, arg("input", "data/research/craft_merged.json"));

const RESEND_KEY = ENV.RESEND_API_KEY;
const RESEND_FROM = ENV.SMTP_FROM || "weed@edouardautomations.engineering";
const GMAIL_USER = ENV.GMAIL_USER;
const GMAIL_PASS = ENV.GMAIL_PASS;

let gmailTransport = null;
function getGmail() {
  if (gmailTransport) return gmailTransport;
  if (!GMAIL_USER || !GMAIL_PASS) throw new Error("GMAIL_USER / GMAIL_PASS not set in .env");
  gmailTransport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: GMAIL_USER, pass: GMAIL_PASS },
  });
  return gmailTransport;
}

async function sendViaResend(to, subject, text) {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `Weed Kerwing Edouard <${RESEND_FROM}>`,
      to: [to],
      subject,
      text,
      reply_to: RESEND_FROM,
    }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.id) {
    const err = new Error(data.message || `resend http ${resp.status}`);
    err.status = resp.status;
    throw err;
  }
  return { id: data.id, provider: "resend" };
}

async function sendViaGmail(to, subject, text) {
  const info = await getGmail().sendMail({
    from: `Weed Kerwing Edouard <${GMAIL_USER}>`,
    to,
    subject,
    text,
    replyTo: GMAIL_USER,
  });
  return { id: info.messageId, provider: "gmail" };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const data = JSON.parse(fs.readFileSync(SOURCE, "utf8"));
  let queue = data.results.filter((r) => r.status === "ready" && r.recipient_email);

  const niche = arg("niche", "all");
  if (niche !== "all") queue = queue.filter((r) => r.niche === niche);
  if (LIMIT) queue = queue.slice(0, LIMIT);

  const ownDomains = new Set(
    ["edouardautomations.engineering", "gmail.com"].map((d) => d.toLowerCase())
  );
  queue = queue.filter((r) => !ownDomains.has(String(r.recipient_email).split("@")[1] ?? ""));

  const seenRecipients = new Set();
  queue = queue.filter((r) => {
    const key = r.recipient_email.toLowerCase();
    if (seenRecipients.has(key)) return false;
    seenRecipients.add(key);
    return true;
  });

  console.log(`queue: ${queue.length} ready emails | provider=${PROVIDER}${DRY_RUN ? " | DRY RUN" : ""}`);
  console.log(`  dental ${queue.filter((r) => r.niche === "dental").length} | agency ${queue.filter((r) => r.niche === "agency").length}`);
  console.log(`  unique subjects: ${new Set(queue.map((r) => r.email.subject)).size}`);

  if (DRY_RUN) {
    for (const r of queue.slice(0, 5)) {
      console.log(`\n--- ${r.name} <${r.recipient_email}> (${r.email_type})`);
      console.log(`subject: ${r.email.subject}`);
      console.log(r.email.body);
    }
    return;
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const outPath = path.join(ROOT, "data", "campaigns", `send_${stamp}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const log = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, "utf8")) : [];

  const alreadySent = new Set(log.filter((x) => x.status === "sent").map((x) => x.to.toLowerCase()));
  if (alreadySent.size) {
    const before = queue.length;
    queue = queue.filter((r) => !alreadySent.has(r.recipient_email.toLowerCase()));
    console.log(`skipping ${before - queue.length} already sent today | remaining ${queue.length}`);
  }

  let active = PROVIDER === "gmail" ? "gmail" : "resend";
  let sent = 0;
  let failed = 0;
  let switched = 0;

  for (const [i, r] of queue.entries()) {
    const record = {
      name: r.name,
      domain: r.domain,
      niche: r.niche,
      to: r.recipient_email,
      email_type: r.email_type,
      subject: r.email.subject,
      word_count: r.email.word_count,
      provider: null,
      status: "pending",
      sent_at: new Date().toISOString(),
    };

    try {
      if (active === "gmail") {
        const res = await sendViaGmail(r.recipient_email, r.email.subject, r.email.body);
        record.provider = res.provider;
        record.id = res.id;
      } else {
        const res = await sendViaResend(r.recipient_email, r.email.subject, r.email.body);
        record.provider = res.provider;
        record.id = res.id;
      }
      record.status = "sent";
      sent++;
      console.log(`[${i + 1}/${queue.length}] sent via ${record.provider}  ${r.name} -> ${r.recipient_email}`);
    } catch (err) {
      const status = err.status ?? 0;
      const quotaish = [402, 403, 429].includes(status) || /quota|limit|rate|forbidden|unauthorized|invalid api key/i.test(err.message);
      if (active === "resend" && quotaish && PROVIDER === "auto" && GMAIL_USER && GMAIL_PASS) {
        active = "gmail";
        switched++;
        console.log(`  ! resend unavailable (${err.message.slice(0, 90)}) -> switching to Gmail`);
        try {
          const res = await sendViaGmail(r.recipient_email, r.email.subject, r.email.body);
          record.provider = res.provider;
          record.id = res.id;
          record.status = "sent";
          sent++;
          console.log(`[${i + 1}/${queue.length}] sent via gmail (after switch)  ${r.name} -> ${r.recipient_email}`);
        } catch (gErr) {
          record.status = "failed";
          record.error = gErr.message;
          failed++;
          console.log(`[${i + 1}/${queue.length}] FAILED ${r.name}: ${gErr.message}`);
        }
      } else {
        record.status = "failed";
        record.error = err.message;
        failed++;
        console.log(`[${i + 1}/${queue.length}] FAILED ${r.name}: ${err.message}`);
      }
    }

    log.push(record);
    fs.writeFileSync(outPath, JSON.stringify(log, null, 2));
    if (i < queue.length - 1) await sleep(GAP_MS);
  }

  console.log(`\n=== sent ${sent} | failed ${failed} | provider switches ${switched} | log ${path.relative(ROOT, outPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
