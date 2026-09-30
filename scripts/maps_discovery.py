"""Bounded Google Maps smoke test (max 10 places, single query).
Business-only fields: name, address, phone, website, rating, reviews_count, hours, maps_url.
No email enrichment. Stops (no bypass) on consent/CAPTCHA/sorry/block pages.
Uses real Google Chrome via playwright channel="chrome" (bundled chromium unsupported on this Mac).
"""
import argparse
import json, re, sys, time, urllib.parse

_ap = argparse.ArgumentParser(description="Bounded Google Maps discovery (business fields only)")
_ap.add_argument("--query", default="Zahnarzt Berlin")
_ap.add_argument("--max", type=int, default=10)
_ap.add_argument("--out", default="data/research/_maps_smoke.json")
_ap.add_argument("--hl", default="es")
_args, _unknown = _ap.parse_known_args()

QUERY = _args.query
MAX_PLACES = _args.max
OUT_PATH = _args.out
SEARCH_URL = "https://www.google.com/maps/search/" + urllib.parse.quote_plus(QUERY) + "?hl=" + _args.hl

BLOCK_PATTERNS = ["sorry/index", "unusual traffic", "captcha", "recaptcha",
                  "consent.google", "/consent", "denied", "access denied"]

def is_blocked(page):
    try:
        url = (page.url or "").lower()
        if any(p in url for p in BLOCK_PATTERNS):
            return True, f"blocked-url: {page.url}"
        html = page.content().lower()
        for marker in ["unusual traffic", "our systems have detected",
                       "alle akzeptieren", "before you continue",
                       "ich stimme zu", "consent"]:
            pass  # informational only; real consent wall check below
        # Hard stop markers: sorry page / captcha widget / explicit consent iframe redirect
        if "our systems have detected unusual traffic" in html:
            return True, "unusual-traffic page"
        if "/sorry/" in html or "id=\"captcha" in html or "g-recaptcha" in html:
            return True, "captcha/sorry page"
        # Consent wall: google consent page with accept buttons and no maps feed
        if "consent.google.com" in html and page.query_selector('div[role="feed"]') is None:
            return True, "consent wall (consent.google.com, no results feed)"
        return False, ""
    except Exception as e:
        return False, f"check-error: {e}"

def extract_place(page):
    d = {}
    try:
        h1 = page.query_selector("h1.DUwDvf")
        d["name"] = h1.inner_text().strip() if h1 else None
    except Exception:
        d["name"] = None
    # rating + reviews: look for aria-label like "4,8 von 5 Sternen (123 Rezensionen)" variants
    d["rating"] = None
    d["reviews_count"] = None
    try:
        for el in page.query_selector_all('[aria-label]'):
            try:
                lab = el.get_attribute("aria-label") or ""
            except Exception:
                continue
            m = re.search(r"(\d+[,\.]\d+)\s*(?:von\s*5|out of 5|/ ?5)?\s*(?:Sternen?|stars?)", lab, re.I)
            if m and d["rating"] is None:
                d["rating"] = float(m.group(1).replace(",", "."))
                m2 = re.search(r"\(?\s*([\d\.\,]+)\s*(?:Rezensionen|reviews|Bewertungen)", lab, re.I)
                if m2:
                    try:
                        d["reviews_count"] = int(m2.group(1).replace(".", "").replace(",", ""))
                    except Exception:
                        pass
                break
        if d["reviews_count"] is None:
            # fallback: standalone review-count elements e.g. "(1.234)" near rating
            for sel in ["span.UY7F9", "span.ceNzKf + span", "button[aria-label*='Rezension']"]:
                try:
                    el = page.query_selector(sel)
                    if el:
                        t = el.inner_text().strip().strip("()")
                        m = re.search(r"([\d\.\,]+)", t)
                        if m:
                            d["reviews_count"] = int(m.group(1).replace(".", "").replace(",", ""))
                            break
                except Exception:
                    continue
    except Exception:
        pass
    # address
    d["address"] = None
    try:
        el = page.query_selector('button[data-item-id="address"]')
        if el:
            d["address"] = el.inner_text().strip()
        else:
            el = page.query_selector('[aria-label*="Adresse"]')
            if el:
                d["address"] = el.inner_text().strip()
    except Exception:
        pass
    # phone
    d["phone"] = None
    try:
        el = page.query_selector('a[href^="tel:"]')
        if el:
            d["phone"] = (el.get_attribute("href") or "")[4:]
        else:
            el = page.query_selector('button[data-item-id*="phone"]')
            if el:
                d["phone"] = el.inner_text().strip()
    except Exception:
        pass
    # website
    d["website"] = None
    try:
        el = page.query_selector('a[data-item-id="authority"]')
        if el:
            d["website"] = el.get_attribute("href")
        else:
            for a in page.query_selector_all("a[href^='http']"):
                try:
                    lab = (a.get_attribute("aria-label") or "") + " " + (a.inner_text() or "")
                    if re.search(r"webseite|website", lab, re.I):
                        href = a.get_attribute("href") or ""
                        if "google.com" not in href:
                            d["website"] = href
                            break
                except Exception:
                    continue
    except Exception:
        pass
    # hours (short text)
    d["hours"] = None
    try:
        el = page.query_selector('div[aria-label*="ffnungszeiten"], div[aria-label*="Hours"]')
        if el:
            d["hours"] = el.inner_text().strip()[:500]
        else:
            for el in page.query_selector_all("div"):
                try:
                    t = el.inner_text()
                except Exception:
                    continue
                if t and re.search(r"Montag.*Dienstag|Monday.*Tuesday", t, re.S) and len(t) < 800:
                    d["hours"] = t.strip()[:500]
                    break
    except Exception:
        pass
    d["maps_url"] = page.url
    return d

def main():
    from playwright.sync_api import sync_playwright
    t0 = time.time()
    places, notes = [], []
    blocked = False
    block_detail = ""
    def log(msg):
        print(f"[{round(time.time()-t0,1)}s] {msg}", flush=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True,
            args=["--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"])
        ctx = browser.new_context(locale="es-ES")
        ctx.set_default_timeout(20000)
        page = ctx.new_page()
        log(f"goto {SEARCH_URL}")
        page.goto(SEARCH_URL, timeout=30000)
        log(f"loaded url={page.url[:100]}")
        try:
            page.wait_for_selector('div[role="feed"]', timeout=15000)
            log("feed found")
        except Exception as e:
            notes.append(f"no feed after 15s: {e}")
            log("NO FEED after 15s")
        blocked, block_detail = is_blocked(page)
        if blocked:
            notes.append(f"STOP: {block_detail} (no bypass attempted)")
        else:
            # scroll feed to load results, collect place hrefs
            hrefs = []
            seen = set()
            feed = page.query_selector('div[role="feed"]')
            for i in range(6):
                try:
                    links = page.query_selector_all('a.hfpxzc')
                    for a in links:
                        try:
                            h = a.get_attribute("href")
                        except Exception:
                            continue
                        if h and "/maps/place/" in h and h not in seen:
                            seen.add(h)
                            hrefs.append(h)
                            if len(hrefs) >= MAX_PLACES:
                                break
                    log(f"scroll {i}: {len(hrefs)} hrefs")
                    if len(hrefs) >= MAX_PLACES:
                        break
                    if feed:
                        page.evaluate("(el) => el.scrollBy(0, 1500)", feed)
                    page.wait_for_timeout(1000)
                except Exception as e:
                    notes.append(f"scroll iter {i} error: {e}")
                    break
            notes.append(f"collected {len(hrefs)} place hrefs from feed")
            blocked2, bd2 = is_blocked(page)
            if blocked2:
                blocked, block_detail = True, bd2
                notes.append(f"STOP mid-run: {bd2}")
            for idx, href in enumerate(hrefs[:MAX_PLACES]):
                try:
                    log(f"place {idx} goto")
                    page.goto(href, timeout=20000)
                    page.wait_for_timeout(1500)
                    b2, bd = is_blocked(page)
                    if b2:
                        notes.append(f"place {idx} blocked: {bd}; stopping further details")
                        blocked, block_detail = True, bd
                        break
                    rec = extract_place(page)
                    rec["query"] = QUERY
                    places.append(rec)
                    log(f"place {idx} done: {rec.get('name')}")
                    page.wait_for_timeout(500)
                except Exception as e:
                    notes.append(f"place {idx} error: {e}")
                    log(f"place {idx} ERROR {e}")
        try:
            ctx.close()
        except Exception:
            pass
        try:
            browser.close()
        except Exception:
            pass
    dt = round(time.time() - t0, 1)
    out = {
        "smoke": True,
        "query": QUERY,
        "max_places": MAX_PLACES,
        "n_places": len(places),
        "runtime_s": dt,
        "blocked_or_consent": blocked,
        "block_detail": block_detail,
        "notes": notes,
        "fields_per_place": ["name", "address", "phone", "website", "rating", "reviews_count", "hours", "maps_url", "query"],
        "places": places,
    }
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"saved {len(places)} places in {dt}s -> {OUT_PATH} blocked={blocked} {block_detail}")

if __name__ == "__main__":
    main()
