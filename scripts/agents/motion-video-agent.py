#!/usr/bin/env python3
"""
Motion Graphics Video Agent v2 — Premium kinetic typography for TikTok/Reels
Learned from YouTube/TikTok viral analysis:
  - Film grain + noise texture (cinematic, not flat)
  - Floating particles for depth
  - Screen shake on word impact
  - Animated gradient backgrounds (color drift)
  - Montserrat Black 900 (not thin fonts)
  - Thick text outlines + drop shadows
  - Accent underline animations
  - Corner geometric frames
  - Smooth cross-fade transitions between scenes
  - Hormozi-style word-by-word yellow highlight
Output: 1080x1920 (9:16) MP4, 30fps
"""

import os, sys, json, asyncio, subprocess, tempfile, math, random, struct
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional
import numpy as np

from PIL import Image, ImageDraw, ImageFont, ImageFilter

# ═══════════════════════════════════════════════
# PATHS & CONFIG
# ═══════════════════════════════════════════════

ROOT = Path(__file__).resolve().parent.parent.parent
OUTPUT_DIR = ROOT / "data" / "content" / "videos"
FONTS_DIR = ROOT / "assets" / "fonts"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

W, H, FPS = 1080, 1920, 30
TRANSITION_FRAMES = 8  # frames for cross-fade between scenes

VOICES = {
    "male":   "en-US-GuyNeural",
    "female": "en-US-JennyNeural",
    "uk":     "en-GB-RyanNeural",
    "deep":   "en-US-DavisNeural",
}

# ═══════════════════════════════════════════════
# FONT SYSTEM
# ═══════════════════════════════════════════════

FONT_MAP = {
    "black":     ["Montserrat-Black.ttf", "Inter-Black.ttf"],
    "extrabold": ["Montserrat-ExtraBold.ttf", "Montserrat-Black.ttf"],
    "bold":      ["Montserrat-Bold.ttf", "Inter-Bold.ttf"],
    "semibold":  ["Inter-SemiBold.ttf", "Montserrat-Bold.ttf"],
    "medium":    ["Inter-Medium.ttf", "Montserrat-Medium.ttf"],
    "regular":   ["Inter-Regular.ttf", "Montserrat-Regular.ttf"],
    "impact":    ["BebasNeue-Regular.ttf", "Oswald-Bold.ttf"],
    "mono":      ["JetBrainsMono-Regular.ttf"],
}

SYSTEM_FALLBACKS = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
]

_font_cache = {}

def font(size, weight="bold"):
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
# STYLE PALETTES (upgraded with gradient + grain)
# ═══════════════════════════════════════════════

STYLES = {
    "hormozi_black": {
        "bg": (0, 0, 0), "bg2": (8, 8, 8),
        "fg": (255, 255, 255), "fg2": (200, 200, 200),
        "acc": (255, 215, 0), "acc2": (255, 90, 0), "acc3": (255, 50, 50),
        "dim": (70, 70, 70), "outline": (30, 30, 30),
        "grad_top": (0, 0, 0), "grad_bot": (10, 5, 0),
        "particle_col": (255, 215, 0),
        "grain_intensity": 18,
    },
    "midnight_blue": {
        "bg": (6, 6, 20), "bg2": (12, 12, 32),
        "fg": (255, 255, 255), "fg2": (185, 190, 220),
        "acc": (99, 102, 241), "acc2": (236, 72, 153), "acc3": (59, 130, 246),
        "dim": (55, 58, 90), "outline": (20, 20, 50),
        "grad_top": (6, 6, 20), "grad_bot": (12, 8, 32),
        "particle_col": (99, 102, 241),
        "grain_intensity": 14,
    },
    "dark_neon": {
        "bg": (5, 5, 10), "bg2": (10, 12, 20),
        "fg": (245, 245, 250), "fg2": (175, 180, 200),
        "acc": (0, 200, 255), "acc2": (0, 255, 140), "acc3": (160, 60, 255),
        "dim": (50, 55, 75), "outline": (15, 18, 30),
        "grad_top": (5, 5, 10), "grad_bot": (8, 15, 25),
        "particle_col": (0, 200, 255),
        "grain_intensity": 14,
    },
}

# ═══════════════════════════════════════════════
# DATA MODELS
# ═══════════════════════════════════════════════

@dataclass
class WordTimestamp:
    word: str
    start: float
    end: float

@dataclass
class Scene:
    narration: str
    scene_type: str
    headline: str = ""
    subtext: str = ""
    stats: list = field(default_factory=list)
    bullets: list = field(default_factory=list)
    before_after: tuple = ()
    accent_word: str = ""
    duration: float = 0.0

@dataclass
class VideoScript:
    hook: str
    scenes: list[Scene] = field(default_factory=list)
    cta: str = "DM 'AUTOMATE' for a free audit"
    style: str = "hormozi_black"

# ═══════════════════════════════════════════════
# EASING FUNCTIONS
# ═══════════════════════════════════════════════

def ease_out_back(t):
    c1 = 1.70158; c3 = c1 + 1
    return 1 + c3 * pow(t - 1, 3) + c1 * pow(t - 1, 2)

def ease_out_cubic(t):
    return 1 - pow(1 - t, 3)

def ease_out_elastic(t):
    if t == 0 or t == 1: return t
    return pow(2, -10 * t) * math.sin((t * 10 - 0.75) * (2 * math.pi / 3)) + 1

def ease_out_quint(t):
    return 1 - pow(1 - t, 5)

def lerp(a, b, t):
    return a + (b - a) * max(0.0, min(1.0, t))

def color_lerp(c1, c2, t):
    t = max(0.0, min(1.0, t))
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))

def _tw(d, t, f):
    b = d.textbbox((0, 0), t, font=f); return b[2] - b[0]

def _th(d, t, f):
    b = d.textbbox((0, 0), t, font=f); return b[3] - b[1]

def wrap_px(draw, text, fnt, max_w):
    words = text.split(); lines = []; cur = ""
    for w in words:
        test = f"{cur} {w}".strip()
        if _tw(draw, test, fnt) <= max_w: cur = test
        else:
            if cur: lines.append(cur)
            cur = w
    if cur: lines.append(cur)
    return lines

# ═══════════════════════════════════════════════
# PREMIUM VISUAL EFFECTS
# ═══════════════════════════════════════════════

# Pre-generate particle positions (seeded for consistency)
_rng = random.Random(42)
PARTICLES = [(
    _rng.randint(0, W), _rng.randint(0, H),
    _rng.uniform(0.3, 1.5),   # speed
    _rng.uniform(2, 6),        # size
    _rng.uniform(0, 2 * math.pi),  # phase
    _rng.uniform(0.15, 0.5),  # opacity factor
) for _ in range(60)]


def render_background(t: float, S: dict) -> Image.Image:
    """Animated gradient background with slow color drift."""
    img = Image.new("RGB", (W, H))
    arr = np.zeros((H, W, 3), dtype=np.uint8)

    # Gradient with subtle animated shift
    drift = math.sin(t * 0.3) * 8
    gt = S["grad_top"]
    gb = S["grad_bot"]
    for y in range(H):
        r = y / H
        # Add slight wave distortion to gradient
        wave = math.sin(y * 0.005 + t * 0.8) * 3
        for c in range(3):
            v = gt[c] + (gb[c] - gt[c]) * r + drift + wave
            arr[y, :, c] = max(0, min(255, int(v)))

    img = Image.fromarray(arr)
    return img


def add_film_grain(img: Image.Image, intensity: int = 18) -> Image.Image:
    """Add cinematic film grain — the premium look."""
    arr = np.array(img, dtype=np.int16)
    noise = np.random.randint(-intensity, intensity + 1, arr.shape, dtype=np.int16)
    arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)


def draw_particles(img: Image.Image, t: float, color: tuple, count: int = 40):
    """Floating particles for depth — subtle dots drifting upward."""
    d = ImageDraw.Draw(img, "RGBA")
    for i in range(min(count, len(PARTICLES))):
        px, py, speed, size, phase, opacity = PARTICLES[i]
        # Drift upward + slight horizontal sway
        y = (py - t * speed * 40) % (H + 100) - 50
        x = px + math.sin(t * 0.5 + phase) * 30
        alpha = int(255 * opacity * (0.6 + 0.4 * math.sin(t * 2 + phase)))
        # Fade near edges
        edge_fade = min(1.0, y / 200, (H - y) / 200)
        alpha = int(alpha * max(0, edge_fade))
        if alpha > 10:
            r = max(1, int(size))
            d.ellipse([x - r, y - r, x + r, y + r],
                      fill=(*color, alpha))
    return img


def draw_corner_accents(d: ImageDraw.Draw, t: float, S: dict, progress: float = 1.0):
    """Geometric corner frame lines — premium design element."""
    length = int(80 * progress)
    thickness = 2
    margin = 50
    alpha_col = color_lerp(S["bg"], S["acc"], progress * 0.4)

    # Top-left
    d.rectangle([margin, margin, margin + length, margin + thickness], fill=alpha_col)
    d.rectangle([margin, margin, margin + thickness, margin + length], fill=alpha_col)
    # Top-right
    d.rectangle([W - margin - length, margin, W - margin, margin + thickness], fill=alpha_col)
    d.rectangle([W - margin - thickness, margin, W - margin, margin + length], fill=alpha_col)
    # Bottom-left
    d.rectangle([margin, H - margin - thickness - 120, margin + length, H - margin - 120], fill=alpha_col)
    d.rectangle([margin, H - margin - length - 120, margin + thickness, H - margin - 120], fill=alpha_col)
    # Bottom-right
    d.rectangle([W - margin - length, H - margin - thickness - 120, W - margin, H - margin - 120], fill=alpha_col)
    d.rectangle([W - margin - thickness, H - margin - length - 120, W - margin, H - margin - 120], fill=alpha_col)


def draw_accent_underline(d: ImageDraw.Draw, x: int, y: int, width: int,
                          progress: float, color: tuple, thickness: int = 5):
    """Animated underline that draws itself left to right."""
    w = int(width * ease_out_cubic(progress))
    if w > 0:
        d.rounded_rectangle([x, y, x + w, y + thickness], radius=thickness // 2, fill=color)


def draw_glow(img: Image.Image, cx: int, cy: int, radius: int, color: tuple, intensity: int = 20):
    """Soft glow orb."""
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    for r in range(radius, 0, -6):
        a = min(255, max(0, int(intensity * (r / radius) ** 0.6)))
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*color, a))
    overlay = overlay.filter(ImageFilter.GaussianBlur(radius=max(1, radius // 3)))
    img.paste(Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB"))


def screen_shake(x: int, y: int, t: float, impact_t: float, magnitude: int = 12) -> tuple:
    """Screen shake offset — decays after impact moment."""
    elapsed = t - impact_t
    if elapsed < 0 or elapsed > 0.3:
        return x, y
    decay = math.exp(-elapsed * 15)
    shake_x = int(math.sin(elapsed * 60) * magnitude * decay)
    shake_y = int(math.cos(elapsed * 45) * magnitude * 0.6 * decay)
    return x + shake_x, y + shake_y


def draw_text_with_outline(d: ImageDraw.Draw, pos: tuple, text: str,
                           fnt, fill: tuple, outline_color: tuple = (0, 0, 0),
                           outline_width: int = 4):
    """Text with thick outline for readability — the Hormozi look."""
    x, y = pos
    # Draw outline
    for ox in range(-outline_width, outline_width + 1):
        for oy in range(-outline_width, outline_width + 1):
            if ox * ox + oy * oy <= outline_width * outline_width:
                d.text((x + ox, y + oy), text, fill=outline_color, font=fnt)
    # Draw text
    d.text((x, y), text, fill=fill, font=fnt)


def draw_progress_bar(d: ImageDraw.Draw, x, y, width, height, progress,
                      bg_color, fill_color, radius=8):
    d.rounded_rectangle([x, y, x + width, y + height], radius=radius, fill=bg_color)
    fill_w = int(width * max(0, min(1, progress)))
    if fill_w > radius * 2:
        d.rounded_rectangle([x, y, x + fill_w, y + height], radius=radius, fill=fill_color)


# ═══════════════════════════════════════════════
# BRANDED FOOTER (upgraded)
# ═══════════════════════════════════════════════

def draw_footer(img: Image.Image, S: dict, t: float = 0):
    d = ImageDraw.Draw(img)
    fh = 120
    by = H - fh
    # Semi-transparent bar
    overlay = Image.new("RGBA", (W, fh), (*S["bg2"], 220))
    img.paste(Image.alpha_composite(
        img.crop((0, by, W, H)).convert("RGBA"), overlay
    ).convert("RGB"), (0, by))
    d = ImageDraw.Draw(img)

    # Accent line with subtle pulse
    pulse_w = int(W * (0.7 + 0.3 * math.sin(t * 2)))
    line_x = (W - pulse_w) // 2
    d.rectangle([line_x, by, line_x + pulse_w, by + 3], fill=S["acc"])

    f_brand = font(22, "bold")
    f_handle = font(20, "medium")
    d.text((80, by + 30), "EDOUARD AUTOMATIONS", fill=S["dim"], font=f_brand)
    d.text((80, by + 58), "@edouard.automations", fill=S["acc"], font=f_handle)
    url = "edouardautomations.engineering"
    uw = _tw(d, url, f_handle)
    d.text((W - 80 - uw, by + 58), url, fill=S["dim"], font=f_handle)


# ═══════════════════════════════════════════════
# BASE FRAME — every frame starts from this
# ═══════════════════════════════════════════════

def base_frame(t: float, S: dict) -> Image.Image:
    """Create a rich base frame with gradient + particles + corner accents + grain."""
    img = render_background(t, S)
    # Convert to RGBA for particle drawing
    img = img.convert("RGBA")
    draw_particles(img, t, S["particle_col"], count=45)
    img = img.convert("RGB")
    # Corner accents
    d = ImageDraw.Draw(img)
    corner_progress = ease_out_cubic(min(1.0, t / 1.5))
    draw_corner_accents(d, t, S, corner_progress)
    return img


def finalize_frame(img: Image.Image, S: dict, t: float) -> Image.Image:
    """Add footer + grain to complete a frame."""
    draw_footer(img, S, t)
    img = add_film_grain(img, S["grain_intensity"])
    return img


# ═══════════════════════════════════════════════
# SCENE RENDERERS (v2 — premium quality)
# ═══════════════════════════════════════════════

def render_kinetic_text_frames(scene: Scene, S: dict, duration: float,
                               word_timestamps: list[WordTimestamp],
                               scene_start: float) -> list[Image.Image]:
    """Hormozi-style: words pop in with bounce + yellow highlight + screen shake + underline."""
    frames = []
    total_frames = int(duration * FPS)

    # Use Montserrat Black for maximum impact
    fnt_big = font(95, "black")
    fnt_sub = font(30, "medium")

    words = scene.headline.upper().split() if scene.headline else scene.narration.upper().split()[:12]

    # Layout words into lines
    dummy = ImageDraw.Draw(Image.new("RGB", (W, H)))
    max_w = W - 180
    lines = []
    cur_line = []
    for w in words:
        test = " ".join(cur_line + [w])
        if _tw(dummy, test, fnt_big) <= max_w: cur_line.append(w)
        else:
            if cur_line: lines.append(cur_line)
            cur_line = [w]
    if cur_line: lines.append(cur_line)

    # Flatten
    word_index = []
    for li, line_words in enumerate(lines):
        for wi, word in enumerate(line_words):
            word_index.append((li, wi, word))

    lh = _th(dummy, "AY", fnt_big) + 30
    total_text_h = len(lines) * lh
    start_y = (H - total_text_h) // 2 - 100

    # Word appear times from TTS
    word_appear_times = []
    for wt in word_timestamps:
        if wt.start >= scene_start and len(word_appear_times) < len(word_index):
            word_appear_times.append(wt.start - scene_start)
    while len(word_appear_times) < len(word_index):
        t_val = (len(word_appear_times) / max(len(word_index), 1)) * duration * 0.8
        word_appear_times.append(t_val)

    pop_duration = 0.22

    for frame_i in range(total_frames):
        t = frame_i / FPS
        img = base_frame(t, S)

        # Subtle accent glow behind text
        glow_pulse = 0.7 + 0.3 * math.sin(t * 1.5)
        draw_glow(img, W // 2, start_y + total_text_h // 2,
                  int(350 * glow_pulse), S["acc"], 10)

        d = ImageDraw.Draw(img)

        active_word_idx = -1
        for wi, appear_t in enumerate(word_appear_times):
            if t >= appear_t: active_word_idx = wi

        # Latest impact time for screen shake
        last_impact = word_appear_times[active_word_idx] if active_word_idx >= 0 else -1

        for wi, (li, word_pos_in_line, word) in enumerate(word_index):
            appear_t = word_appear_times[wi] if wi < len(word_appear_times) else 999
            if t < appear_t: continue

            pop_progress = min(1.0, (t - appear_t) / pop_duration)
            scale = ease_out_back(pop_progress)

            is_active = (wi == active_word_idx)
            is_accent = scene.accent_word and scene.accent_word.upper() in word

            if is_active:
                color = S["acc"]
            elif is_accent:
                color = S["acc2"]
            elif wi < active_word_idx:
                color = S["fg"] if wi > active_word_idx - 3 else S["fg2"]
            else:
                color = S["fg"]

            # Position
            line_words = lines[li]
            line_text = " ".join(line_words)
            line_w = _tw(d, line_text, fnt_big)
            line_x = (W - line_w) // 2

            word_idx_in_line = line_words.index(word) if word in line_words else 0
            pre_words = " ".join(line_words[:word_idx_in_line])
            x_off = _tw(d, pre_words + " ", fnt_big) if pre_words else 0
            x = line_x + x_off
            y = start_y + li * lh

            # Screen shake on latest word impact
            if is_active and pop_progress < 0.5:
                x, y = screen_shake(x, y, t, appear_t, magnitude=10)

            # Render with scale
            if scale < 0.98:
                sz = max(12, int(95 * scale))
                f_s = font(sz, "black")
                full_w = _tw(d, word, fnt_big); cur_w = _tw(d, word, f_s)
                full_h = _th(d, word, fnt_big); cur_h = _th(d, word, f_s)
                x_adj = x + (full_w - cur_w) // 2
                y_adj = y + (full_h - cur_h) // 2
                draw_text_with_outline(d, (x_adj, y_adj), word, f_s, color, S["outline"], 3)
            else:
                # Active word pulse
                if is_active:
                    pulse = 1.0 + 0.04 * math.sin(t * 10)
                    sz = max(12, int(95 * pulse))
                    f_p = font(sz, "black")
                    full_w = _tw(d, word, fnt_big); cur_w = _tw(d, word, f_p)
                    x_adj = x + (full_w - cur_w) // 2
                    draw_text_with_outline(d, (x_adj, y), word, f_p, color, S["outline"], 4)
                else:
                    draw_text_with_outline(d, (x, y), word, fnt_big, color, S["outline"], 3)

        # Animated underline after all words visible
        if active_word_idx >= len(word_index) - 1:
            ul_progress = min(1.0, (t - word_appear_times[-1]) / 0.4) if word_appear_times else 0
            ul_y = start_y + len(lines) * lh + 10
            draw_accent_underline(d, (W - 300) // 2, ul_y, 300, ul_progress, S["acc"], 5)

        # Subtext
        if scene.subtext:
            sub_progress = max(0, (t - duration * 0.55) / (duration * 0.3))
            if sub_progress > 0:
                sub_a = min(1.0, sub_progress)
                sub_col = color_lerp(S["bg"], S["fg2"], sub_a)
                sub_lines = wrap_px(d, scene.subtext, fnt_sub, W - 180)
                sy = start_y + len(lines) * lh + 50
                for sl in sub_lines[:2]:
                    sw = _tw(d, sl, fnt_sub)
                    draw_text_with_outline(d, ((W - sw) // 2, sy), sl, fnt_sub,
                                           sub_col, S["outline"], 2)
                    sy += _th(d, sl, fnt_sub) + 8

        frames.append(finalize_frame(img, S, t))

    return frames


def render_stat_counter_frames(scene: Scene, S: dict, duration: float) -> list[Image.Image]:
    """Animated stat counters with progress bars + screen shake on reveal."""
    frames = []
    total_frames = int(duration * FPS)
    fnt_title = font(48, "black")
    fnt_val = font(105, "black")
    fnt_label = font(26, "medium")
    fnt_icon = font(40, "bold")

    stats = scene.stats[:4]
    colors = [S["acc"], S["acc2"], S["acc3"], (229, 180, 56)]
    icons = [">>", "//", "##", "**"]

    for frame_i in range(total_frames):
        t = frame_i / FPS
        progress = ease_out_quint(min(1.0, t / (duration * 0.65)))

        img = base_frame(t, S)
        draw_glow(img, 180, 380, 280, S["acc"], 8)
        draw_glow(img, W - 180, H - 480, 220, S["acc3"], 6)
        d = ImageDraw.Draw(img)

        # Title slide in
        title = scene.headline or "RESULTS"
        tw_val = _tw(d, title, fnt_title)
        title_y = 200
        title_x_target = (W - tw_val) // 2
        title_x = int(lerp(-tw_val - 50, title_x_target, ease_out_cubic(min(1.0, t / 0.4))))
        draw_text_with_outline(d, (title_x, title_y), title, fnt_title, S["fg"], S["outline"], 3)

        # Accent bar
        bar_p = ease_out_cubic(min(1.0, max(0, t - 0.2) / 0.35))
        bar_w = int(250 * bar_p)
        if bar_w > 4:
            bx = (W - bar_w) // 2
            d.rounded_rectangle([bx, title_y + 68, bx + bar_w, title_y + 74], radius=3, fill=S["acc"])

        # Stats
        slot_h = (H - 550 - title_y) // max(len(stats), 1)
        for i, (label, value) in enumerate(stats):
            col = colors[i % len(colors)]
            stagger = 0.12 * i
            stat_t = max(0, t - 0.4 - stagger)
            reveal = ease_out_back(min(1.0, stat_t / 0.5))
            if reveal <= 0: continue

            sy = title_y + 130 + i * slot_h

            # Parse value
            raw = str(value)
            numeric, prefix, suffix = "", "", ""
            for ch in raw:
                if ch.isdigit() or ch == '.': numeric += ch
                elif not numeric: prefix += ch
                else: suffix += ch

            if numeric:
                target = float(numeric)
                current = target * progress * reveal
                display = f"{prefix}{int(current)}{suffix}" if '.' not in numeric else f"{prefix}{current:.1f}{suffix}"
            else:
                display = raw

            # Icon + value
            icon_x = 80
            val_x = int(lerp(W + 80, 80, reveal))

            # Shake on reveal
            if reveal < 0.6:
                val_x, sy_adj = screen_shake(val_x, sy, t, 0.4 + stagger, 8)
            else:
                sy_adj = sy

            # Icon marker
            d.text((icon_x, sy_adj + 15), icons[i % len(icons)], fill=col, font=fnt_icon)

            draw_text_with_outline(d, (val_x, sy_adj), display, fnt_val, col, S["outline"], 4)

            # Label
            label_a = min(1.0, max(0, (reveal - 0.4) * 2.5))
            label_col = color_lerp(S["bg"], S["fg2"], label_a)
            vh = _th(d, display, fnt_val)
            d.text((80, sy_adj + vh + 12), label, fill=label_col, font=fnt_label)

            # Progress bar
            bar_y = sy_adj + vh + _th(d, label, fnt_label) + 28
            draw_progress_bar(d, 80, bar_y, W - 160, 10, progress * reveal, S["dim"], col, 5)

            # Side accent
            d.rounded_rectangle([W - 82, sy_adj + 8, W - 76, sy_adj + vh],
                                radius=3, fill=col)

        frames.append(finalize_frame(img, S, t))

    return frames


def render_bullet_reveal_frames(scene: Scene, S: dict, duration: float) -> list[Image.Image]:
    """Bullets fly in with spring bounce + numbered circles + checkmark animation."""
    frames = []
    total_frames = int(duration * FPS)
    fnt_title = font(58, "black")
    fnt_bullet = font(32, "medium")
    fnt_num = font(22, "bold")

    bullets = scene.bullets[:6]
    per_bullet = duration / (len(bullets) + 1.5)

    for frame_i in range(total_frames):
        t = frame_i / FPS
        img = base_frame(t, S)
        draw_glow(img, 150, 350, 260, S["acc"], 8)
        d = ImageDraw.Draw(img)

        # Title
        title = scene.headline or "KEY POINTS"
        title_p = ease_out_cubic(min(1.0, t / 0.5))
        ty = int(lerp(140, 200, title_p))
        title_col = color_lerp(S["bg"], S["fg"], title_p)
        title_lines = wrap_px(d, title.upper(), fnt_title, W - 180)
        for tl in title_lines[:2]:
            draw_text_with_outline(d, (90, ty), tl, fnt_title, title_col, S["outline"], 3)
            ty += _th(d, tl, fnt_title) + 8

        # Underline
        ul_p = ease_out_cubic(min(1.0, max(0, t - 0.25) / 0.35))
        draw_accent_underline(d, 90, ty + 12, 200, ul_p, S["acc"], 5)

        # Bullets
        bullet_start_y = ty + 55
        bullet_h = 105

        for i, bullet_text in enumerate(bullets):
            appear_time = 0.5 + i * per_bullet
            bullet_t = max(0, t - appear_time)
            reveal = ease_out_back(min(1.0, bullet_t / 0.35))
            if reveal <= 0: continue

            by = bullet_start_y + i * bullet_h
            bx = int(lerp(-W, 90, reveal))

            # Screen shake on appear
            if reveal < 0.4:
                bx, by = screen_shake(bx, by, t, appear_time, 6)

            # Numbered circle with glow
            cr = 24
            cx = bx + cr; cy = by + cr
            # Circle glow
            if reveal > 0.5:
                d.ellipse([cx - cr - 4, cy - cr - 4, cx + cr + 4, cy + cr + 4],
                          fill=color_lerp(S["bg"], S["acc"], 0.2))
            d.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], fill=S["acc"])
            ns = str(i + 1)
            nw = _tw(d, ns, fnt_num); nh = _th(d, ns, fnt_num)
            d.text((cx - nw // 2, cy - nh // 2 - 1), ns, fill=(0, 0, 0), font=fnt_num)

            # Bullet text with outline
            tx = bx + cr * 2 + 28
            wrapped = wrap_px(d, bullet_text, fnt_bullet, W - tx - 90)
            text_y = by
            for wl in wrapped[:2]:
                bcol = color_lerp(S["bg"], S["fg"], min(1.0, reveal * 1.5))
                draw_text_with_outline(d, (tx, text_y), wl, fnt_bullet, bcol, S["outline"], 2)
                text_y += _th(d, wl, fnt_bullet) + 5

        frames.append(finalize_frame(img, S, t))

    return frames


def render_split_compare_frames(scene: Scene, S: dict, duration: float) -> list[Image.Image]:
    """Before/After with animated divider wipe + side glows."""
    frames = []
    total_frames = int(duration * FPS)
    fnt_label = font(34, "bold")
    fnt_val = font(68, "black")
    fnt_desc = font(22, "medium")

    before_items, after_items = scene.before_after if scene.before_after else ([], [])
    red = (229, 72, 77); green = S["acc2"]
    mid = W // 2

    for frame_i in range(total_frames):
        t = frame_i / FPS
        img = base_frame(t, S)

        # Side glows
        if t > 0.2:
            glow_t = min(1.0, (t - 0.2) / 0.6)
            draw_glow(img, mid // 2, H // 2, int(280 * glow_t), red, int(10 * glow_t))
            draw_glow(img, mid + mid // 2, H // 2, int(280 * glow_t), green, int(10 * glow_t))

        d = ImageDraw.Draw(img)

        # Animated divider wipe
        wipe = ease_out_cubic(min(1.0, t / 0.7))
        div_end = int((H - 120) * wipe)
        for sy in range(220, min(div_end, H - 140), 18):
            d.rectangle([mid - 1, sy, mid + 1, sy + 9], fill=S["dim"])

        # Labels with pill animation
        label_t = ease_out_back(min(1.0, max(0, t - 0.2) / 0.35))
        if label_t > 0:
            bw = int(160 * label_t)
            d.rounded_rectangle([45, 210, 45 + bw, 258], radius=24, fill=red)
            if label_t > 0.5:
                draw_text_with_outline(d, (62, 216), "BEFORE", fnt_label, (255, 255, 255), red, 2)

            aw = int(140 * label_t)
            d.rounded_rectangle([mid + 45, 210, mid + 45 + aw, 258], radius=24, fill=green)
            if label_t > 0.5:
                draw_text_with_outline(d, (mid + 62, 216), "AFTER", fnt_label, (255, 255, 255), green, 2)

        # Stats
        items = max(len(before_items), len(after_items))
        slot_h = min(280, (H - 580) // max(items, 1))

        for i in range(items):
            stagger = 0.5 + i * 0.25
            item_t = max(0, t - stagger)
            reveal = ease_out_back(min(1.0, item_t / 0.45))
            if reveal <= 0: continue

            iy = 310 + i * slot_h

            if i < len(before_items):
                bl, bv = before_items[i]
                bx = int(lerp(-250, 45, reveal))
                draw_text_with_outline(d, (bx, iy), str(bv), fnt_val, red, S["outline"], 3)
                vh = _th(d, str(bv), fnt_val)
                d.text((bx, iy + vh + 6), bl, fill=S["fg2"], font=fnt_desc)

            if i < len(after_items):
                al, av = after_items[i]
                ax = int(lerp(W + 80, mid + 45, reveal))
                draw_text_with_outline(d, (ax, iy), str(av), fnt_val, green, S["outline"], 3)
                vh = _th(d, str(av), fnt_val)
                d.text((ax, iy + vh + 6), al, fill=S["fg2"], font=fnt_desc)

        frames.append(finalize_frame(img, S, t))

    return frames


def render_cta_frames(scene: Scene, S: dict, duration: float) -> list[Image.Image]:
    """CTA with pulsing glow, button-like shape, and brand elements."""
    frames = []
    total_frames = int(duration * FPS)
    fnt_cta = font(62, "black")
    fnt_sub = font(28, "medium")
    fnt_handle = font(38, "bold")

    for frame_i in range(total_frames):
        t = frame_i / FPS
        img = base_frame(t, S)

        # Big pulsing glow
        pulse = 0.5 + 0.5 * math.sin(t * 3.5)
        draw_glow(img, W // 2, H // 2 - 80, int(380 + 80 * pulse), S["acc"], int(14 + 12 * pulse))
        d = ImageDraw.Draw(img)

        reveal = ease_out_cubic(min(1.0, t / 0.5))

        cta = scene.headline or "READY TO AUTOMATE?"
        cta_lines = wrap_px(d, cta.upper(), fnt_cta, W - 140)
        lh = _th(d, "AY", fnt_cta) + 18
        total_h = len(cta_lines) * lh
        cy = (H - total_h) // 2 - 100

        for i, line in enumerate(cta_lines[:3]):
            line_reveal = ease_out_elastic(min(1.0, max(0, reveal - i * 0.08) / 0.5))
            if line_reveal <= 0: continue
            lw = _tw(d, line, fnt_cta)
            lx = (W - lw) // 2
            scale_y = int(lerp(cy + 60, cy + i * lh, line_reveal))
            col = color_lerp(S["bg"], S["acc"], line_reveal)
            draw_text_with_outline(d, (lx, scale_y), line, fnt_cta, col, S["outline"], 4)

        # Handle
        if reveal > 0.4:
            handle_t = min(1.0, (reveal - 0.4) * 1.7)
            handle = "@edouard.automations"
            hw = _tw(d, handle, fnt_handle)
            hx = (W - hw) // 2; hy = cy + total_h + 50
            draw_text_with_outline(d, (hx, hy), handle, fnt_handle,
                                   color_lerp(S["bg"], S["fg"], handle_t), S["outline"], 2)

        # CTA button shape
        if reveal > 0.6:
            btn_t = ease_out_back(min(1.0, (reveal - 0.6) * 2.5))
            btn_text = scene.subtext or "DM 'AUTOMATE'"
            btn_fnt = font(28, "bold")
            btn_tw = _tw(d, btn_text, btn_fnt)
            btn_w = btn_tw + 80; btn_h = 65
            btn_x = (W - btn_w) // 2
            btn_y = cy + total_h + 120

            # Pulsing button
            btn_pulse = 1.0 + 0.02 * math.sin(t * 6)
            btn_w_adj = int(btn_w * btn_pulse * btn_t)
            btn_h_adj = int(btn_h * btn_t)
            btn_x_adj = (W - btn_w_adj) // 2

            if btn_w_adj > 20:
                # Button glow
                d.rounded_rectangle([btn_x_adj - 4, btn_y - 4,
                                     btn_x_adj + btn_w_adj + 4, btn_y + btn_h_adj + 4],
                                    radius=btn_h_adj // 2 + 4,
                                    fill=color_lerp(S["bg"], S["acc"], 0.3))
                d.rounded_rectangle([btn_x_adj, btn_y,
                                     btn_x_adj + btn_w_adj, btn_y + btn_h_adj],
                                    radius=btn_h_adj // 2, fill=S["acc"])
                if btn_t > 0.5:
                    d.text((btn_x_adj + (btn_w_adj - btn_tw) // 2,
                            btn_y + (btn_h_adj - _th(d, btn_text, btn_fnt)) // 2),
                           btn_text, fill=(0, 0, 0), font=btn_fnt)

        frames.append(finalize_frame(img, S, t))

    return frames


def render_hook_frames(hook_text: str, S: dict, duration: float = 2.5) -> list[Image.Image]:
    """Hook — words SLAM in with elastic bounce + screen shake + big impact."""
    frames = []
    total_frames = int(duration * FPS)
    fnt = font(105, "black")  # Montserrat Black, not BebasNeue
    fnt_sub = font(26, "medium")

    dummy = ImageDraw.Draw(Image.new("RGB", (W, H)))
    words = hook_text.upper().split()
    lines, cur = [], ""
    for w in words:
        test = f"{cur} {w}".strip()
        if _tw(dummy, test, fnt) <= W - 140: cur = test
        else:
            if cur: lines.append(cur)
            cur = w
    if cur: lines.append(cur)

    lh = _th(dummy, "AY", fnt) + 25
    total_h = len(lines) * lh
    base_y = (H - total_h) // 2 - 60

    for frame_i in range(total_frames):
        t = frame_i / FPS
        img = base_frame(t, S)

        # Big impact glow
        draw_glow(img, W // 2, base_y + total_h // 2, int(420 + 40 * math.sin(t * 3)),
                  S["acc"], int(16 + 8 * math.sin(t * 2)))
        d = ImageDraw.Draw(img)

        for i, line in enumerate(lines):
            line_delay = i * 0.12
            line_t = max(0, t - line_delay)
            scale = ease_out_elastic(min(1.0, line_t / 0.5))
            if scale <= 0: continue

            y = base_y + i * lh
            x = (W - _tw(d, line, fnt)) // 2

            # Screen shake on impact
            if scale < 0.8:
                x, y = screen_shake(x, y, t, line_delay, 14)

            # Scale via font size
            sz = max(14, int(105 * min(1.25, scale)))
            f_s = font(sz, "black")
            cur_w = _tw(d, line, f_s)
            x_adj = (W - cur_w) // 2
            cur_h = _th(d, line, f_s)
            y_adj = y + (_th(d, line, fnt) - cur_h) // 2

            # Drop shadow (offset)
            d.text((x_adj + 5, y_adj + 5), line, fill=(15, 15, 15), font=f_s)
            draw_text_with_outline(d, (x_adj, y_adj), line, f_s, S["fg"], S["outline"], 4)

        # Accent underline
        bar_t = ease_out_cubic(min(1.0, max(0, t - 0.6) / 0.4))
        if bar_t > 0:
            draw_accent_underline(d, (W - 350) // 2, base_y + total_h + 25, 350, bar_t, S["acc"], 5)

        # Brand text
        if t > 0.8:
            sub_t = min(1.0, (t - 0.8) / 0.5)
            sub = "@edouard.automations"
            sw = _tw(d, sub, fnt_sub)
            sub_col = color_lerp(S["bg"], S["acc"], sub_t)
            draw_text_with_outline(d, ((W - sw) // 2, base_y + total_h + 50), sub,
                                   fnt_sub, sub_col, S["outline"], 2)

        frames.append(finalize_frame(img, S, t))

    return frames


# ═══════════════════════════════════════════════
# TRANSITIONS
# ═══════════════════════════════════════════════

def cross_fade(frames_a: list[Image.Image], frames_b: list[Image.Image],
               n_frames: int = TRANSITION_FRAMES) -> list[Image.Image]:
    """Cross-fade the end of scene A into the start of scene B."""
    if not frames_a or not frames_b or n_frames < 1:
        return frames_a + frames_b

    result = list(frames_a[:-n_frames])
    for i in range(n_frames):
        t = (i + 1) / (n_frames + 1)
        a_idx = len(frames_a) - n_frames + i
        b_idx = i
        if a_idx < len(frames_a) and b_idx < len(frames_b):
            blended = Image.blend(frames_a[a_idx], frames_b[b_idx], t)
            result.append(blended)
    result.extend(frames_b[n_frames:])
    return result


# ═══════════════════════════════════════════════
# TTS — Edge TTS
# ═══════════════════════════════════════════════

async def generate_tts(text: str, output_path: Path,
                       voice: str = "en-US-GuyNeural",
                       rate: str = "+8%", pitch: str = "+2Hz") -> list[WordTimestamp]:
    import edge_tts
    communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    word_timestamps = []
    with open(output_path, "wb") as f:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                offset_ms = chunk.get("offset", 0) / 10_000
                duration_ms = chunk.get("duration", 0) / 10_000
                word_timestamps.append(WordTimestamp(
                    word=chunk.get("text", ""),
                    start=offset_ms / 1000,
                    end=(offset_ms + duration_ms) / 1000,
                ))
    if not word_timestamps and text.strip():
        dur = _get_audio_duration(output_path)
        words = text.split()
        weights = [max(1.0, len(w)) for w in words]
        tw_sum = sum(weights); t = 0.0
        for word, weight in zip(words, weights):
            span = dur * weight / tw_sum
            word_timestamps.append(WordTimestamp(word=word, start=t, end=t + span))
            t += span
    return word_timestamps


def _get_audio_duration(path: Path) -> float:
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
            capture_output=True, text=True, timeout=10)
        return float(result.stdout.strip())
    except Exception:
        return 5.0


# ═══════════════════════════════════════════════
# AMBIENT MUSIC
# ═══════════════════════════════════════════════

def generate_ambient_music(output_path: Path, duration: float, mood: str = "dark") -> Path:
    fade_out = max(0, duration - 4)
    configs = {
        "dark": (
            f"sine=frequency=55:duration={duration:.1f},volume=0.25",
            f"anoisesrc=colour=pink:duration={duration:.1f}:amplitude=0.015,lowpass=f=180,highpass=f=35",
            f"[0:a][1:a]amix=inputs=2:duration=first,"
            f"afade=t=in:st=0:d=3,afade=t=out:st={fade_out:.1f}:d=4,"
            f"aecho=0.8:0.88:60:0.35"),
        "energy": (
            f"sine=frequency=110:duration={duration:.1f},volume=0.2",
            f"anoisesrc=colour=brown:duration={duration:.1f}:amplitude=0.02,lowpass=f=300,highpass=f=60",
            f"[0:a][1:a]amix=inputs=2:duration=first,"
            f"afade=t=in:st=0:d=2,afade=t=out:st={fade_out:.1f}:d=3,"
            f"aecho=0.6:0.7:40:0.3"),
        "minimal": (
            f"sine=frequency=80:duration={duration:.1f},volume=0.15",
            f"anoisesrc=colour=pink:duration={duration:.1f}:amplitude=0.008,lowpass=f=120",
            f"[0:a][1:a]amix=inputs=2:duration=first,"
            f"afade=t=in:st=0:d=4,afade=t=out:st={fade_out:.1f}:d=4"),
    }
    src1, src2, filt = configs.get(mood, configs["dark"])
    subprocess.run([
        "ffmpeg", "-y", "-f", "lavfi", "-i", src1, "-f", "lavfi", "-i", src2,
        "-filter_complex", filt, "-c:a", "libmp3lame", "-b:a", "128k", str(output_path),
    ], capture_output=True, timeout=30)
    return output_path


# ═══════════════════════════════════════════════
# PIPELINE ORCHESTRATOR
# ═══════════════════════════════════════════════

SCENE_RENDERERS = {
    "kinetic_text":   render_kinetic_text_frames,
    "stat_counter":   render_stat_counter_frames,
    "bullet_reveal":  render_bullet_reveal_frames,
    "split_compare":  render_split_compare_frames,
    "cta":            render_cta_frames,
}

async def create_video(script: VideoScript, video_id: str = "motion",
                       voice: str = "male", music_mood: str = "dark") -> Path:
    S = STYLES.get(script.style, STYLES["hormozi_black"])
    work_dir = Path(tempfile.mkdtemp(prefix=f"motion_{video_id}_"))

    print(f"\n{'='*60}")
    print(f"  MOTION GRAPHICS AGENT v2 — {video_id}")
    print(f"  Style: {script.style} | Voice: {voice} | Scenes: {len(script.scenes)}")
    print(f"  Features: grain, particles, shake, transitions, outlines")
    print(f"{'='*60}")

    # ── 1. TTS ──
    print(f"\n  [1/4] Generating voiceover...")
    full_narration = " ".join(s.narration for s in script.scenes)
    vo_path = work_dir / "voiceover.mp3"
    all_ts = await generate_tts(full_narration, vo_path, voice=VOICES.get(voice, VOICES["male"]))
    vo_dur = _get_audio_duration(vo_path)
    print(f"  [✓] Voiceover: {vo_dur:.1f}s, {len(all_ts)} words")

    # ── 2. Retime ──
    _retime_scenes(script, all_ts, vo_dur)
    for i, sc in enumerate(script.scenes):
        print(f"      Scene {i+1} [{sc.scene_type}]: {sc.duration:.1f}s")

    # ── 3. Render frames ──
    print(f"\n  [2/4] Rendering premium motion graphics...")
    scene_frame_sets = []

    # Hook
    hook_frames = render_hook_frames(script.hook, S, duration=2.5)
    scene_frame_sets.append(hook_frames)
    print(f"  [✓] Hook: {len(hook_frames)} frames")

    scene_start = 0.0
    for i, sc in enumerate(script.scenes):
        renderer = SCENE_RENDERERS.get(sc.scene_type, render_kinetic_text_frames)
        scene_ts = [wt for wt in all_ts if wt.start >= scene_start
                    and wt.start < scene_start + sc.duration + 1]

        if sc.scene_type == "kinetic_text":
            sf = renderer(sc, S, sc.duration, scene_ts, scene_start)
        else:
            sf = renderer(sc, S, sc.duration)

        scene_frame_sets.append(sf)
        print(f"  [✓] Scene {i+1}: {len(sf)} frames")
        scene_start += sc.duration

    # ── 3b. Cross-fade transitions ──
    print(f"  [✓] Applying cross-fade transitions...")
    all_frames = scene_frame_sets[0]
    for sf in scene_frame_sets[1:]:
        all_frames = cross_fade(all_frames, sf, TRANSITION_FRAMES)

    total_secs = len(all_frames) / FPS
    print(f"  [✓] Total: {len(all_frames)} frames ({total_secs:.1f}s)")

    # ── 4. Music ──
    print(f"\n  [3/4] Generating ambient music...")
    music_path = work_dir / "music.mp3"
    generate_ambient_music(music_path, vo_dur + 3, mood=music_mood)

    # ── 5. Assemble ──
    print(f"\n  [4/4] Assembling final video...")
    frames_dir = work_dir / "frames"
    frames_dir.mkdir()
    for i, frame in enumerate(all_frames):
        frame.save(str(frames_dir / f"frame_{i:05d}.png"), "PNG")

    output_path = OUTPUT_DIR / f"{video_id}.mp4"
    vo_dur_total = vo_dur + 2.5

    cmd = [
        "ffmpeg", "-y",
        "-framerate", str(FPS),
        "-i", str(frames_dir / "frame_%05d.png"),
        "-i", str(vo_path),
        "-i", str(music_path),
        "-filter_complex",
        (f"[1:a]adelay=2500|2500,apad[voice];"
         f"[2:a]volume=0.28,"
         f"afade=t=in:st=0:d=2,"
         f"afade=t=out:st={max(0, vo_dur_total - 4):.1f}:d=4[music];"
         f"[voice][music]amix=inputs=2:duration=first[aout]"),
        "-map", "0:v", "-map", "[aout]",
        "-c:v", "libx264", "-preset", "veryfast",
        "-b:v", "5000k", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k",
        "-r", str(FPS),
        "-t", f"{vo_dur_total:.1f}",
        "-movflags", "+faststart",
        str(output_path),
    ]

    result = subprocess.run(cmd, capture_output=True, timeout=300)
    if result.returncode != 0:
        print(f"  [!] FFmpeg error: {result.stderr.decode()[-300:]}")
    else:
        size_mb = output_path.stat().st_size / (1024 * 1024)
        final_dur = _get_audio_duration(output_path)
        print(f"  [✓] Output: {output_path.name} ({size_mb:.1f} MB, {final_dur:.1f}s)")

    print(f"\n{'='*60}")
    print(f"  ✓ VIDEO COMPLETE: {output_path}")
    print(f"{'='*60}\n")
    return output_path


def _retime_scenes(script, word_timestamps, total_dur):
    ts_idx = 0
    for scene in script.scenes:
        words = scene.narration.split(); wc = len(words)
        if wc == 0 or ts_idx >= len(word_timestamps):
            scene.duration = 3.0; continue
        start = word_timestamps[ts_idx].start
        end_idx = min(ts_idx + wc - 1, len(word_timestamps) - 1)
        end = word_timestamps[end_idx].end
        scene.duration = max(3.0, end - start + 0.8)
        ts_idx += wc


# ═══════════════════════════════════════════════
# TEMPLATES
# ═══════════════════════════════════════════════

TEMPLATES = {
    "automation_pitch": VideoScript(
        hook="Your business is BLEEDING money",
        style="hormozi_black",
        scenes=[
            Scene(narration="Most businesses waste 20 hours a week on tasks AI can do in minutes.",
                  scene_type="kinetic_text", headline="20 HOURS WASTED EVERY WEEK", accent_word="20"),
            Scene(narration="I build AI systems that handle emails, follow-ups, and lead qualification automatically.",
                  scene_type="bullet_reveal", headline="What I Automate",
                  bullets=["Email follow-ups", "Lead qualification", "Appointment booking",
                           "CRM updates", "Client onboarding"]),
            Scene(narration="One client went from losing 60 percent of leads to capturing every single one.",
                  scene_type="split_compare",
                  before_after=([("Lead Loss", "60%"), ("Response Time", "4h"), ("Hours/Week", "20")],
                                [("Lead Loss", "3%"), ("Response Time", "30s"), ("Hours/Week", "2")])),
            Scene(narration="DM me automate for a free audit of your business.",
                  scene_type="cta", headline="READY TO AUTOMATE?",
                  subtext="DM 'AUTOMATE' for a free audit"),
        ],
    ),
    "roi_proof": VideoScript(
        hook="$127K from ONE automation",
        style="hormozi_black",
        scenes=[
            Scene(narration="Last week I sent 47 AI-crafted emails. Personalized outreach based on real business data.",
                  scene_type="kinetic_text", headline="47 AI EMAILS SENT LAST WEEK", accent_word="47"),
            Scene(narration="23 percent replied. 6 booked calls. Total pipeline value: 127 thousand dollars.",
                  scene_type="stat_counter", headline="THIS WEEK'S RESULTS",
                  stats=[("Emails Sent", "47"), ("Reply Rate", "23%"),
                         ("Meetings Booked", "6"), ("Pipeline Value", "$127K")]),
            Scene(narration="The entire system runs on autopilot. Built once. Works every day.",
                  scene_type="kinetic_text", headline="BUILT ONCE. RUNS FOREVER.", accent_word="FOREVER"),
            Scene(narration="DM me pipeline to see how this works for your business.",
                  scene_type="cta", headline="WANT THESE RESULTS?", subtext="DM 'PIPELINE' for details"),
        ],
    ),
    "agency_expose": VideoScript(
        hook="Your agency is SCAMMING you",
        style="dark_neon",
        scenes=[
            Scene(narration="They charge you 3 thousand a month to send emails you could automate for free.",
                  scene_type="kinetic_text", headline="$3K/MONTH FOR CLICKING BUTTONS", accent_word="$3K"),
            Scene(narration="I replaced an entire agency's workflow with one AI system.",
                  scene_type="split_compare",
                  before_after=([("Monthly Cost", "$3K"), ("Setup Time", "2 weeks"), ("Manual Work", "40h")],
                                [("Monthly Cost", "$0"), ("Setup Time", "48h"), ("Manual Work", "0h")])),
            Scene(narration="Personalized emails. Instant follow-ups. CRM updates. All on autopilot.",
                  scene_type="bullet_reveal", headline="All On Autopilot",
                  bullets=["Personalized emails", "Instant follow-ups", "CRM updates",
                           "Lead scoring", "Report generation"]),
            Scene(narration="Follow for more AI truths they don't want you to know.",
                  scene_type="cta", headline="FOLLOW FOR AI TRUTHS", subtext="@edouard.automations"),
        ],
    ),
    "five_automations": VideoScript(
        hook="5 things AI automates TODAY",
        style="midnight_blue",
        scenes=[
            Scene(narration="Number one. Email follow-ups that sound human, sent automatically.",
                  scene_type="kinetic_text", headline="1. EMAIL FOLLOW-UPS",
                  subtext="Sent automatically based on lead behavior", accent_word="EMAIL"),
            Scene(narration="Number two. Lead qualification. AI scores every prospect instantly.",
                  scene_type="kinetic_text", headline="2. LEAD SCORING",
                  subtext="Talk to serious buyers only", accent_word="LEAD"),
            Scene(narration="Number three. Appointment booking and client onboarding, 24 7.",
                  scene_type="kinetic_text", headline="3. BOOKING 24/7",
                  subtext="AI handles scheduling around the clock", accent_word="BOOKING"),
            Scene(narration="Number four. Review requests and number five, reporting dashboards.",
                  scene_type="stat_counter", headline="THE FULL STACK",
                  stats=[("Reviews Automated", "100%"), ("Response Time", "30s"),
                         ("Hours Saved/Week", "25"), ("ROI", "10x")]),
            Scene(narration="Save this. You'll need it.",
                  scene_type="cta", headline="SAVE THIS POST",
                  subtext="Follow @edouard.automations"),
        ],
    ),
    "before_after": VideoScript(
        hook="I automated a business in 48 HOURS",
        style="hormozi_black",
        scenes=[
            Scene(narration="Before: the owner spent 4 hours every day manually following up with leads.",
                  scene_type="kinetic_text", headline="4 HOURS EVERY DAY WASTED", accent_word="4"),
            Scene(narration="I built an AI pipeline. Scrapes leads. Qualifies them. Sends personalized outreach.",
                  scene_type="bullet_reveal", headline="The AI Pipeline",
                  bullets=["Scrapes leads automatically", "Qualifies with AI scoring",
                           "Personalized outreach", "Follow-up sequences", "CRM sync"]),
            Scene(narration="After: zero manual work. 23 percent reply rate. 6 meetings booked in week one.",
                  scene_type="stat_counter", headline="WEEK ONE RESULTS",
                  stats=[("Manual Work", "0h"), ("Reply Rate", "23%"),
                         ("Meetings Booked", "6"), ("Pipeline", "$127K")]),
            Scene(narration="DM me results to see how I can do this for your business.",
                  scene_type="cta", headline="WANT THESE RESULTS?", subtext="DM 'RESULTS' for a free consult"),
        ],
    ),
    "lead_capture": VideoScript(
        hook="You're losing leads RIGHT NOW",
        style="dark_neon",
        scenes=[
            Scene(narration="Every hour your business is closed, leads are slipping through the cracks.",
                  scene_type="kinetic_text", headline="LEADS SLIPPING AWAY", accent_word="LEADS"),
            Scene(narration="My AI responds instantly. Books appointments. Qualifies leads while you sleep.",
                  scene_type="bullet_reveal", headline="AI Works While You Sleep",
                  bullets=["Instant responses 24/7", "Books appointments automatically",
                           "Qualifies every lead", "Syncs to your CRM"]),
            Scene(narration="One practice went from 40 percent lead loss to under 5 percent overnight.",
                  scene_type="split_compare",
                  before_after=([("Lead Loss", "40%"), ("After Hours", "0 replies"), ("Revenue Lost", "$8K/mo")],
                                [("Lead Loss", "5%"), ("After Hours", "Instant AI"), ("Revenue Gained", "$12K/mo")])),
            Scene(narration="Link in bio for a free demo of the system.",
                  scene_type="cta", headline="FREE DEMO", subtext="Link in bio • See it live"),
        ],
    ),
}


# ═══════════════════════════════════════════════
# CUSTOM SCRIPT + CLI
# ═══════════════════════════════════════════════

def parse_custom_script(json_path: Path) -> VideoScript:
    data = json.loads(json_path.read_text())
    scenes = []
    for s in data.get("scenes", []):
        ba = s.get("before_after", [])
        before_after = ([tuple(x) for x in ba[0]], [tuple(x) for x in ba[1]]) if len(ba) == 2 else ()
        scenes.append(Scene(
            narration=s["narration"], scene_type=s.get("type", "kinetic_text"),
            headline=s.get("headline", ""), subtext=s.get("subtext", ""),
            stats=[tuple(x) for x in s.get("stats", [])],
            bullets=s.get("bullets", []), before_after=before_after,
            accent_word=s.get("accent_word", "")))
    return VideoScript(hook=data.get("hook", "Watch this"), scenes=scenes,
                       style=data.get("style", "hormozi_black"))


def main():
    if len(sys.argv) < 2:
        print(f"\n{'='*60}")
        print(f"  MOTION GRAPHICS VIDEO AGENT v2")
        print(f"  Premium kinetic typography for TikTok/Reels")
        print(f"  Features: grain, particles, shake, transitions, outlines")
        print(f"{'='*60}")
        print(f"\n  Commands:")
        print(f"    list                  — List templates")
        print(f"    generate <template>   — Generate from template")
        print(f"    custom <script.json>  — Generate from JSON")
        print(f"    batch                 — Generate all templates")
        print(f"\n  Options: --voice <male|female|uk|deep> --music <dark|energy|minimal> --id <id>")
        print(f"\n  Templates: {', '.join(TEMPLATES.keys())}")
        print()
        return

    cmd = sys.argv[1]; args = sys.argv[2:]
    voice, music, video_id = "male", "dark", None
    positional = []; i = 0
    while i < len(args):
        if args[i] == "--voice" and i + 1 < len(args): voice = args[i+1]; i += 2
        elif args[i] == "--music" and i + 1 < len(args): music = args[i+1]; i += 2
        elif args[i] == "--id" and i + 1 < len(args): video_id = args[i+1]; i += 2
        else: positional.append(args[i]); i += 1

    if cmd == "list":
        print(f"\n  Templates:")
        for name, s in TEMPLATES.items():
            types = ", ".join(set(sc.scene_type for sc in s.scenes))
            print(f"    {name:25s} — {s.hook}  [{types}]")
        print()
    elif cmd == "generate":
        tmpl = positional[0] if positional else "automation_pitch"
        if tmpl not in TEMPLATES:
            print(f"  Unknown: {tmpl}. Available: {', '.join(TEMPLATES.keys())}"); return
        asyncio.run(create_video(TEMPLATES[tmpl], video_id=video_id or tmpl,
                                 voice=voice, music_mood=music))
    elif cmd == "custom":
        if not positional: print("  Usage: motion-video-agent.py custom <script.json>"); return
        p = Path(positional[0])
        if not p.exists(): print(f"  Not found: {p}"); return
        asyncio.run(create_video(parse_custom_script(p), video_id=video_id or p.stem,
                                 voice=voice, music_mood=music))
    elif cmd == "batch":
        for name, script in TEMPLATES.items():
            asyncio.run(create_video(script, video_id=name, voice=voice, music_mood=music))
        print(f"\n  ✓ Batch done — {len(TEMPLATES)} videos.\n")
    else:
        print(f"  Unknown: {cmd}. Run without args for help.")


if __name__ == "__main__":
    main()
