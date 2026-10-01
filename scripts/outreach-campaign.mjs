#!/usr/bin/env node
/**
 * Outreach Campaign — Personalized email sending via Resend API
 * Reads verified leads + analysis, generates personalized emails, sends via Resend
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Load .env manually
const envFile = fs.readFileSync(path.join(ROOT, '.env'), 'utf-8');
const env = {};
for (const line of envFile.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq > 0) env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
}

const RESEND_API_KEY = env.RESEND_API_KEY;
const FROM_EMAIL = env.SMTP_FROM || 'weed@edouardautomations.engineering';
const FROM_NAME = 'Weed Edouard | Edouard Automations';

if (!RESEND_API_KEY) {
  console.error('Missing RESEND_API_KEY in .env');
  process.exit(1);
}

// Load verified leads
const leadsFile = path.join(ROOT, 'data', 'leads', 'verified_leads.json');
const allLeads = JSON.parse(fs.readFileSync(leadsFile, 'utf-8'));
const liveLeads = allLeads.filter(l => l.website_live);

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(` OUTREACH CAMPAIGN — ${liveLeads.length} verified leads`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

// Analysis data from WebFetch (compiled)
const analysisDb = {
  // Dental practices — pain points & service matches
  'dental': {
    commonPainPoints: [
      'no online appointment scheduling',
      'no live chat or AI assistant for after-hours inquiries',
      'no automated patient follow-up or review requests',
      'outdated website design',
      'poor SEO visibility'
    ],
    serviceMatch: 'AI Automation + Web Development',
    pitch: 'automated patient booking, AI chat assistant for 24/7 inquiries, and automated review collection',
    value: 'reduce no-shows by 30%, capture after-hours leads, and grow Google reviews on autopilot'
  },
  // Marketing agencies — pain points & service matches
  'marketing agencies': {
    commonPainPoints: [
      'manual campaign optimization and reporting',
      'no AI-powered lead qualification',
      'content creation bottlenecks',
      'limited real-time dashboards for clients',
      'no automated proposal generation'
    ],
    serviceMatch: 'AI Automation + Growth Systems',
    pitch: 'AI-powered campaign optimization, automated client reporting dashboards, and intelligent lead qualification',
    value: 'cut manual reporting time by 70%, auto-qualify leads before they hit your pipeline, and scale content production'
  },
  // Real estate — pain points & service matches
  'realestate': {
    commonPainPoints: [
      'no AI chat for property inquiries',
      'basic property search without smart filters',
      'no virtual tour integration',
      'manual lead nurturing',
      'no automated market reports for leads'
    ],
    serviceMatch: 'AI Automation + Web Development',
    pitch: 'AI property assistant that answers buyer questions 24/7, automated market reports for your leads, and smart property matching',
    value: 'capture 3x more leads after hours, automate follow-ups that feel personal, and close deals faster with AI-powered matching'
  }
};

// Per-lead specific analysis from our WebFetch results
const specificAnalysis = {
  'Community Smiles Dental Clinic': { email: 'info@csmiles.org', pain: 'website security breach + no online booking + no chat', specific: 'Your website at csmiles.org appears to have a security vulnerability that needs immediate attention. Beyond that, I noticed you don\'t have online appointment scheduling' },
  'Ultra Smile Miami': { email: 'info@ultrasmilemiami.com', pain: 'no live chat despite 796 reviews', specific: 'With 796 reviews and a 4.8-star rating, Ultra Smile clearly delivers results. I noticed you don\'t have a live chat or AI assistant to handle the volume of inquiries you must be getting' },
  'ONE Dental Miami': { email: null, pain: 'no booking system, contact buried, limited service info', specific: 'Your site looks clean, but I noticed patients can\'t book appointments online — they have to call. That\'s a big friction point' },
  'HQ Dontics': { email: 'info@hqdontics.com', pain: 'limited before/after gallery, reviews not displayed', specific: 'For a prosthodontics practice doing All-on-X implants, your before/after section only shows 2 examples — that\'s a huge missed opportunity for conversion' },
  'New Dental Care': { email: 'info@newdentalcaremiami.com', pain: 'phone-only booking, no online form', specific: 'I noticed patients can only reach you by calling 305.649.9443. In 2026, most patients expect to book online, especially younger demographics' },
  'Midtown Dental Miami': { email: 'info@midtowndentalmiami.com', pain: 'no chat support despite patient experience focus', specific: 'Your brand emphasizes patient experience, but there\'s no live chat or AI assistant for patients who want quick answers after hours' },
  'Super Dentist Miami': { email: null, pain: 'cluttered booking form, too many CTAs', specific: 'Your booking form has a lot of dropdown options that could overwhelm patients. A simpler flow with an AI assistant to guide them would significantly improve conversion' },
  'Bayfront Dental': { email: null, pain: 'no chat, no email contact visible', specific: 'You use NexHealth for booking (great choice), but there\'s no way for patients to get quick answers without calling. An AI chat assistant would handle those after-hours questions' },
  'Brickell Dental Care': { email: null, pain: 'no chat, email absent', specific: 'For a Brickell location where professionals expect instant digital service, not having a chat widget or AI assistant is leaving leads on the table' },
  'Outsmart Labs': { email: null, pain: 'minimal service detail, no case studies visible, no chatbot', specific: 'As a data-driven marketing agency, you could benefit from AI-powered lead qualification on your own site and automated campaign reporting for clients' },
  'Solved Puzzle': { email: 'info@solvedpuzzle.com', pain: 'manual campaign optimization, no real-time dashboards', specific: 'With $500M+ in attributable sales, your team is clearly elite. I build AI systems that automate the repetitive parts — campaign optimization, client reporting, lead scoring' },
  '1111 Media Group': { email: 'info@1111mediagroup.com', pain: 'standard agency stack, could use AI tools', specific: 'With your SEO, PPC, and social media services, AI-powered content generation and automated reporting could let your team focus on strategy instead of manual work' },
  'Four 19 Digital Agency': { email: 'projects@four19agency.com', pain: 'brand needs AI differentiation', specific: 'I noticed you specialize in food, wellness, and construction brands. I build AI automation systems that would give you a competitive edge — automated campaign reports, AI content generation, intelligent lead routing' },
  'Raging Agency': { email: 'info@ragingagency.com', pain: 'compliance challenges with restricted categories', specific: 'Your niche in restricted-category wellness marketing is brilliant. I build AI systems that could help automate your compliance auditing and creative approval workflows' },
  'Miami Realty Solution Group': { email: 'info@miamirealtysolution.com', pain: 'no chat, search UX needs work, no virtual tours', specific: 'Your property search could be transformed with an AI assistant that helps buyers find exactly what they need through conversation, not just filters' },
  'Avanti Way Realty': { email: 'marceloquiroga@avantiway.com', pain: 'agent marketing headaches, compliance, analytics overwhelm', specific: 'I build AI systems that solve exactly what your agents struggle with — automated marketing campaigns, compliance checks, and clear analytics dashboards' },
  'CondoBlackBook': { email: 'contact@CondoBlackBook.com', pain: 'no testimonials, static floor plans, search UX', specific: 'For a luxury Miami condo platform handling $800K-$100M properties, an AI concierge could transform how high-net-worth buyers interact with your listings' },
};

// Generate personalized email for each lead
function generateEmail(lead) {
  const niche = lead.niche || 'dental';
  const nicheKey = niche.includes('marketing') ? 'marketing agencies' : niche.includes('real') ? 'realestate' : 'dental';
  const nicheData = analysisDb[nicheKey];
  const specific = specificAnalysis[lead.name];

  // Try to find email: specific analysis > lead data > construct from website
  let toEmail = specific?.email || lead.email;
  if (!toEmail && lead.website) {
    // Extract domain from website
    try {
      const domain = new URL(lead.website).hostname.replace('www.', '');
      toEmail = `info@${domain}`;
    } catch { /* skip */ }
  }

  const firstName = lead.name.split(/[\s|,&-]/)[0].trim();
  const specificHook = specific?.specific || `I took a look at your online presence and noticed some areas where ${nicheData.pitch} could make a real difference`;

  const subject = nicheKey === 'dental'
    ? `Quick idea for ${lead.name.replace(/\|.*/, '').trim()} — AI that books patients 24/7`
    : nicheKey === 'marketing agencies'
    ? `${lead.name.replace(/\|.*/, '').trim()} — AI systems that scale your agency`
    : `AI assistant for ${lead.name.replace(/\|.*/, '').trim()} — capture leads 24/7`;

  const body = `Hi,

I'm Weed Edouard — I build AI automation systems for ${nicheKey === 'dental' ? 'dental practices' : nicheKey === 'marketing agencies' ? 'marketing agencies' : 'real estate firms'} in Miami.

${specificHook}.

Specifically, I can help with:

• ${nicheData.pitch}

The result? ${nicheData.value}.

This isn't a template pitch — I actually reviewed your site and identified specific opportunities. Would you be open to a 15-minute call this week to walk through what I found?

No pressure, no hard sell — just showing you what's possible.

Best,
Weed Edouard
Edouard Automations
weed@edouardautomations.engineering
`;

  return { to: toEmail, subject, body, lead };
}

// Send via Resend API
async function sendEmail({ to, subject, body }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject,
      text: body
    })
  });

  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

// Main execution
async function main() {
  const results = [];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const lead of liveLeads) {
    const email = generateEmail(lead);

    if (!email.to) {
      console.log(`  ⊘ ${lead.name.slice(0, 40)} — no email found, skipping`);
      skipped++;
      continue;
    }

    // Skip leads that are just calendly links (not real business sites)
    if (email.to.includes('calendly.com')) {
      console.log(`  ⊘ ${lead.name.slice(0, 40)} — calendly link, skipping`);
      skipped++;
      continue;
    }

    try {
      const result = await sendEmail(email);
      if (result.ok) {
        console.log(`  ✓ ${lead.name.slice(0, 40).padEnd(40)} → ${email.to}`);
        sent++;
        results.push({
          name: lead.name,
          email: email.to,
          subject: email.subject,
          status: 'sent',
          resend_id: result.data.id,
          niche: lead.niche,
          sent_at: new Date().toISOString()
        });
      } else {
        console.log(`  ✗ ${lead.name.slice(0, 40).padEnd(40)} → ${result.data?.message || result.status}`);
        failed++;
        results.push({
          name: lead.name,
          email: email.to,
          status: 'failed',
          error: result.data?.message || `HTTP ${result.status}`,
          niche: lead.niche
        });
      }
    } catch (err) {
      console.log(`  ✗ ${lead.name.slice(0, 40).padEnd(40)} → ${err.message}`);
      failed++;
      results.push({ name: lead.name, email: email.to, status: 'error', error: err.message });
    }

    // Rate limit: 2 emails/second (Resend free tier)
    await new Promise(r => setTimeout(r, 600));
  }

  // Save results
  const outPath = path.join(ROOT, 'data', 'campaigns', `outreach_${new Date().toISOString().slice(0,10)}.json`);
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(` RESULTS: ${sent} sent | ${failed} failed | ${skipped} skipped`);
  console.log(` Saved to: ${path.relative(ROOT, outPath)}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

main().catch(console.error);
