#!/usr/bin/env node
/**
 * HubSpot Sync — Create contacts + deals from outreach campaign results
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Load .env
const envFile = fs.readFileSync(path.join(ROOT, '.env'), 'utf-8');
const env = {};
for (const line of envFile.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq > 0) env[t.slice(0, eq)] = t.slice(eq + 1);
}

const TOKEN = env.HUBSPOT_ACCESS_TOKEN;
if (!TOKEN) { console.error('Missing HUBSPOT_ACCESS_TOKEN'); process.exit(1); }

const BASE = 'https://api.hubapi.com';
const headers = { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

// Load campaign results
const campaignFile = path.join(ROOT, 'data', 'campaigns', `outreach_2026-09-30.json`);
if (!fs.existsSync(campaignFile)) { console.error('No campaign file found'); process.exit(1); }
const results = JSON.parse(fs.readFileSync(campaignFile, 'utf-8')).filter(r => r.status === 'sent');

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(` HUBSPOT SYNC — ${results.length} contacts to create`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

async function hubspot(endpoint, method = 'GET', body = null) {
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${endpoint}`, opts);
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

// Service pricing estimates by niche
const dealAmounts = {
  'dental': 2500,
  'marketing agencies': 3500,
  'realestate': 2000
};

async function main() {
  let contacts = 0;
  let deals = 0;
  let errors = 0;

  for (const r of results) {
    const nameParts = r.name.replace(/\|.*/, '').trim().split(/\s+/);
    const firstName = nameParts[0] || 'Info';
    const lastName = nameParts.slice(1).join(' ') || r.name.replace(/\|.*/, '').trim();

    // Create contact
    const contactRes = await hubspot('/crm/v3/objects/contacts', 'POST', {
      properties: {
        email: r.email,
        firstname: firstName,
        lastname: lastName,
        company: r.name,
        hs_lead_status: 'NEW',
        lifecyclestage: 'lead'
      }
    });

    if (contactRes.ok) {
      contacts++;
      const contactId = contactRes.data.id;

      // Create deal
      const amount = dealAmounts[r.niche] || 2500;
      const dealRes = await hubspot('/crm/v3/objects/deals', 'POST', {
        properties: {
          dealname: `AI Automation — ${r.name.replace(/\|.*/, '').trim()}`,
          amount: String(amount),
          dealstage: 'appointmentscheduled',
          pipeline: 'default',
          closedate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
        }
      });

      if (dealRes.ok) {
        deals++;
        // Associate deal with contact
        await hubspot(`/crm/v3/objects/deals/${dealRes.data.id}/associations/contacts/${contactId}/deal_to_contact`, 'PUT');
        console.log(`  ✓ ${r.name.slice(0, 40).padEnd(40)} → contact + $${amount} deal`);
      } else {
        console.log(`  ~ ${r.name.slice(0, 40).padEnd(40)} → contact ✓, deal failed: ${dealRes.data?.message?.slice(0, 60) || dealRes.status}`);
      }
    } else if (contactRes.status === 409) {
      // Contact already exists
      console.log(`  ○ ${r.name.slice(0, 40).padEnd(40)} → already exists`);
    } else {
      console.log(`  ✗ ${r.name.slice(0, 40).padEnd(40)} → ${contactRes.data?.message?.slice(0, 60) || contactRes.status}`);
      errors++;
    }

    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(` DONE: ${contacts} contacts | ${deals} deals | ${errors} errors`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

main().catch(console.error);
