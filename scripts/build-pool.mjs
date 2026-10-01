#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const RESEARCH = path.join(ROOT, "data", "research");

const DENTAL_FILES = [
  "data/leads/dental_miami.json",
  "data/research/v2_dental_1.json",
  "data/research/v2_dental_2.json",
  "data/research/v2_dental_3.json",
  "data/research/v2_dental_4.json",
];

const AGENCY_FILES = [
  "data/leads/marketing_agencies_miami.json",
  "data/research/maps_miami_agencies.json",
  "data/research/maps_miami.json",
  "data/research/v2_agency_1.json",
  "data/research/v2_agency_2.json",
  "data/research/v2_agency_3.json",
  "data/research/v2_agency_4.json",
  "data/research/v2_agency_5.json",
  "data/research/v2_agency_6.json",
];

const SKIP_HOSTS = [
  "calendly.com", "facebook.com", "instagram.com", "linktr.ee", "v.me",
  "google.com", "yelp.com", "yellowpages.com", "bbb.org", "thumbtack.com",
  "angi.com", "care.com", "zocdoc.com", "practo.com", "nextdoor.com",
  "sites.google.com", "wixsite.com", "business.site", "square.site",
  "godaddy.com", "weebly.com", "jimdosite.com", "wordpress.com", "blogspot.com",
];

function registrableDomain(url) {
  let host;
  try {
    host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname.toLowerCase();
  } catch {
    return null;
  }
  host = host.replace(/^www\./, "");
  const parts = host.split(".");
  if (parts.length >= 3 && ["co", "com", "org", "net", "ac", "gov", "biz"].includes(parts[parts.length - 2])) {
    return parts.slice(-3).join(".");
  }
  return parts.length >= 2 ? parts.slice(-2).join(".") : host;
}

function normalizeName(name) {
  return (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(dental|dentistry|dentist|clinic|group|center|centre|of|and|the|inc|llc|pa|pllc|corp|co)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readPlaces(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(abs, "utf8"));
    return Array.isArray(data.places) ? data.places : [];
  } catch {
    return [];
  }
}

function collect(files, niche) {
  const out = [];
  for (const rel of files) {
    for (const place of readPlaces(rel)) {
      const name = (place.name || "").trim();
      if (!name) continue;
      const website = (place.website || "").trim() || null;
      const phone = (place.phone || "").trim() || null;
      const domain = website ? registrableDomain(website) : null;
      if (domain && SKIP_HOSTS.some((h) => domain === h || domain.endsWith(`.${h}`))) continue;
      if (!website && !phone) continue;
      out.push({
        name,
        website,
        domain,
        phone,
        address: (place.address || "").replace(/^[^\p{L}\d]+\s*/u, "").trim() || null,
        rating: typeof place.rating === "number" ? place.rating : null,
        reviews_count: Number.isFinite(place.reviews_count) ? place.reviews_count : null,
        hours: place.hours || null,
        maps_url: place.maps_url || null,
        query: place.query || null,
        niche,
        source_file: rel,
      });
    }
  }
  return out;
}

function dedupe(rows) {
  const seenDomain = new Set();
  const seenName = new Set();
  const out = [];
  let domainDupes = 0;
  let nameDupes = 0;
  for (const row of rows) {
    const key = row.domain ? `d:${row.domain}` : `n:${normalizeName(row.name)}|${row.phone ?? ""}`;
    const nameKey = `n:${normalizeName(row.name)}|${(row.address ?? "").slice(0, 24)}`;
    if (row.domain && seenDomain.has(row.domain)) {
      domainDupes++;
      continue;
    }
    if (seenName.has(nameKey)) {
      nameDupes++;
      continue;
    }
    if (row.domain) seenDomain.add(row.domain);
    seenName.add(nameKey);
    out.push(row);
  }
  return { out, domainDupes, nameDupes };
}

const dentalRaw = collect(DENTAL_FILES, "dental");
const agencyRaw = collect(AGENCY_FILES, "agency");
const dental = dedupe(dentalRaw);
const agency = dedupe(agencyRaw);

const withSite = [...dental.out, ...agency.out].filter((r) => r.website).length;

const pool = {
  generated_at: new Date().toISOString(),
  counts: {
    dental: dental.out.length,
    agency: agency.out.length,
    total: dental.out.length + agency.out.length,
    with_website: withSite,
    dental_duplicates_domain: dental.domainDupes,
    dental_duplicates_name: dental.nameDupes,
    agency_duplicates_domain: agency.domainDupes,
    agency_duplicates_name: agency.nameDupes,
  },
  leads: [...dental.out, ...agency.out],
};

const outPath = path.join(RESEARCH, "v2_pool.json");
fs.writeFileSync(outPath, JSON.stringify(pool, null, 2));
console.log(JSON.stringify(pool.counts, null, 2));
console.log(`wrote ${pool.leads.length} leads -> ${path.relative(ROOT, outPath)}`);
