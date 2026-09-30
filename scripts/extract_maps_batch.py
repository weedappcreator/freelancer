#!/usr/bin/env python3
"""Batch-extract Maps-discovered places through research_scraper.extract_lead.

Usage:
  .venv-scraper/bin/python scripts/extract_maps_batch.py <maps.json:vertical:geography> ... --out data/research/batch1.json

Business-published contacts only (enforced inside extract_lead). Strict gate kept as-is.
"""
import argparse
import concurrent.futures
import json
import sys
import time
import urllib.parse
from dataclasses import asdict
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))
import research_scraper  # noqa: E402  (registers in sys.modules; reuse, do not rewrite)
sys.modules.setdefault("research_scraper", research_scraper)


def registrable_domain(url: str) -> str:
    host = (urllib.parse.urlparse(url).hostname or "").lower().removeprefix("www.")
    parts = host.split(".")
    if len(parts) >= 3 and parts[-2] in {"co", "com", "org", "net", "ac", "gov"}:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:]) if len(parts) >= 2 else host


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("specs", nargs="+", help="maps.json:vertical:geography")
    ap.add_argument("--out", required=True)
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--timeout", type=int, default=280,
                    help="max seconds to wait per site before marking it timed-out")
    args = ap.parse_args()

    t0 = time.time()
    candidates: list[research_scraper.SearchResult] = []
    seen_domains: set[str] = set()
    per_query: dict[str, int] = {}
    with_website = 0
    for spec in args.specs:
        maps_path, vertical, geography = spec.split(":", 2)
        data = json.loads(Path(maps_path).read_text(encoding="utf-8"))
        places = data.get("places", [])
        per_query[data.get("query", maps_path)] = len(places)
        for p in places:
            url = (p.get("website") or "").strip()
            if not url:
                continue
            with_website += 1
            dom = registrable_domain(url)
            if dom in seen_domains or research_scraper.is_blocked(url):
                continue
            seen_domains.add(dom)
            candidates.append(
                research_scraper.SearchResult(
                    url=url,
                    query=f"Google Maps: {p.get('name', '')} ({data.get('query', '')})",
                    vertical=vertical,
                    geography=geography,
                )
            )
    print(f"candidates with website: {with_website}, after dedupe/blocklist: {len(candidates)}", flush=True)

    leads: list[research_scraper.Lead] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        pending = {pool.submit(research_scraper.extract_lead, c): c for c in candidates}
        done_count = 0
        total = len(candidates)
        while pending:
            done, _ = concurrent.futures.wait(pending, timeout=args.timeout,
                                              return_when=concurrent.futures.FIRST_COMPLETED)
            if not done:
                # nothing finished within timeout — retire one as timed-out
                fut, c = next(iter(pending.items()))
                fut.cancel()
                lead = research_scraper.Lead(url=c.url, query=c.query, is_business=False,
                                             verification_notes=["skipped: extraction timed out"])
                del pending[fut]
                done_count += 1
                print(f"  [{done_count}/{total}] TIMEOUT {lead.url}", flush=True)
                leads.append(lead)
                continue
            for fut in done:
                c = pending.pop(fut)
                try:
                    lead = fut.result()
                except Exception as exc:  # noqa: BLE001
                    lead = research_scraper.Lead(url=c.url, query=c.query, is_business=False,
                                                 verification_notes=[f"crashed: {exc}"])
                flag = "OK  " if lead.is_business else "skip"
                done_count += 1
                print(f"  [{done_count}/{total}] {flag} {lead.url} — {lead.name or '-'}", flush=True)
                leads.append(lead)

    accepted = [l for l in leads if l.is_business]
    rejected: dict[str, int] = {}
    for l in leads:
        if not l.is_business:
            key = "; ".join(l.verification_notes) if l.verification_notes else "unknown"
            rejected[key] = rejected.get(key, 0) + 1

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "vertical": "marketing agency / real estate agency",
        "geography": "Madrid / Barcelona, Spain",
        "language": "es",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "candidates": len(candidates),
        "accepted": len(accepted),
        "verified_with_contact": len([l for l in accepted if l.verified]),
        "places_per_query": per_query,
        "leads": [asdict(l) for l in accepted],
        "skipped": [{"url": l.url, "notes": l.verification_notes} for l in leads if not l.is_business],
        "rejection_reasons": rejected,
    }
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    dt = round(time.time() - t0, 1)
    print(f"\naccepted: {len(accepted)}/{len(leads)} in {dt}s -> {out_path}")
    print("top rejection reasons:")
    for reason, n in sorted(rejected.items(), key=lambda kv: -kv[1])[:8]:
        print(f"  {n}x {reason[:160]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
