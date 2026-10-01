#!/usr/bin/env python3
"""
Graphic Design Agent v5 — Audit-corrected pro-grade social media posts
Fixes from visual audit:
  1. Static bold/black fonts (not variable = thin)
  2. Label spacing fixed (no overlap on stats)
  3. Better vertical content distribution (fill the canvas)
  4. Tighter headline leading for IMPACT
  5. Proper font weight hierarchy: Black > Bold > Medium > Regular
"""

import os, sys, math, random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent.parent.parent
OUTPUT_DIR = ROOT / "data" / "content" / "posts"
FONTS_DIR = ROOT / "assets" / "fonts"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ═══════════════════════════════════════════════
# FONT SYSTEM — Static weights (NOT variable!)
# Variable fonts render as Regular in Pillow.
# ═══════════════════════════════════════════════

FONT_MAP = {
    # role: [list of static .ttf candidates in priority order]
    "black":     ["Montserrat-Black.ttf", "Inter-Black.ttf"],
    "extrabold": ["Montserrat-ExtraBold.ttf", "Montserrat-Black.ttf"],
    "bold":      ["Montserrat-Bold.ttf", "Inter-Bold.ttf"],
    "semibold":  ["Inter-SemiBold.ttf", "Montserrat-Bold.ttf"],
    "medium":    ["Inter-Medium.ttf", "Montserrat-Medium.ttf"],
    "regular":   ["Inter-Regular.ttf", "Montserrat-Regular.ttf"],
    "impact":    ["BebasNeue-Regular.ttf", "Oswald-Bold.ttf"],
    "condensed": ["Oswald-Bold.ttf", "BebasNeue-Regular.ttf"],
    "mono":      ["JetBrainsMono-Regular.ttf"],
}

SYSTEM_FALLBACKS = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial.ttf",
    "/System/Library/Fonts/SFNSMono.ttf",
    "/System/Library/Fonts/Menlo.ttc",
]

_font_cache = {}

def font(size, weight="bold"):
    """Load static font file by weight. Cached."""
    key = (size, weight)
    if key in _font_cache:
        return _font_cache[key]

    candidates = [str(FONTS_DIR / f) for f in FONT_MAP.get(weight, FONT_MAP["bold"])]
    candidates += SYSTEM_FALLBACKS

    for fp in candidates:
        if os.path.exists(fp):
            try:
                f = ImageFont.truetype(fp, size)
                _font_cache[key] = f
                return f
            except Exception:
                continue

    f = ImageFont.load_default()
    _font_cache[key] = f
    return f

# ═══════════════════════════════════════════════
# RELATIVE SIZING
# ═══════════════════════════════════════════════

def px(canvas_dim, ratio):
    return max(1, int(canvas_dim * ratio))

class L:
    """Layout calculator — all sizes from canvas dimensions."""
    def __init__(self, W, H):
        self.W, self.H = W, H
        self.mx = px(W, 0.075)        # 7.5% side margins
        self.mt = px(H, 0.06)         # 6% top margin
        self.cw = W - 2 * self.mx     # content width
        # Font sizes (relative to height)
        self.head   = px(H, 0.065)    # headline — BLACK weight
        self.sub    = px(H, 0.032)    # subheadline — BOLD
        self.body   = px(H, 0.020)    # body — REGULAR (3.25x ratio to head)
        self.stat   = px(H, 0.10)     # stat numbers — IMPACT
        self.statlb = px(H, 0.018)    # stat labels — MEDIUM
        self.pill   = px(H, 0.013)    # pill badge — BOLD
        self.foot   = px(H, 0.012)    # footer — MEDIUM
        self.cta    = px(H, 0.024)    # CTA — BOLD
        # Spacing
        self.gap    = px(H, 0.035)    # section gap
        self.lgap   = px(H, 0.008)    # line gap tight (headlines)
        self.bgap   = px(H, 0.012)    # line gap body
        # Components
        self.fh     = px(H, 0.075)    # footer height
        self.barw   = px(W, 0.20)     # accent bar width
        self.barh   = max(4, px(H, 0.004))  # accent bar height

# ═══════════════════════════════════════════════
# STYLE PALETTES
# ═══════════════════════════════════════════════

STYLES = {
    "dark_neon": {
        "bg": (8, 8, 14), "bg2": (14, 16, 24),
        "fg": (245, 245, 250), "fg2": (175, 180, 195), "fg3": (90, 95, 115),
        "acc": (0, 190, 255), "acc2": (0, 255, 136), "acc3": (160, 60, 255),
        "gt": (8, 8, 20), "gb": (14, 22, 38),
        "glow": True,
    },
    "hormozi_black": {
        "bg": (0, 0, 0), "bg2": (12, 12, 12),
        "fg": (255, 255, 255), "fg2": (200, 200, 200), "fg3": (110, 110, 110),
        "acc": (255, 215, 0), "acc2": (255, 90, 0), "acc3": (255, 50, 50),
        "gt": (0, 0, 0), "gb": (5, 5, 5),
        "glow": False,
    },
    "midnight_blue": {
        "bg": (8, 8, 24), "bg2": (16, 16, 38),
        "fg": (255, 255, 255), "fg2": (185, 190, 215), "fg3": (95, 100, 135),
        "acc": (99, 102, 241), "acc2": (236, 72, 153), "acc3": (59, 130, 246),
        "gt": (8, 8, 30), "gb": (16, 14, 44),
        "glow": True,
    },
    "terminal": {
        "bg": (3, 3, 3), "bg2": (14, 14, 14),
        "fg": (0, 255, 136), "fg2": (0, 210, 115), "fg3": (0, 130, 75),
        "acc": (0, 255, 136), "acc2": (255, 215, 0), "acc3": (255, 80, 80),
        "gt": (3, 3, 3), "gb": (8, 14, 8),
        "glow": True,
    },
    "minimal_white": {
        "bg": (250, 250, 252), "bg2": (235, 238, 244),
        "fg": (15, 20, 35), "fg2": (90, 100, 120), "fg3": (155, 162, 178),
        "acc": (37, 99, 235), "acc2": (16, 185, 129), "acc3": (139, 92, 246),
        "gt": (250, 250, 252), "gb": (242, 244, 250),
        "glow": False,
    },
}

# ═══════════════════════════════════════════════
# DRAWING PRIMITIVES
# ═══════════════════════════════════════════════

def _tw(d, t, f):
    b = d.textbbox((0, 0), t, font=f); return b[2] - b[0]
def _th(d, t, f):
    b = d.textbbox((0, 0), t, font=f); return b[3] - b[1]

def gradient_bg(img, t, b):
    d = ImageDraw.Draw(img)
    w, h = img.size
    for y in range(h):
        r = y / h
        d.line([(0, y), (w, y)], fill=tuple(int(t[i] + (b[i] - t[i]) * r) for i in range(3)))

def glow(img, cx, cy, rad, col, intensity=28):
    g = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(g)
    for r in range(rad, 0, -4):
        a = min(255, max(0, int(intensity * (r / rad) ** 0.7)))
        d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=(*col, a))
    g = g.filter(ImageFilter.GaussianBlur(radius=rad // 2))
    img.paste(Image.alpha_composite(img.convert("RGBA"), g).convert("RGB"))

def neon(img, x, y, text, fnt, col, blur=10, alpha=45):
    g = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(g).text((x, y), text, fill=(*col, alpha), font=fnt)
    g = g.filter(ImageFilter.GaussianBlur(radius=blur))
    img.paste(Image.alpha_composite(img.convert("RGBA"), g).convert("RGB"))
    ImageDraw.Draw(img).text((x, y), text, fill=col, font=fnt)

def wrap_px(d, text, fnt, max_w):
    """Wrap text by pixel width."""
    words = text.split(); lines = []; cur = ""
    for w in words:
        test = f"{cur} {w}".strip()
        if _tw(d, test, fnt) <= max_w:
            cur = test
        else:
            if cur: lines.append(cur)
            cur = w
    if cur: lines.append(cur)
    return lines

# ═══════════════════════════════════════════════
# CANVAS + COMPONENTS
# ═══════════════════════════════════════════════

def canvas(W, H, S):
    img = Image.new("RGB", (W, H), S["bg"])
    gradient_bg(img, S["gt"], S["gb"])
    if S["glow"]:
        glow(img, int(W*0.15), int(H*0.22), int(W*0.28), S["acc"], 22)
        glow(img, int(W*0.85), int(H*0.78), int(W*0.20), S["acc3"], 14)
    return img

def pill(d, x, y, text, fnt, bg, fg=(255,255,255)):
    tw = _tw(d, text, fnt); th = _th(d, text, fnt)
    ppx = int(th * 1.3); ppy = int(th * 0.5)
    pw = tw + ppx*2; ph = th + ppy*2
    d.rounded_rectangle([x, y, x+pw, y+ph], radius=ph//2, fill=bg)
    d.text((x+ppx, y+ppy), text, fill=fg, font=fnt)
    return pw, ph

def footer(img, l, S, cta_text=None):
    W, H = img.size; d = ImageDraw.Draw(img)
    by = H - l.fh
    d.rectangle([0, by, W, H], fill=S["bg2"])
    d.rectangle([0, by, W, by+2], fill=S["acc"])
    fb = font(l.foot, "medium"); fh = font(l.foot, "regular")
    ty = by + (l.fh - l.foot*2 - 6) // 2
    d.text((l.mx, ty), "EDOUARD AUTOMATIONS", fill=S["fg3"], font=fb)
    d.text((l.mx, ty + l.foot + 6), "@edouard.automations", fill=S["acc"], font=fh)
    if cta_text:
        fc = font(l.cta, "bold")
        cw = _tw(d, cta_text, fc)
        d.text((W - l.mx - cw, by + (l.fh - l.cta)//2), cta_text, fill=S["acc"], font=fc)
    else:
        url = "edouardautomations.engineering"
        uw = _tw(d, url, fh)
        d.text((W - l.mx - uw, ty + l.foot + 6), url, fill=S["fg3"], font=fh)

def accent_bar(d, x, y, w, h, col):
    d.rounded_rectangle([x, y, x+w, y+h], radius=h//2, fill=col)

def headline(img, x, y, text, fnt, S, l, max_lines=3, accent_word=None):
    """Render headline — BLACK weight, optional accent word, pixel wrapping."""
    d = ImageDraw.Draw(img)
    lines = wrap_px(d, text, fnt, l.cw)[:max_lines]
    lh = _th(d, "Ay", fnt) + l.lgap

    for line in lines:
        if accent_word and accent_word.lower() in line.lower():
            low = line.lower(); idx = low.find(accent_word.lower())
            before = line[:idx]; word = line[idx:idx+len(accent_word)]; after = line[idx+len(accent_word):]
            cx = x
            for part, col in [(before, S["fg"]), (word, S["acc"]), (after, S["fg"])]:
                if not part: continue
                if S["glow"]:
                    neon(img, cx, y, part, fnt, col, 8, 30)
                else:
                    ImageDraw.Draw(img).text((cx, y), part, fill=col, font=fnt)
                cx += _tw(ImageDraw.Draw(img), part, fnt)
        else:
            if S["glow"]:
                neon(img, x, y, line, fnt, S["fg"], 8, 28)
            else:
                ImageDraw.Draw(img).text((x, y), line, fill=S["fg"], font=fnt)
        y += lh
    return y

def pillar_col(p, S):
    return {"education": S["acc"], "proof": S["acc2"], "hot-take": (229,72,77),
            "behind": (229,175,56), "lifestyle": S["acc3"]}.get(p, S["acc"])

# ═══════════════════════════════════════════════
# TEMPLATES
# ═══════════════════════════════════════════════

def create_single_post(head_text, body_text, hashtags="", pillar="education",
                       post_id="post", style_name="dark_neon", accent_word=None):
    S = STYLES[style_name]; W, H = 1080, 1350; l = L(W, H)
    img = canvas(W, H, S); d = ImageDraw.Draw(img)

    fpl = font(l.pill, "bold")
    fhd = font(l.head, "black")        # BLACK weight — thick, bold, scroll-stopping
    fbd = font(l.body, "regular")
    fhs = font(px(H, 0.010), "mono")

    # Pill
    y = l.mt
    pc = pillar_col(pillar, S)
    _, ph = pill(d, l.mx, y, pillar.upper(), fpl, pc)

    # Headline — BLACK
    y += ph + l.gap
    y = headline(img, l.mx, y, head_text, fhd, S, l, 3, accent_word)
    d = ImageDraw.Draw(img)

    # Accent bar
    y += px(H, 0.018)
    accent_bar(d, l.mx, y, l.barw, l.barh, S["acc"])

    # Body
    y += l.barh + l.gap
    for line in wrap_px(d, body_text, fbd, l.cw)[:5]:
        d.text((l.mx, y), line, fill=S["fg2"], font=fbd)
        y += _th(d, line, fbd) + l.bgap

    # CTA area — fill dead space with a subtle CTA
    cta_y = H - l.fh - px(H, 0.10)
    fcta = font(px(H, 0.018), "semibold")
    cta = "DM me \u2018AUTOMATE\u2019 for a free audit \u2192"
    d.text((l.mx, cta_y), cta, fill=S["acc"], font=fcta)
    # Thin line above CTA
    d.rectangle([l.mx, cta_y - px(H, 0.015), l.mx + l.cw, cta_y - px(H, 0.015) + 1], fill=S["fg3"])

    # Hashtags
    if hashtags:
        hy = cta_y + px(H, 0.035)
        d.text((l.mx, hy), hashtags[:70], fill=S["fg3"], font=fhs)

    footer(img, l, S)
    out = OUTPUT_DIR / f"{post_id}.png"
    img.save(str(out), "PNG", quality=95)
    return str(out)


def create_hook_post(head_text, post_id="hook", style_name="hormozi_black", accent_word=None):
    """Hormozi-style: black + MASSIVE condensed text. Zero decoration."""
    S = STYLES.get(style_name, STYLES["hormozi_black"]); W, H = 1080, 1350; l = L(W, H)
    img = Image.new("RGB", (W, H), S["bg"]); d = ImageDraw.Draw(img)

    # IMPACT font at massive size
    fhd = font(px(H, 0.085), "impact")

    # Center text vertically in upper 60%
    text_upper = head_text.upper()
    lines = wrap_px(d, text_upper, fhd, int(l.cw * 0.95))[:5]
    lh = _th(d, "AY", fhd) + px(H, 0.012)
    total = len(lines) * lh
    start_y = max(l.mt, int((H * 0.55 - total) / 2) + l.mt)

    for line in lines:
        if accent_word and accent_word.upper() in line:
            au = accent_word.upper(); idx = line.find(au)
            before = line[:idx]; word = line[idx:idx+len(au)]; after = line[idx+len(au):]
            cx = l.mx
            for part, col in [(before, S["fg"]), (word, S["acc"]), (after, S["fg"])]:
                if not part: continue
                d.text((cx, start_y), part, fill=col, font=fhd)
                cx += _tw(d, part, fhd)
        else:
            d.text((l.mx, start_y), line, fill=S["fg"], font=fhd)
        start_y += lh

    # Subtle subtext below headline
    fsub = font(px(H, 0.018), "medium")
    sub_y = start_y + l.gap
    d.text((l.mx, sub_y), "I build AI systems that replace manual work.", fill=S["fg3"], font=fsub)

    footer(img, l, S)
    out = OUTPUT_DIR / f"{post_id}.png"
    img.save(str(out), "PNG", quality=95)
    return str(out)


def create_quote_post(quote, attribution="Weed Edouard", post_id="quote", style_name="dark_neon"):
    S = STYLES[style_name]; W, H = 1080, 1350; l = L(W, H)
    img = canvas(W, H, S)
    if S["glow"]:
        glow(img, W//2, H//2, int(W*0.32), S["acc"], 18)
    d = ImageDraw.Draw(img)

    fm = font(px(H, 0.10), "impact")      # quote mark
    fq = font(px(H, 0.045), "bold")       # quote text — BOLD not regular
    fa = font(px(H, 0.020), "semibold")    # attribution

    # Quote mark
    if S["glow"]:
        neon(img, l.mx, l.mt, "\u201C", fm, S["acc"], 16, 40)
    else:
        ImageDraw.Draw(img).text((l.mx, l.mt), "\u201C", fill=S["acc"], font=fm)
    d = ImageDraw.Draw(img)

    # Quote — vertically centered between mark and footer
    lines = wrap_px(d, quote, fq, l.cw)[:5]
    lh = _th(d, "Ay", fq) + px(H, 0.010)
    total = len(lines) * lh
    zone_top = l.mt + px(H, 0.10)
    zone_bot = H - l.fh - px(H, 0.10)
    start_y = zone_top + (zone_bot - zone_top - total) // 2

    for line in lines:
        if S["glow"]:
            neon(img, l.mx, start_y, line, fq, S["fg"], 5, 16)
        else:
            ImageDraw.Draw(img).text((l.mx, start_y), line, fill=S["fg"], font=fq)
        start_y += lh

    # Attribution
    d = ImageDraw.Draw(img)
    ay = start_y + l.gap
    accent_bar(d, l.mx, ay + px(H, 0.007), px(W, 0.03), l.barh, S["acc"])
    d.text((l.mx + px(W, 0.045), ay), attribution, fill=S["acc"], font=fa)

    footer(img, l, S)
    out = OUTPUT_DIR / f"{post_id}.png"
    img.save(str(out), "PNG", quality=95)
    return str(out)


def create_stats_post(title, stats, post_id="stats", style_name="dark_neon"):
    S = STYLES[style_name]; W, H = 1080, 1350; l = L(W, H)
    img = canvas(W, H, S)
    colors = [S["acc"], S["acc2"], S["acc3"], (229, 180, 56)]
    d = ImageDraw.Draw(img)

    ft = font(l.sub, "bold")
    fv = font(l.stat, "impact")        # IMPACT weight for stats
    fl = font(l.statlb, "medium")      # MEDIUM for labels

    # Title
    y = l.mt
    d.text((l.mx, y), title, fill=S["fg"], font=ft)
    y += _th(d, title, ft) + px(H, 0.015)
    accent_bar(d, l.mx, y, l.barw, l.barh, S["acc"])

    # Stats — evenly spaced, LABEL BELOW VALUE with proper gap
    sl = stats[:4]; n = len(sl)
    st = y + l.gap
    sb = H - l.fh - px(H, 0.025)
    slot = (sb - st) // n

    for i, (label, value) in enumerate(sl):
        col = colors[i % len(colors)]
        sy = st + i * slot

        if S["glow"]:
            glow(img, l.mx + px(W, 0.08), sy + px(H, 0.035), px(W, 0.07), col, 14)
            neon(img, l.mx, sy, str(value), fv, col, 10, 38)
            d = ImageDraw.Draw(img)
        else:
            d.text((l.mx, sy), str(value), fill=col, font=fv)

        # FIXED: measure actual value height, add proper gap THEN label
        vh = _th(d, str(value), fv)
        label_y = sy + vh + px(H, 0.010)   # 1% gap below number
        d.text((l.mx, label_y), label, fill=S["fg2"], font=fl)

        # Right accent tick
        d.rectangle([W - l.mx - 4, sy + px(H, 0.008), W - l.mx, sy + vh], fill=col)

    footer(img, l, S)
    out = OUTPUT_DIR / f"{post_id}.png"
    img.save(str(out), "PNG", quality=95)
    return str(out)


def create_carousel_slide(slide_num, total, title, points, post_id="carousel", style_name="dark_neon"):
    S = STYLES[style_name]; W, H = 1080, 1350; l = L(W, H)
    img = canvas(W, H, S); d = ImageDraw.Draw(img)

    fpl = font(l.pill, "bold")
    fhd = font(px(H, 0.048), "black")
    fpt = font(l.body, "regular")
    fbn = font(px(H, 0.014), "bold")

    # Pill counter
    y = l.mt
    _, ph = pill(d, l.mx, y, f"{slide_num} / {total}", fpl, S["acc"])

    # Title
    y += ph + l.gap
    y = headline(img, l.mx, y, title, fhd, S, l, 3)
    d = ImageDraw.Draw(img)

    # Accent bar
    y += px(H, 0.012)
    accent_bar(d, l.mx, y, l.barw, l.barh, S["acc"])

    # Numbered points
    y += l.barh + l.gap
    cr = px(H, 0.013)
    tx = l.mx + cr * 2 + px(W, 0.018)

    for idx, pt in enumerate(points[:6], 1):
        # Circle with number
        cx = l.mx + cr; cy = y + cr
        d.ellipse([cx-cr, cy-cr, cx+cr, cy+cr], fill=S["acc"])
        ns = str(idx)
        nw = _tw(d, ns, fbn); nh = _th(d, ns, fbn)
        d.text((cx - nw//2, cy - nh//2 - 1), ns, fill=(255,255,255), font=fbn)

        # Text
        for wl in wrap_px(d, pt, fpt, l.cw - cr*2 - px(W, 0.018))[:2]:
            d.text((tx, y), wl, fill=S["fg2"], font=fpt)
            y += _th(d, wl, fpt) + px(H, 0.005)
        y += px(H, 0.016)

    cta = "Swipe \u2192" if slide_num < total else "DM \u2018AUTOMATE\u2019"
    footer(img, l, S, cta)
    out = OUTPUT_DIR / f"{post_id}_slide{slide_num}.png"
    img.save(str(out), "PNG", quality=95)
    return str(out)


def create_before_after(before_text, after_text, before_stats, after_stats,
                        post_id="ba", style_name="dark_neon"):
    S = STYLES[style_name]; W, H = 1080, 1350; l = L(W, H)
    img = canvas(W, H, S); d = ImageDraw.Draw(img)

    mid = W // 2; cp = px(W, 0.05)
    red = (229, 72, 77); green = S["acc2"]

    if S["glow"]:
        glow(img, mid//2, H//2, px(W, 0.2), red, 14)
        glow(img, mid + mid//2, H//2, px(W, 0.2), green, 14)
    d = ImageDraw.Draw(img)

    # Center divider
    for sy in range(l.mt, H - l.fh, px(H, 0.012)):
        d.rectangle([mid-1, sy, mid+1, sy + px(H, 0.006)], fill=S["fg3"])

    fpl = font(l.pill, "bold")
    fsc = font(px(H, 0.025), "bold")
    fvl = font(px(H, 0.048), "impact")     # IMPACT for stats
    flb = font(l.statlb, "medium")

    def col(cx, label, lcol, sec_text, stats_data):
        nonlocal d
        pill(d, cx, l.mt, label, fpl, lcol)
        sy = l.mt + px(H, 0.05)
        for sl in wrap_px(d, sec_text, fsc, mid - cp*2)[:2]:
            d.text((cx, sy), sl, fill=S["fg"], font=fsc)
            sy += _th(d, sl, fsc) + px(H, 0.006)
        sy += px(H, 0.01)
        accent_bar(d, cx, sy, px(W, 0.04), l.barh, lcol)

        # Stats — evenly distributed in remaining space
        stp = sy + l.gap
        stb = H - l.fh - px(H, 0.025)
        n = len(stats_data[:3])
        slot = (stb - stp) // max(n, 1)

        for lb, val in stats_data[:3]:
            if S["glow"]:
                neon(img, cx, stp, str(val), fvl, lcol, 7, 28)
                d = ImageDraw.Draw(img)
            else:
                d.text((cx, stp), str(val), fill=lcol, font=fvl)
            vh = _th(d, str(val), fvl)
            d.text((cx, stp + vh + px(H, 0.006)), lb, fill=S["fg2"], font=flb)
            stp += slot

    col(cp, "BEFORE", red, before_text, before_stats)
    col(mid + cp, "AFTER", green, after_text, after_stats)

    footer(img, l, S)
    out = OUTPUT_DIR / f"{post_id}.png"
    img.save(str(out), "PNG", quality=95)
    return str(out)


# ═══════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════

def main():
    if len(sys.argv) < 2:
        print("Usage: graphic-design-agent.py <command> [--style <style>]")
        print(f"Styles: {', '.join(STYLES.keys())}")
        print("Commands: single, hook, quote, stats, carousel, before-after, demo-all")
        return

    cmd = sys.argv[1]
    style = "dark_neon"
    args = sys.argv[2:]
    if "--style" in args:
        si = args.index("--style")
        if si + 1 < len(args):
            style = args[si + 1]
            args = args[:si] + args[si + 2:]
    if style not in STYLES:
        print(f"Unknown style: {style}. Available: {', '.join(STYLES.keys())}")
        return

    if cmd == "demo-all":
        print(f"\n{'='*55}")
        print(f" DESIGN AGENT v5 — Audit-corrected")
        print(f" Fonts: Montserrat Black / BebasNeue / Inter Bold")
        print(f" Fixes: Bold weight, label spacing, CTA fill, layout")
        print(f"{'='*55}\n")

        for sn in STYLES:
            print(f"  [{sn}]")

            p = create_single_post(
                "AI That Books Patients While You Sleep",
                "Most dental practices lose 60% of after-hours leads. Our AI assistant captures every single one — 24/7, no staff needed.",
                pillar="education", post_id=f"demo_{sn}_single",
                style_name=sn, accent_word="AI")
            print(f"    single:   {Path(p).name}")

            p = create_hook_post(
                "Your agency is charging $3K/month for what AI does in 5 minutes",
                post_id=f"demo_{sn}_hook", style_name=sn, accent_word="$3K/month")
            print(f"    hook:     {Path(p).name}")

            p = create_quote_post(
                "Your business is losing money every hour you don't have AI answering your leads",
                post_id=f"demo_{sn}_quote", style_name=sn)
            print(f"    quote:    {Path(p).name}")

            p = create_stats_post(
                "THIS WEEK\u2019S AI RESULTS",
                [("Emails Sent", "47"), ("Reply Rate", "23%"), ("Meetings Booked", "6"), ("Pipeline Value", "$127K")],
                post_id=f"demo_{sn}_stats", style_name=sn)
            print(f"    stats:    {Path(p).name}")

            p = create_before_after(
                "Manual Follow-ups", "AI Automated",
                [("Hours/week", "20"), ("Response time", "4h"), ("Leads lost", "60%")],
                [("Hours/week", "2"), ("Response time", "30s"), ("Leads lost", "3%")],
                post_id=f"demo_{sn}_ba", style_name=sn)
            print(f"    b/a:      {Path(p).name}")

            p = create_carousel_slide(1, 5,
                "5 Things AI Can Automate In Your Business Today",
                ["Email follow-ups that feel personal", "Lead qualification in real-time",
                 "Appointment booking 24/7", "Review requests after every visit",
                 "Client onboarding workflows"],
                post_id=f"demo_{sn}_carousel", style_name=sn)
            print(f"    carousel: {Path(p).name}")
            print()

        print(f"  Done — {len(STYLES) * 6} images.\n")

    elif cmd == "hook":
        p = create_hook_post(args[0] if args else "Stop paying $5K for what AI does in 5 min",
            post_id=args[1] if len(args)>1 else "hook", style_name=style,
            accent_word=args[2] if len(args)>2 else None)
        print(f"Created: {p}")
    elif cmd == "single":
        p = create_single_post(args[0] if args else "AI That Books Patients While You Sleep",
            args[1] if len(args)>1 else "Our AI captures every lead.",
            pillar=args[2] if len(args)>2 else "education",
            post_id=args[3] if len(args)>3 else "single", style_name=style)
        print(f"Created: {p}")
    elif cmd == "quote":
        p = create_quote_post(args[0] if args else "Stop paying $5K for what AI does in 5 minutes.",
            post_id=args[1] if len(args)>1 else "quote", style_name=style)
        print(f"Created: {p}")
    elif cmd == "stats":
        p = create_stats_post("THIS WEEK\u2019S AI RESULTS",
            [("Emails Sent","47"),("Reply Rate","23%"),("Meetings","6"),("Pipeline","$127K")],
            post_id=args[0] if args else "stats", style_name=style)
        print(f"Created: {p}")
    elif cmd == "before-after":
        p = create_before_after("Manual Follow-ups","AI Automated",
            [("Hours/week","20"),("Response time","4h"),("Leads lost","60%")],
            [("Hours/week","2"),("Response time","30s"),("Leads lost","3%")],
            post_id=args[0] if args else "ba", style_name=style)
        print(f"Created: {p}")
    elif cmd == "carousel":
        slides = [
            ("5 Things AI Can Automate Today", ["Email follow-ups that feel personal",
             "Lead qualification in real-time","Appointment booking 24/7",
             "Review requests after service","Client onboarding workflows"]),
            ("Why It Matters", ["Your competitors are already doing this",
             "Every hour without AI = lost revenue","One system replaces 3 manual processes",
             "ROI shows within the first week"]),
            ("How I Build It", ["Analyze your current workflow","Identify the biggest time wasters",
             "Build custom AI for each bottleneck","Test, deploy, and optimize"]),
            ("Ready to Start?", ["DM me 'AUTOMATE' for a free audit",
             "I'll show you where AI saves you money","@edouard.automations"])
        ]
        pid = args[0] if args else "carousel"
        for i, (t, pts) in enumerate(slides, 1):
            p = create_carousel_slide(i, len(slides), t, pts, pid, style_name=style)
            print(f"Slide {i}: {Path(p).name}")

if __name__ == "__main__":
    main()
