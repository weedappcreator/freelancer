#!/bin/bash
# DAILY OUTREACH — Discover 50 leads, enrich, draft, send, sync HubSpot
# Runs 2x/day via cron or manual execution
#
# Usage:
#   ./scripts/daily-outreach.sh                    # Run full pipeline
#   ./scripts/daily-outreach.sh --dry-run          # Discover + draft only, no send

set -euo pipefail
cd "$(dirname "$0")/.."

TIMESTAMP=$(date +%Y%m%d_%H%M)
DRY_RUN=""
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN="true"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║     DAILY OUTREACH — $(date '+%Y-%m-%d %H:%M')                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# ─── Verticals to rotate through ─────────────────────────────────
# Each run picks 2-3 queries from this list (rotating)
QUERIES=(
  "chiropractor Miami"
  "law firm Miami"
  "accounting firm Miami"
  "gym fitness center Miami"
  "auto repair shop Miami"
  "restaurant Miami"
  "beauty salon Miami"
  "veterinary clinic Miami"
  "physical therapy Miami"
  "insurance agency Miami"
  "roofing contractor Miami"
  "plumber Miami"
  "electrician Miami"
  "home cleaning service Miami"
  "landscaping company Miami"
  "photography studio Miami"
  "wedding planner Miami"
  "tutoring center Miami"
  "daycare center Miami"
  "pet grooming Miami"
  "yoga studio Miami"
  "med spa Miami"
  "car dealership Miami"
  "moving company Miami"
  "pest control Miami"
  "hvac company Miami"
  "orthodontist Miami"
  "optometrist Miami"
  "dermatologist Miami"
  "plastic surgery Miami"
)

# Pick queries based on day — rotate through list
DAY_NUM=$(date +%j)  # day of year
TOTAL=${#QUERIES[@]}
IDX1=$(( (DAY_NUM * 2) % TOTAL ))
IDX2=$(( (DAY_NUM * 2 + 1) % TOTAL ))
IDX3=$(( (DAY_NUM * 2 + 2) % TOTAL ))

Q1="${QUERIES[$IDX1]}"
Q2="${QUERIES[$IDX2]}"
Q3="${QUERIES[$IDX3]}"

echo "📋 Today's verticals:"
echo "   1. $Q1"
echo "   2. $Q2"
echo "   3. $Q3"
echo ""

# ─── Step 1: Discover leads via Google Maps ──────────────────────
echo "🔍 STEP 1: Discovering leads..."

mkdir -p data/leads/daily

for Q in "$Q1" "$Q2" "$Q3"; do
  SLUG=$(echo "$Q" | tr ' ' '_' | tr '[:upper:]' '[:lower:]')
  OUTFILE="data/leads/daily/${SLUG}_${TIMESTAMP}.json"

  echo "   Searching: $Q (max 17 per query)..."
  python3 scripts/maps_discovery.py \
    --query "$Q" \
    --max 17 \
    --out "$OUTFILE" \
    --hl en 2>&1 | tail -3

  if [ -f "$OUTFILE" ]; then
    COUNT=$(python3 -c "import json; d=json.load(open('$OUTFILE')); print(len(d.get('places',[])))" 2>/dev/null || echo "0")
    echo "   ✅ Found $COUNT leads for '$Q'"
  else
    echo "   ⚠️  No results for '$Q'"
  fi
  echo ""

  # Pause between queries to avoid detection
  sleep 5
done

# ─── Step 2: Run outreach pipeline on new leads ─────────────────
echo "📧 STEP 2: Processing leads through outreach pipeline..."

# Merge daily leads into the main analysis
npx tsx -e "
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

const dailyDir = 'data/leads/daily';
const files = fs.readdirSync(dailyDir).filter(f => f.includes('${TIMESTAMP}') && f.endsWith('.json'));

if (files.length === 0) {
  console.log('No new lead files found');
  process.exit(0);
}

// Load all new leads
let newLeads = [];
for (const file of files) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(dailyDir, file), 'utf8'));
    const category = file.replace(/_${TIMESTAMP}\.json/, '').replace(/_/g, ' ');
    for (const place of (data.places || [])) {
      newLeads.push({ ...place, _category: category, _file: file });
    }
  } catch {}
}
console.log('New leads loaded: ' + newLeads.length);

// Dedupe against existing outreach
const existingPath = 'data/outreach-analysis.json';
let existing = [];
if (fs.existsSync(existingPath)) {
  existing = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
}
const existingPhones = new Set(existing.map(e => e.phone).filter(Boolean));
const existingNames = new Set(existing.map(e => e.name?.toLowerCase()).filter(Boolean));

const deduped = newLeads.filter(l => {
  if (l.phone && existingPhones.has(l.phone)) return false;
  if (l.name && existingNames.has(l.name.toLowerCase())) return false;
  return true;
});
console.log('After dedup: ' + deduped.length + ' new (removed ' + (newLeads.length - deduped.length) + ' duplicates)');

// Check websites & extract emails — PARALLEL (10 at a time)
async function enrichLead(lead) {
  let websiteLive = null, websiteHttps = false, contactEmail = null;
  if (lead.website) {
    try {
      const url = lead.website.startsWith('http') ? lead.website : 'https://' + lead.website;
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 6000);
      const resp = await fetch(url, { signal: ctrl.signal, redirect: 'follow' });
      clearTimeout(to);
      websiteLive = resp.ok || resp.status === 403 || resp.status === 405;
      websiteHttps = url.startsWith('https://');
      if (resp.ok) {
        const html = await resp.text();
        const emails = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
        contactEmail = emails.filter(e => !e.includes('example.com') && !e.includes('sentry') && !e.includes('webpack') && !e.includes('schema.org') && !e.includes('wixpress') && !e.includes('googleapis') && !e.endsWith('.png') && !e.endsWith('.jpg') && e.length < 60)[0] || null;
      }
    } catch { websiteLive = false; }
  }
  return { websiteLive, websiteHttps, contactEmail };
}

async function processLeads() {
  // Parallel enrichment — 10 concurrent
  const BATCH = 10;
  const enriched = new Array(deduped.length);
  for (let b = 0; b < deduped.length; b += BATCH) {
    const batch = deduped.slice(b, b + BATCH);
    const results = await Promise.all(batch.map(enrichLead));
    results.forEach((r, i) => { enriched[b + i] = r; });
  }

  const results = [];
  for (let i = 0; i < deduped.length; i++) {
    const lead = deduped[i];
    const category = lead._category;
    const { websiteLive, websiteHttps, contactEmail } = enriched[i];

    // Pain points
    const pains = [];
    const tag = category.includes('dental') || category.includes('chiro') || category.includes('ortho') || category.includes('derma') || category.includes('optom') || category.includes('vet') || category.includes('plastic') || category.includes('physical') || category.includes('med spa') ? 'health' :
                category.includes('real') || category.includes('roofing') || category.includes('plumb') || category.includes('electric') || category.includes('hvac') || category.includes('landscap') || category.includes('pest') || category.includes('moving') || category.includes('clean') || category.includes('auto') ? 'services' :
                category.includes('law') || category.includes('account') || category.includes('insurance') ? 'professional' :
                category.includes('gym') || category.includes('yoga') || category.includes('beauty') || category.includes('salon') || category.includes('grooming') || category.includes('photo') || category.includes('wedding') || category.includes('tutor') || category.includes('daycare') ? 'lifestyle' : 'business';

    if (!lead.website) pains.push('No website — invisible to online searchers');
    else if (!websiteLive) pains.push('Website is down or unreachable');
    else if (!websiteHttps) pains.push('Website not using HTTPS — browsers show security warnings');

    if (lead.rating && lead.rating < 4.5) pains.push('Rating is ' + lead.rating + '/5 — room to improve with automated review collection');
    if (!lead.hours) pains.push('No business hours on Google Maps');

    if (tag === 'health') {
      pains.push('Appointment booking and patient follow-ups are likely manual');
      pains.push('Missed appointments and no-shows cost revenue without automated reminders');
    } else if (tag === 'services') {
      pains.push('Lead follow-up speed wins the job — most contractors respond too slowly');
      pains.push('Quoting and scheduling probably involves manual back-and-forth');
    } else if (tag === 'professional') {
      pains.push('Client intake and document collection is probably manual and slow');
      pains.push('Follow-up with prospects likely falls through the cracks');
    } else {
      pains.push('Customer booking and scheduling probably requires phone calls');
      pains.push('Social media presence likely inconsistent without automation');
    }

    // Match service
    const painText = pains.join(' ').toLowerCase();
    let serviceId = 'ai-automation';
    if (painText.includes('website') && (painText.includes('down') || painText.includes('no website'))) serviceId = 'website-redesign';
    else if (painText.includes('rating') || painText.includes('review')) serviceId = 'review-reputation';
    else if (painText.includes('follow-up') || painText.includes('pipeline')) serviceId = 'crm-pipeline';
    else if (painText.includes('booking') || painText.includes('appointment')) serviceId = 'website-redesign';
    else if (painText.includes('content') || painText.includes('social')) serviceId = 'social-content';

    const services = {
      'ai-automation': { id: 'ai-automation', name: 'AI Automation & Workflow Systems', pitch: 'I build AI systems that handle repetitive work — scheduling, follow-ups, data entry — so your team focuses on revenue', proofPoint: 'I recently automated client intake and follow-up for a service business, saving 15+ hours per week' },
      'website-redesign': { id: 'website-redesign', name: 'Modern Website + Online Booking', pitch: 'I build fast, mobile-first websites that convert visitors into booked appointments — with online booking that works 24/7', proofPoint: 'The sites I build load in under 2 seconds and include built-in appointment booking' },
      'review-reputation': { id: 'review-reputation', name: 'Automated Review & Reputation System', pitch: 'I set up automated systems to collect 5-star reviews after every appointment and respond to feedback instantly', proofPoint: 'Businesses using automated review collection see 40-60% more reviews within 90 days' },
      'crm-pipeline': { id: 'crm-pipeline', name: 'Smart CRM & Pipeline Automation', pitch: 'I set up intelligent CRM systems that track every lead, automate follow-ups, and make sure no deal falls through', proofPoint: 'Most service businesses lose 30-50% of leads to slow follow-up — automation fixes that day one' },
      'social-content': { id: 'social-content', name: 'AI Content & Social Media Engine', pitch: 'I build AI content engines that produce branded posts and newsletters on autopilot — consistent presence without a full-time creator', proofPoint: 'My AI content systems produce 30+ branded posts per month, each aligned to your voice' },
    };
    const service = services[serviceId] || services['ai-automation'];

    // Draft email
    const subjects = [
      'Quick idea for ' + lead.name,
      'Noticed something about ' + lead.name + ' online',
      lead.name + ' — spotted an easy win',
      'Idea for ' + lead.name + ' (2-min read)',
    ];
    const subject = subjects[Math.floor(Math.random() * subjects.length)];

    const body = 'I was looking at ' + category + ' businesses in the Miami area and ' + lead.name + ' stood out — but I also noticed something that might be costing you customers.\n\nHere\\'s what I noticed:\n' + pains.slice(0, 2).map(p => '• ' + p.charAt(0).toUpperCase() + p.slice(1)).join('\n') + '\n\nEvery day these gaps stay open, potential customers are choosing the business that made it easier to find, book, and trust online. It adds up fast.\n\n' + service.pitch + '.\n\nWould a quick 15-minute call make sense this week? I\\'m happy to walk through exactly what I\\'d do — no strings attached.\n\nP.S. ' + service.proofPoint + '.\n\nBest,\nWeed Kerwing Edouard\nAI Automation & Growth Systems\nedoukerwing@gmail.com';

    results.push({
      ...lead,
      index: existing.length + i + 1,
      category,
      websiteLive,
      websiteHttps,
      painPoints: pains,
      llmAnalysis: null,
      matchedService: service,
      emailDraft: { subject, body, tone: 'consultative, direct', wordCount: body.split(/\s+/).length, psychologyTechniques: ['PAS', 'Loss aversion', 'Reciprocity', 'Low-friction CTA'] },
      contactEmail,
      status: contactEmail ? 'drafted' : 'skipped',
      _category: undefined,
      _file: undefined,
    });

    const icon = websiteLive === true ? '🟢' : websiteLive === false ? '🔴' : '⚪';
    const emailIcon = contactEmail ? '📧' : '  ';
    console.log('  ' + String(i+1).padStart(2) + '. ' + icon + ' ' + emailIcon + ' ' + (lead.name || '').substring(0,35).padEnd(35) + ' → ' + service.name);
  }

  // Merge with existing
  const merged = [...existing, ...results];
  fs.writeFileSync(existingPath, JSON.stringify(merged, null, 2));
  console.log('\n💾 Total leads in pipeline: ' + merged.length);

  // Send emails for leads with contact emails
  const toSend = results.filter(r => r.contactEmail && r.status === 'drafted');
  console.log('📤 Leads with emails to send: ' + toSend.length);

  if (toSend.length > 0 && '${DRY_RUN}' !== 'true') {
    const resendKey = process.env.RESEND_API_KEY;
    const smtpFrom = process.env.SMTP_FROM || 'weed@edouardautomations.engineering';
    const hubspotToken = process.env.HUBSPOT_ACCESS_TOKEN;
    const hsHeaders = { Authorization: 'Bearer ' + hubspotToken, 'Content-Type': 'application/json' };

    let sent = 0, failed = 0, synced = 0;

    // Send in batches of 5 parallel
    for (let b = 0; b < toSend.length; b += 5) {
      const batch = toSend.slice(b, b + 5);
      await Promise.all(batch.map(async (lead) => {
        try {
          // Send via Resend API (fast, no SMTP handshake)
          const emailResp = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + resendKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: 'Weed Kerwing Edouard <' + smtpFrom + '>', to: lead.contactEmail, subject: lead.emailDraft.subject, text: lead.emailDraft.body, reply_to: smtpFrom })
          }).then(r => r.json());
          if (!emailResp.id) throw new Error(emailResp.message || 'Resend failed');
          lead.status = 'sent';
          sent++;
          console.log('  ✅ ' + lead.name + ' → ' + lead.contactEmail);

          // Sync to HubSpot (parallel with next send)
          if (hubspotToken) {
            try {
              let domain = '';
              if (lead.website) try { domain = new URL(lead.website.startsWith('http') ? lead.website : 'https://' + lead.website).hostname.replace('www.', ''); } catch {}
              const compProps = { name: lead.name, city: 'Miami', state: 'FL', country: 'US', industry: lead.category };
              if (domain) compProps.domain = domain;
              const comp = await fetch('https://api.hubapi.com/crm/v3/objects/companies', { method: 'POST', headers: hsHeaders, body: JSON.stringify({ properties: compProps }) }).then(r => r.json());
              const contact = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', { method: 'POST', headers: hsHeaders, body: JSON.stringify({ properties: { email: lead.contactEmail, company: lead.name, phone: lead.phone || '', city: 'Miami', state: 'FL', lifecyclestage: 'lead', hs_lead_status: 'NEW' } }) }).then(r => r.json());
              if (comp.id && contact.id) {
                const amounts = { 'ai-automation': '2500', 'website-redesign': '2500', 'review-reputation': '1200', 'crm-pipeline': '2000', 'social-content': '1500' };
                await Promise.all([
                  fetch('https://api.hubapi.com/crm/v3/objects/contacts/' + contact.id + '/associations/companies/' + comp.id + '/1', { method: 'PUT', headers: hsHeaders }),
                  fetch('https://api.hubapi.com/crm/v3/objects/deals', { method: 'POST', headers: hsHeaders, body: JSON.stringify({ properties: { dealname: lead.name + ' — ' + lead.matchedService.name, pipeline: 'default', dealstage: 'appointmentscheduled', amount: amounts[lead.matchedService.id] || '2000', closedate: new Date(Date.now() + 30*24*60*60*1000).toISOString() } }) }).then(async r => { const d = await r.json(); if (d.id) await Promise.all([fetch('https://api.hubapi.com/crm/v3/objects/deals/' + d.id + '/associations/contacts/' + contact.id + '/3', { method: 'PUT', headers: hsHeaders }), comp.id ? fetch('https://api.hubapi.com/crm/v3/objects/deals/' + d.id + '/associations/companies/' + comp.id + '/5', { method: 'PUT', headers: hsHeaders }) : null].filter(Boolean)); })
                ]);
                synced++;
              }
            } catch (e) { console.log('     ⚠️  HubSpot: ' + (e.message || e)); }
          }
        } catch (err) {
          lead.status = 'failed';
          failed++;
          console.log('  ❌ ' + lead.name + ' — ' + (err.message || err));
        }
      }));
      // 1s pause between batches (Resend allows 2/s, we do 5 per second burst)
      await new Promise(r => setTimeout(r, 1000));
    }

    // Save updated statuses
    const final = [...existing, ...results];
    fs.writeFileSync(existingPath, JSON.stringify(final, null, 2));
    console.log('\n📊 Sent: ' + sent + ' | Failed: ' + failed + ' | HubSpot: ' + synced);
  }
}

processLeads().catch(e => { console.error(e); process.exit(1); });
"

echo ""
echo "✅ Daily outreach batch complete — $(date '+%H:%M')"
echo ""
