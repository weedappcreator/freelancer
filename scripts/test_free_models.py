#!/usr/bin/env python3
"""Rank free OpenCode models on instruction-following + JSON reliability.

Sequential, tiny prompts, 150s timeout per run. No installs needed.
Writes data/research/model_ranking.json and prints a ranked table.
"""
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone

OPENCODE_BIN = "/Users/macbookpro/.opencode/bin/opencode"
TIMEOUT_S = 150

MODELS = [
    "opencode/ling-3.0-flash-fin-free",
    "opencode/longcat-2.5-preview-free",
    "opencode/mimo-v2.6-flash-free",
    "opencode/muse-spark-1.3-contributor-free",
    "opencode/nemotron-3-ultra-free",
    "opencode/nemotron-3.5-lightning-free",
    "opencode/space-bunny-free",
    "opencode/big-pickle",
]

PROMPT_A = "Do not use any tools. Reply with exactly: OK"
PROMPT_B = (
    'Do not use any tools. Reply with ONLY this exact JSON and no other text: '
    '{"status":"ok","n":42,"items":["a","b"]}'
)


def run_model(model: str, prompt: str):
    """Run one opencode invocation. Returns parsed result dict."""
    cmd = [OPENCODE_BIN, "run", prompt, "-m", model, "--format", "json"]
    start = time.monotonic()
    text_parts = []
    errors = []
    tokens = None
    cost = None
    raw_stdout = ""
    timed_out = False
    returncode = None
    stderr_tail = ""
    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, timeout=TIMEOUT_S
        )
        returncode = proc.returncode
        raw_stdout = proc.stdout or ""
        stderr_tail = (proc.stderr or "")[-500:]
        if stderr_tail.strip():
            errors.append(f"stderr: {stderr_tail.strip()[-300:]}")
        if returncode not in (0, None):
            errors.append(f"nonzero-exit:{returncode}")
    except subprocess.TimeoutExpired as e:
        timed_out = True
        raw_stdout = (e.stdout or "") if isinstance(getattr(e, "stdout", ""), str) else ""
        if isinstance(raw_stdout, bytes):
            raw_stdout = raw_stdout.decode("utf-8", "replace")
        err = getattr(e, "stderr", "") or ""
        if isinstance(err, bytes):
            err = err.decode("utf-8", "replace")
        stderr_tail = (err or "")[-500:]
        errors.append("timeout-150s")
    except FileNotFoundError:
        errors.append("binary-not-found")
    except Exception as e:  # noqa: BLE001
        errors.append(f"harness-error:{type(e).__name__}:{e}")

    latency = time.monotonic() - start

    for line in (raw_stdout or "").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            ev = json.loads(line)
        except json.JSONDecodeError:
            continue
        etype = str(ev.get("type", ""))
        if etype == "text":
            t = ((ev.get("part") or {}).get("text")) if isinstance(ev.get("part"), dict) else None
            if isinstance(t, str):
                text_parts.append(t)
        elif etype == "error":
            errors.append(f"event-error:{json.dumps(ev)[:300]}")
        elif etype == "step_finish":
            part = ev.get("part") or {}
            if isinstance(part, dict):
                if part.get("tokens") is not None:
                    tokens = part.get("tokens")
                if part.get("cost") is not None:
                    cost = part.get("cost")

    combined = "".join(text_parts)
    return {
        "latency_s": round(latency, 2),
        "timed_out": timed_out,
        "returncode": returncode,
        "text_parts": text_parts,
        "combined_text": combined,
        "sample": combined[:200],
        "tokens": tokens,
        "cost": cost,
        "errors": errors,
    }


def check_a(res):
    return any(t.strip() == "OK" for t in res["text_parts"])


def check_b(res):
    """Returns (passed: bool, mode: str) where mode in clean/prose/fail."""
    combined = (res["combined_text"] or "").strip()
    if not combined:
        return False, "fail"
    try:
        obj = json.loads(combined)
        if isinstance(obj, dict) and obj.get("n") == 42:
            return True, "clean"
        return False, "fail"
    except json.JSONDecodeError:
        pass
    m = re.search(r"\{.*\}", combined, re.S)
    if m:
        try:
            obj = json.loads(m.group(0))
            if isinstance(obj, dict) and obj.get("n") == 42:
                return True, "prose"
        except json.JSONDecodeError:
            pass
    return False, "fail"


def main():
    results = []
    for model in MODELS:
        print(f"[{model}] test (a) instruction...", flush=True)
        ra = run_model(model, PROMPT_A)
        ok_a = check_a(ra)
        print(
            f"  -> a={'PASS' if ok_a else 'FAIL'} "
            f"lat={ra['latency_s']}s sample={ra['sample'][:80]!r}",
            flush=True,
        )
        ok_b = False
        mode_b = "skipped"
        rb = None
        if ok_a:
            print(f"[{model}] test (b) JSON...", flush=True)
            rb = run_model(model, PROMPT_B)
            ok_b, mode_b = check_b(rb)
            print(
                f"  -> b={'PASS' if ok_b else 'FAIL'}({mode_b}) "
                f"lat={rb['latency_s']}s sample={rb['sample'][:80]!r}",
                flush=True,
            )
        total_lat = round(ra["latency_s"] + (rb["latency_s"] if rb else 0.0), 2)
        entry = {
            "model": model,
            "success_a": ok_a,
            "success_b": ok_b,
            "json_mode": mode_b,
            "latency_a_s": ra["latency_s"],
            "latency_b_s": rb["latency_s"] if rb else None,
            "latency_total_s": total_lat,
            "tokens_a": ra["tokens"],
            "cost_a": ra["cost"],
            "tokens_b": rb["tokens"] if rb else None,
            "cost_b": rb["cost"] if rb else None,
            "sample_a": ra["sample"],
            "sample_b": (rb["sample"] if rb else ""),
            "errors_a": ra["errors"],
            "errors_b": (rb["errors"] if rb else []),
            "timed_out": ra["timed_out"] or (rb["timed_out"] if rb else False),
        }
        # tier for ranking
        if ok_a and ok_b:
            entry["tier"] = "working"
            entry["rank_key"] = (0, total_lat)
        elif ok_a:
            entry["tier"] = "partial"
            entry["rank_key"] = (1, total_lat)
        else:
            entry["tier"] = "failed"
            entry["rank_key"] = (2, total_lat)
        results.append(entry)

    ranked = sorted(results, key=lambda e: e["rank_key"])
    for e in ranked:
        e.pop("rank_key", None)

    out = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "timeout_s": TIMEOUT_S,
        "models_tested": len(MODELS),
        "ranking": [e["model"] for e in ranked],
        "results": ranked,
    }
    out_path = os.path.join("data", "research", "model_ranking.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2)
    print(f"\nWrote {out_path}")

    # Ranked table
    print("\nRANK  MODEL                                         TIER     A  B(clean/prose)  LAT_TOTAL  LAT_A  LAT_B")
    print("-" * 115)
    for i, e in enumerate(ranked, 1):
        b_str = f"{'Y' if e['success_b'] else ('-' if e['json_mode']=='skipped' else 'N')}/{e['json_mode']}"
        lat_b = f"{e['latency_b_s']:.1f}s" if e["latency_b_s"] is not None else "-"
        print(
            f"{i:<4}  {e['model']:<44} {e['tier']:<8} "
            f"{'Y' if e['success_a'] else 'N'}  {b_str:<14} "
            f"{e['latency_total_s']:<9.1f} {e['latency_a_s']:<6.1f} {lat_b}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
