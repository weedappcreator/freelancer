#!/usr/bin/env python3
"""Public-web lead research scraper.

Discovers real, operating businesses that match a vertical + geography by
searching the open web, then extracts structured facts from each company's
OWN website with ScrapeGraphAI.

What it records: company identity, industry, location, services, observable
buying signals, and contact channels the business itself published
(contact page / general business inbox / phone).

What it never does: harvest individuals' personal addresses from social
profiles, guess or synthesise email addresses, or send anything.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import html
import json
import os
import re
import sys
import time
import urllib.parse
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


load_dotenv(PROJECT_ROOT / ".env")

BLOCKLIST_DOMAINS = {
    # aggregators / directories / marketplaces
    "linkedin.com", "facebook.com", "instagram.com", "twitter.com", "x.com",
    "youtube.com", "tiktok.com", "pinterest.com", "reddit.com", "wikipedia.org",
    "yelp.com", "tripadvisor.com", "whatclinic.com", "practo.com", "zocdoc.com",
    "cylex", "yellowpages.com", "yellowpages.com.au", "pagesjaunes.fr",
    "gelbeseiten.de", "dasoertliche.de", "herold.at", "swisspages.ch",
    "walkpages", "foursquare.com", "mapquest.com", "openstreetmap.org",
    "google.com", "apple.com", "amazon.com", "ebay.com", "yandex.ru",
    "booking.com", "angieslist.com", "thumbtack.com", "homeadvisor.com",
    "glassdoor.com", "indeed.com", "crunchbase.com", "glassdoor", "sortlist.com",
    "clutch.co", "g2.com", "trustradius.com", "goodfirms.co", "designrush.com",
    "upwork.com", "fiverr.com", "peopleperhour.com", "freelancer.com",
    "trustpilot.com", "sitejabber.com", "bbb.org", "chamberofcommerce.com",
    "hotfrog.com", "brownbook.net", "tupalo.com", "wahadirectory.com",
    " Kompass", "europages", "manta.com", "dnb.com", "bloomberg.com",
    "marketwatch.com", "zoominfo.com", "rocketreach.co", "hunter.io",
    "signalhire.com", "apollo.io", "lusha.com", "snov.io", "lead411.com",
    "similarweb.com", "semrush.com", "alexa.com", "archive.org",
    # generic non-business
    "github.com", "gitlab.com", "medium.com", "substack.com", "wordpress.com",
    "blogspot.com", "wix.com", "squarespace.com", "godaddy.com", "addy.moe",
}

# Directories are useful as a *discovery* source but we want the business's own
# site, so these are only used to seed, never extracted as the lead itself.
THIN_CONTENT_MARKERS = ("403 forbidden", "404 not found", "access denied",
                        "enable javascript", "are you a robot", "captcha")

EXTRACTION_PROMPT_TEMPLATE = """You are analysing a single company website for B2B market research.

TARGET: we are looking for businesses matching vertical "{vertical}" in "{geography}".
A page only qualifies when BOTH of these hold:
- vertical_match: the business actually operates in the "{vertical}" trade
  (e.g. for "Immobilienmakler" it must broker/sell/manage property — a football
  club merely containing the word "Real" does NOT match; a PDF tool does NOT match).
- geography_match: the business has a real office/operation in "{geography}"
  (city/region/country as appropriate — a global SaaS with no local presence does NOT match).

Decide whether this page belongs to a real, currently operating business that sells
to other businesses or consumers AND matches the target above. If it is a directory
listing, a parked domain, a blog, a personal page, a dead site, or it fails either
match, set is_business to false and explain why in mismatch_reason.

Return ONLY JSON with this exact shape:
{
  "is_business": true,
  "mismatch_reason": "null when matching, otherwise one short sentence",
  "name": "official business name as shown on the site",
  "industry": "short industry label",
  "description": "what the business actually does, 1-2 sentences",
  "services": ["main services or products offered"],
  "city": "city or null",
  "region": "state/province/region or null",
  "country": "country or null",
  "employee_estimate": "one of: 1-10, 11-50, 51-200, 201-500, 500+ — or null",
  "founded_year": "year or null",
  "languages": ["languages the site is published in"],
  "contact": {
    "email": "a general business inbox ONLY if printed on this page, else null",
    "contact_page_url": "absolute URL of their contact page if present, else null",
    "phone": "phone number only if printed on this page, else null",
    "address": "postal address only if printed on this page, else null"
  },
  "buying_signals": ["observable facts from this page: hiring, new services, recent news, expansions, tech/tool mentions, stated growth plans"],
  "operational_friction": ["stated or visible manual/inefficient processes, e.g. 'bookings handled by phone only', 'no online quote form'"],
  "evidence": ["verbatim short quotes or page facts that support the above"],
  "source_language": "language the page is written in"
}

Rules:
- Only report contact details that are literally printed on the page you were given.
- Never invent, guess, or construct an email address.
- Never guess a city/country you did not see.
- Keep evidence as short verbatim quotes, not paraphrase.
- When in doubt about the vertical or geography match, reject (is_business=false).
"""


@dataclass
class SearchResult:
    url: str
    query: str
    vertical: str = ""
    geography: str = ""


@dataclass
class Lead:
    url: str
    query: str
    is_business: bool
    name: str | None = None
    domain: str | None = None
    industry: str | None = None
    description: str | None = None
    services: list[str] = field(default_factory=list)
    city: str | None = None
    region: str | None = None
    country: str | None = None
    geography: str | None = None
    employee_estimate: str | None = None
    founded_year: str | None = None
    languages: list[str] = field(default_factory=list)
    contact: dict[str, Any] = field(default_factory=dict)
    buying_signals: list[str] = field(default_factory=list)
    operational_friction: list[str] = field(default_factory=list)
    evidence: list[str] = field(default_factory=list)
    source_language: str | None = None
    site_status: int | None = None
    verified: bool = False
    verification_notes: list[str] = field(default_factory=list)


def registrable_domain(url: str) -> str:
    host = urllib.parse.urlparse(url).hostname or ""
    host = host.lower().removeprefix("www.")
    parts = host.split(".")
    if len(parts) >= 3 and parts[-2] in {"co", "com", "org", "net", "ac", "gov"}:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:]) if len(parts) >= 2 else host


def is_blocked(url: str) -> bool:
    domain = registrable_domain(url)
    return any(domain == b or domain.endswith("." + b) or b in domain
               for b in BLOCKLIST_DOMAINS)


def build_queries(vertical: str, geography: str, language: str, extra: list[str]) -> list[str]:
    templates = {
        "en": ['"{v}" {g} official website', '{v} companies in {g}', '{v} {g} -directory -jobs'],
        "es": ['"{v}" {g} web oficial', '{v} en {g} empresa', '{v} {g} sitio web'],
        "de": ['"{v}" {g} homepage', '{v} Firma in {g}', '{v} {g} website'],
        "it": ['"{v}" {g} sito ufficiale', '{v} azienda a {g}', '{v} {g} sito web'],
        "fr": ['"{v}" {g} site officiel', '{v} entreprise à {g}', '{v} {g} site web'],
    }
    base = templates.get(language, templates["en"])
    queries = [t.format(v=vertical, g=geography) for t in base]
    for e in extra:
        queries.append(e)
    return queries


def ddg_search(query: str, limit: int = 25, timeout: int = 25) -> list[str]:
    import requests

    urls: list[str] = []
    headers = {
        "User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"),
        "Accept-Language": "en-US,en;q=0.9",
    }
    resp = None
    for attempt in range(3):
        try:
            r = requests.post("https://html.duckduckgo.com/html/",
                              data={"q": query, "kl": "-1"},
                              headers=headers, timeout=timeout)
            if r.status_code == 200 and r.text:
                resp = r
                break
            # 202 = bot/anomaly challenge page; back off and retry
            print(f"    search attempt {attempt + 1} for {query!r}: "
                  f"HTTP {r.status_code}", file=sys.stderr)
        except Exception as exc:  # noqa: BLE001
            print(f"    search failed for {query!r}: {exc}", file=sys.stderr)
        time.sleep(2.0 * (attempt + 1))
    if resp is None:
        return urls

    text = html.unescape(resp.text)

    # Current DDG HTML layout: result links are plain hrefs on the result title.
    for match in re.finditer(r'class="result__a"[^>]*href="([^"]+)"', text):
        candidate = match.group(1).strip()
        if candidate.startswith("//"):
            candidate = "https:" + candidate
        if not candidate.startswith("http"):
            continue
        if "duckduckgo.com" in candidate:
            continue
        urls.append(candidate.split("#")[0])
        if len(urls) >= limit:
            return urls

    # Legacy layout: links wrapped as //duckduckgo.com/l/?uddg=<encoded>
    for match in re.finditer(r'href="([^"]*?uddg=[^"]*?)"', text):
        raw = urllib.parse.unquote(match.group(1))
        parsed = urllib.parse.urlparse(raw if raw.startswith("http") else "https:" + raw)
        target = urllib.parse.parse_qs(parsed.query).get("uddg", [None])[0]
        candidate = target or (raw if raw.startswith("http") else None)
        if not candidate or not candidate.startswith("http"):
            continue
        urls.append(candidate.split("#")[0])
        if len(urls) >= limit:
            break
    return urls


def bing_search(query: str, limit: int = 25, timeout: int = 25) -> list[str]:
    """Fallback discovery engine when DuckDuckGo rate-limits us."""
    import base64

    import requests

    urls: list[str] = []
    headers = {
        "User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"),
        "Accept-Language": "en-US,en;q=0.9",
    }
    try:
        resp = requests.get("https://www.bing.com/search",
                            params={"q": query, "count": 30, "setlang": "en",
                                    "mkt": "en-US", "ensearch": "1"},
                            headers=headers, timeout=timeout)
        resp.raise_for_status()
    except Exception as exc:  # noqa: BLE001
        print(f"    bing search failed for {query!r}: {exc}", file=sys.stderr)
        return urls

    text = html.unescape(resp.text)

    # Sanity gate: Bing occasionally serves a stale/generic page. Only parse
    # links when the result page is actually about our query.
    title_match = re.search(r"<title>(.*?)</title>", text, re.S | re.I)
    page_title = (title_match.group(1) if title_match else "").lower()
    query_tokens = [t.lower() for t in re.findall(r"[A-Za-zÄÖÜäöüßÀ-ÿ]{4,}", query)]
    if query_tokens and not any(t in page_title for t in query_tokens):
        print(f"    bing served an off-topic page for {query!r} "
              f"(title: {page_title[:80]!r}) — discarding", file=sys.stderr)
        return urls

    for match in re.finditer(r'u=a1([^&"]+)', text):
        blob = match.group(1)
        blob += "=" * (-len(blob) % 4)
        try:
            target = base64.urlsafe_b64decode(blob).decode("utf-8", "replace")
        except Exception:  # noqa: BLE001
            continue
        if not target.startswith("http"):
            continue
        host = urllib.parse.urlparse(target).hostname or ""
        if "bing.com" in host or "microsoft.com" in host:
            continue
        candidate = target.split("#")[0]
        if candidate not in urls:
            urls.append(candidate)
        if len(urls) >= limit:
            break
    return urls


def web_search(query: str, limit: int = 25) -> list[str]:
    urls = ddg_search(query, limit=limit)
    if len(urls) < max(3, limit // 3):
        extra = bing_search(query, limit=limit)
        seen = set(urls)
        for u in extra:
            if u not in seen:
                seen.add(u)
                urls.append(u)
        if extra:
            print(f"    (ddg returned {len(seen) - len(extra)}, bing fallback added "
                  f"{len(extra)})")
    return urls


def collect_candidates(vertical: str, geography: str, language: str,
                       extra_queries: list[str], per_query: int) -> list[SearchResult]:
    seen: set[str] = set()
    out: list[SearchResult] = []
    queries = build_queries(vertical, geography, language, extra_queries)
    for query in queries:
        print(f"  searching: {query}")
        for url in web_search(query, limit=per_query):
            domain = registrable_domain(url)
            if domain in seen or is_blocked(url):
                continue
            seen.add(domain)
            out.append(SearchResult(url=url, query=query,
                                    vertical=vertical, geography=geography))
        time.sleep(3.0)
    return out


def make_llm():
    from langchain_anthropic import ChatAnthropic

    model = os.environ.get("RESEARCH_MODEL", "claude-haiku-4-5-20251001")
    return ChatAnthropic(model=model, max_tokens=2000, temperature=0.0, streaming=False)


def make_config(llm) -> dict[str, Any]:
    return {
        "llm": {"model_instance": llm, "model_tokens": 8000},
        "verbose": False,
        "timeout": 60,
        "loader_kwargs": {"channel": "chrome", "retry_limit": 2, "timeout": 45},
    }


def probe_site(url: str, timeout: int = 20) -> tuple[int | None, str]:
    import requests

    headers = {"User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                              "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36")}
    try:
        resp = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True)
        return resp.status_code, resp.text[:4000]
    except Exception:  # noqa: BLE001
        return None, ""


def strip_html(html_text: str, max_chars: int = 6000) -> str:
    """Strip HTML tags and collapse whitespace to get plain text for LLM."""
    text = re.sub(r'<script[^>]*>.*?</script>', '', html_text, flags=re.S | re.I)
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.S | re.I)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = html.unescape(text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text[:max_chars]


def extract_lead(result: SearchResult) -> Lead:
    llm = make_llm()
    notes: list[str] = []
    status, body = probe_site(result.url)

    lead = Lead(url=result.url, query=result.query, is_business=False,
                domain=registrable_domain(result.url), site_status=status)

    if status is None or status >= 400:
        lead.verification_notes.append(f"site unreachable (HTTP {status})")
        return lead

    lowered = body.lower()
    if any(marker in lowered for marker in THIN_CONTENT_MARKERS):
        lead.verification_notes.append("page looks like an error/bot-check page")

    prompt = EXTRACTION_PROMPT_TEMPLATE.replace("{vertical}", result.vertical or "?").replace(
        "{geography}", result.geography or "?")

    # Use direct HTTP body + LLM instead of ScrapeGraphAI
    page_text = strip_html(body)
    if len(page_text) < 50:
        lead.verification_notes.append("page has no useful text content")
        return lead

    try:
        from langchain_core.messages import HumanMessage
        response = llm.invoke([HumanMessage(content=f"{prompt}\n\nPAGE CONTENT:\n{page_text}")])
        raw_text = response.content if hasattr(response, 'content') else str(response)
        # Extract JSON from response
        json_match = re.search(r'\{[\s\S]*\}', raw_text)
        if not json_match:
            lead.verification_notes.append("model returned no JSON")
            return lead
        raw = json.loads(json_match.group(0))
    except Exception as exc:  # noqa: BLE001
        lead.verification_notes.append(f"extraction failed: {exc}")
        return lead

    data = raw.get("content", raw) if isinstance(raw, dict) else raw
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except json.JSONDecodeError:
            lead.verification_notes.append("model returned non-JSON")
            return lead
    if not isinstance(data, dict):
        lead.verification_notes.append("unexpected extraction shape")
        return lead

    lead.is_business = bool(data.get("is_business"))
    if not lead.is_business:
        reason = data.get("mismatch_reason") or "not an operating business"
        lead.verification_notes.append(f"rejected: {reason}")
        return lead

    lead.name = data.get("name") or None
    lead.industry = data.get("industry") or None
    lead.description = data.get("description") or None
    lead.services = [str(s) for s in (data.get("services") or [])][:8]
    lead.city = data.get("city") or None
    lead.region = data.get("region") or None
    lead.country = data.get("country") or None
    lead.employee_estimate = data.get("employee_estimate") or None
    lead.founded_year = str(data["founded_year"]) if data.get("founded_year") else None
    lead.languages = [str(s) for s in (data.get("languages") or [])][:5]
    contact = data.get("contact") or {}
    if isinstance(contact, dict):
        lead.contact = {k: v for k, v in contact.items() if v}
    lead.buying_signals = [str(s) for s in (data.get("buying_signals") or [])][:8]
    lead.operational_friction = [str(s) for s in (data.get("operational_friction") or [])][:6]
    lead.evidence = [str(s) for s in (data.get("evidence") or [])][:8]
    lead.source_language = data.get("source_language") or None

    geo_bits = [b for b in [lead.city, lead.region, lead.country] if b]
    lead.geography = ", ".join(geo_bits) if geo_bits else None

    if not lead.name:
        lead.verification_notes.append("no business name found on page")
        lead.is_business = False
        return lead

    if lead.contact.get("email") and "@" in str(lead.contact["email"]):
        lead.verified = True
        lead.verification_notes.append("site live; business inbox published on page")
    elif lead.contact.get("contact_page_url") or lead.contact.get("phone"):
        lead.verified = True
        lead.verification_notes.append("site live; published contact channel found")
    else:
        lead.verification_notes.append("site live, but no published contact channel found")

    return lead


def main() -> int:
    parser = argparse.ArgumentParser(description="Public-web lead research scraper")
    parser.add_argument("--vertical", required=True)
    parser.add_argument("--geography", required=True)
    parser.add_argument("--language", default="en", choices=["en", "es", "de", "it", "fr"])
    parser.add_argument("--query", action="append", default=[], help="extra search query")
    parser.add_argument("--per-query", type=int, default=18)
    parser.add_argument("--workers", type=int, default=3)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    print(f"\nResearch scraper — {args.vertical} in {args.geography} [{args.language}]")
    candidates = collect_candidates(args.vertical, args.geography, args.language,
                                    args.query, args.per_query)
    print(f"\n  {len(candidates)} candidate sites after filtering\n")

    leads: list[Lead] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(extract_lead, c): c for c in candidates}
        for i, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            candidate = futures[future]
            try:
                lead = future.result()
            except Exception as exc:  # noqa: BLE001
                lead = Lead(url=candidate.url, query=candidate.query, is_business=False,
                            verification_notes=[f"crashed: {exc}"])
            flag = "OK " if lead.is_business else "skip"
            print(f"  [{i}/{len(candidates)}] {flag} {lead.url} — {lead.name or '-'}")
            leads.append(lead)

    accepted = [l for l in leads if l.is_business]
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "vertical": args.vertical,
        "geography": args.geography,
        "language": args.language,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "candidates": len(candidates),
        "accepted": len(accepted),
        "verified_with_contact": len([l for l in accepted if l.verified]),
        "leads": [asdict(l) for l in accepted],
        "skipped": [{"url": l.url, "notes": l.verification_notes} for l in leads if not l.is_business],
    }
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False))

    print(f"\n  accepted: {len(accepted)}/{len(leads)}")
    print(f"  with a published contact channel: {payload['verified_with_contact']}")
    print(f"  written: {out_path}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
