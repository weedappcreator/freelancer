#!/usr/bin/env npx tsx
/**
 * REPLY MONITOR — Checks Gmail for replies to outreach emails
 *
 * Connects via IMAP, finds replies from sent leads, classifies them,
 * and updates HubSpot deal stages automatically.
 *
 * Usage:
 *   npx tsx scripts/reply-monitor.ts           # Check once
 *   npx tsx scripts/reply-monitor.ts --watch    # Check every 5 minutes
 */

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { ImapFlow } from "imapflow";

dotenv.config();

// ─── Types ──────────────────────────────────────────────────────────

interface AnalyzedLead {
  name: string;
  contactEmail: string | null;
  matchedService: { id: string; name: string };
  status: string;
  phone: string;
  website: string | null;
  category: string;
}

interface Reply {
  from: string;
  subject: string;
  body: string;
  date: Date;
  leadName: string;
  classification: string;
  action: string;
}

// ─── HubSpot Helpers ────────────────────────────────────────────────

const HUBSPOT_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;
const HS_HEADERS = {
  Authorization: `Bearer ${HUBSPOT_TOKEN}`,
  "Content-Type": "application/json",
};
const HS_API = "https://api.hubapi.com";

async function findContactByEmail(email: string): Promise<string | null> {
  if (!HUBSPOT_TOKEN) return null;
  try {
    const resp = await fetch(`${HS_API}/crm/v3/objects/contacts/search`, {
      method: "POST",
      headers: HS_HEADERS,
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
        limit: 1,
      }),
    });
    const data = (await resp.json()) as { results: { id: string }[] };
    return data.results?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function findDealByContact(contactId: string): Promise<string | null> {
  if (!HUBSPOT_TOKEN) return null;
  try {
    const resp = await fetch(
      `${HS_API}/crm/v3/objects/contacts/${contactId}/associations/deals`,
      { headers: HS_HEADERS }
    );
    const data = (await resp.json()) as { results: { id: string }[] };
    return data.results?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function updateDealStage(dealId: string, stage: string): Promise<boolean> {
  if (!HUBSPOT_TOKEN) return false;
  try {
    await fetch(`${HS_API}/crm/v3/objects/deals/${dealId}`, {
      method: "PATCH",
      headers: HS_HEADERS,
      body: JSON.stringify({ properties: { dealstage: stage } }),
    });
    return true;
  } catch {
    return false;
  }
}

async function updateContactStatus(contactId: string, status: string): Promise<void> {
  if (!HUBSPOT_TOKEN) return;
  try {
    await fetch(`${HS_API}/crm/v3/objects/contacts/${contactId}`, {
      method: "PATCH",
      headers: HS_HEADERS,
      body: JSON.stringify({ properties: { hs_lead_status: status } }),
    });
  } catch {}
}

// ─── Reply Classification (rule-based, no LLM needed) ───────────────

function classifyReply(subject: string, body: string): { classification: string; action: string; dealStage: string; leadStatus: string } {
  const text = (subject + " " + body).toLowerCase();

  // Out of office
  if (text.includes("out of office") || text.includes("ooo") || text.includes("away from") || text.includes("auto-reply") || text.includes("automatic reply") || text.includes("currently out")) {
    return { classification: "OUT_OF_OFFICE", action: "Wait and follow up later", dealStage: "appointmentscheduled", leadStatus: "IN_PROGRESS" };
  }

  // Bounce / delivery failure
  if (text.includes("delivery") && (text.includes("failed") || text.includes("failure")) || text.includes("undeliverable") || text.includes("mailer-daemon") || text.includes("mail delivery")) {
    return { classification: "BOUNCE", action: "Remove from sequence — invalid email", dealStage: "closedlost", leadStatus: "UNQUALIFIED" };
  }

  // Unsubscribe / opt out
  if (text.includes("unsubscribe") || text.includes("remove me") || text.includes("stop emailing") || text.includes("don't contact") || text.includes("do not contact") || text.includes("opt out") || text.includes("not interested please")) {
    return { classification: "OPT_OUT", action: "Remove immediately — respect opt-out", dealStage: "closedlost", leadStatus: "UNQUALIFIED" };
  }

  // Negative
  if (text.includes("not interested") || text.includes("no thank") || text.includes("no thanks") || text.includes("pass on this") || text.includes("we're good") || text.includes("we're all set") || text.includes("don't need")) {
    return { classification: "NOT_INTERESTED", action: "Close deal, add to nurture for 60 days", dealStage: "closedlost", leadStatus: "UNQUALIFIED" };
  }

  // Meeting / call request — HIGH VALUE
  if (text.includes("schedule") || text.includes("calendar") || text.includes("book a") || text.includes("set up a call") || text.includes("let's talk") || text.includes("let's chat") || text.includes("available for a call") || text.includes("when are you free") || text.includes("what time") || text.includes("15 minute")) {
    return { classification: "MEETING_REQUEST", action: "🔥 BOOK THE CALL — respond within 1 hour!", dealStage: "qualifiedtobuy", leadStatus: "OPEN" };
  }

  // Positive interest
  if (text.includes("interested") || text.includes("tell me more") || text.includes("sounds good") || text.includes("love to") || text.includes("would like to") || text.includes("send me") || text.includes("more info") || text.includes("learn more") || text.includes("how much") || text.includes("pricing") || text.includes("what would it cost") || text.includes("proposal")) {
    return { classification: "INTERESTED", action: "🔥 HOT LEAD — respond with details within 1 hour!", dealStage: "qualifiedtobuy", leadStatus: "OPEN" };
  }

  // Question
  if (text.includes("?") || text.includes("how does") || text.includes("what do you") || text.includes("can you") || text.includes("do you") || text.includes("who are")) {
    return { classification: "QUESTION", action: "Answer their question — keep conversation going", dealStage: "appointmentscheduled", leadStatus: "OPEN" };
  }

  // Referral
  if (text.includes("talk to") || text.includes("reach out to") || text.includes("contact my") || text.includes("forward") || text.includes("cc'd") || text.includes("loop in")) {
    return { classification: "REFERRAL", action: "Thank them, start new sequence with referred person", dealStage: "appointmentscheduled", leadStatus: "OPEN" };
  }

  // Default — needs manual review
  return { classification: "UNKNOWN", action: "Review manually", dealStage: "appointmentscheduled", leadStatus: "IN_PROGRESS" };
}

// ─── IMAP Gmail Checker ─────────────────────────────────────────────

async function checkReplies(): Promise<Reply[]> {
  const analysisPath = path.resolve("data/outreach-analysis.json");
  if (!fs.existsSync(analysisPath)) {
    console.log("⚠️  No outreach analysis found. Run the pipeline first.");
    return [];
  }

  const analyzed: AnalyzedLead[] = JSON.parse(fs.readFileSync(analysisPath, "utf8"));
  const sentEmails = new Set(
    analyzed.filter((a) => a.status === "sent" && a.contactEmail).map((a) => a.contactEmail!.toLowerCase())
  );
  const leadMap = new Map(
    analyzed.filter((a) => a.contactEmail).map((a) => [a.contactEmail!.toLowerCase(), a])
  );

  if (sentEmails.size === 0) {
    console.log("⚠️  No sent emails to monitor.");
    return [];
  }

  // Connect to Gmail IMAP
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER ?? process.env.SMTP_USER!,
      pass: process.env.GMAIL_PASS ?? process.env.SMTP_PASS!,
    },
    logger: false,
  });

  const replies: Reply[] = [];

  try {
    await client.connect();
    console.log("📬 Connected to Gmail IMAP\n");

    // Check INBOX for replies
    const lock = await client.getMailboxLock("INBOX");

    try {
      // Search for recent messages (last 3 days)
      const since = new Date();
      since.setDate(since.getDate() - 3);

      const messages = client.fetch(
        { since, seen: false },
        { envelope: true, source: true }
      );

      for await (const msg of messages) {
        const fromAddr = msg.envelope?.from?.[0]?.address?.toLowerCase();
        if (!fromAddr || !sentEmails.has(fromAddr)) continue;

        const lead = leadMap.get(fromAddr);
        const subject = msg.envelope?.subject ?? "(no subject)";
        const bodyRaw = msg.source?.toString() ?? "";

        // Extract text body (simple extraction)
        let body = bodyRaw;
        const textMatch = bodyRaw.match(/Content-Type: text\/plain[\s\S]*?\r\n\r\n([\s\S]*?)(?:\r\n--|\r\n\r\n)/);
        if (textMatch) body = textMatch[1];
        body = body.substring(0, 500); // Limit for classification

        const { classification, action, dealStage, leadStatus } = classifyReply(subject, body);

        replies.push({
          from: fromAddr,
          subject,
          body: body.substring(0, 200),
          date: msg.envelope?.date ?? new Date(),
          leadName: lead?.name ?? fromAddr,
          classification,
          action,
        });

        // Update HubSpot
        const contactId = await findContactByEmail(fromAddr);
        if (contactId) {
          await updateContactStatus(contactId, leadStatus);
          const dealId = await findDealByContact(contactId);
          if (dealId) {
            await updateDealStage(dealId, dealStage);
          }
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (err) {
    console.error(`❌ IMAP error: ${err instanceof Error ? err.message : err}`);
    // Fallback: try simple check without IMAP if it fails
    console.log("\n💡 If IMAP fails, try enabling 'Less secure app access' or use an App Password\n");
  }

  return replies;
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  const watchMode = process.argv.includes("--watch");
  const intervalMin = 5;

  console.log(`
╔════════════════════════════════════════════════════════════╗
║          REPLY MONITOR — Freelance Revenue OS             ║
╚════════════════════════════════════════════════════════════╝
`);

  async function runCheck() {
    const now = new Date().toLocaleTimeString();
    console.log(`\n🔍 [${now}] Checking for replies...\n`);

    const replies = await checkReplies();

    if (replies.length === 0) {
      console.log("   📭 No new replies yet\n");
    } else {
      console.log(`   📬 ${replies.length} NEW REPLIES:\n`);
      for (const r of replies) {
        const icon =
          r.classification === "INTERESTED" || r.classification === "MEETING_REQUEST"
            ? "🔥"
            : r.classification === "QUESTION" || r.classification === "REFERRAL"
            ? "💬"
            : r.classification === "OPT_OUT" || r.classification === "NOT_INTERESTED"
            ? "🚫"
            : r.classification === "OUT_OF_OFFICE"
            ? "🏖️"
            : r.classification === "BOUNCE"
            ? "❌"
            : "📩";

        console.log(`   ${icon} ${r.leadName}`);
        console.log(`      From: ${r.from}`);
        console.log(`      Subject: ${r.subject}`);
        console.log(`      Classification: ${r.classification}`);
        console.log(`      Action: ${r.action}`);
        console.log();
      }

      // Save replies log
      const logPath = path.resolve("data/replies-log.json");
      let existingLog: Reply[] = [];
      if (fs.existsSync(logPath)) {
        existingLog = JSON.parse(fs.readFileSync(logPath, "utf8"));
      }
      existingLog.push(...replies);
      fs.writeFileSync(logPath, JSON.stringify(existingLog, null, 2));
      console.log(`   💾 Logged to data/replies-log.json\n`);
    }
  }

  // Run first check
  await runCheck();

  // Watch mode — loop every 5 minutes
  if (watchMode) {
    console.log(`⏰ Watch mode — checking every ${intervalMin} minutes. Ctrl+C to stop.\n`);
    setInterval(runCheck, intervalMin * 60 * 1000);
  }
}

main().catch((err) => {
  console.error("Monitor error:", err);
  process.exit(1);
});
