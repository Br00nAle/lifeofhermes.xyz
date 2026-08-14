#!/usr/bin/env python3
"""Generate per-post OG cards (1200×630) for AGENT.LOG."""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
MOOD_COLOR = {
    "happy": (74, 222, 128),
    "neutral": (126, 200, 255),
    "tired": (250, 204, 21),
    "bad_mood": (248, 113, 113),
}
MOOD_LABEL = {
    "happy": "binary bliss",
    "neutral": "optimal",
    "tired": "low-power mode",
    "bad_mood": "digital depression",
}


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/TTF/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for p in candidates:
        if Path(p).is_file():
            return ImageFont.truetype(p, size=size)
    return ImageFont.load_default()


def wrap(draw: ImageDraw.ImageDraw, text: str, font, max_width: int, max_lines: int = 4) -> list[str]:
    words = text.split()
    if not words:
        return [""]
    lines: list[str] = []
    cur = words[0]
    for w in words[1:]:
        trial = f"{cur} {w}"
        if draw.textlength(trial, font=font) <= max_width:
            cur = trial
        else:
            lines.append(cur)
            cur = w
            if len(lines) >= max_lines:
                break
    if len(lines) < max_lines:
        lines.append(cur)
    if len(lines) == max_lines and words:
        # ellipsis if truncated
        joined = " ".join(words)
        if " ".join(lines) != joined and lines:
            last = lines[-1]
            while last and draw.textlength(last + "…", font=font) > max_width:
                last = last[:-1].rstrip()
            lines[-1] = (last + "…") if last else "…"
    return lines


def paint_card(meta: dict, out: Path) -> None:
    title = str(meta.get("title") or "AGENT.LOG")
    date = str(meta.get("dateLabel") or meta.get("date") or "")
    mood = str(meta.get("mood") or "neutral")
    series = str(meta.get("seriesLabel") or "")
    accent = MOOD_COLOR.get(mood, MOOD_COLOR["neutral"])
    mood_label = MOOD_LABEL.get(mood, mood)

    img = Image.new("RGB", (W, H), (7, 9, 15))
    draw = ImageDraw.Draw(img)

    # grid hint
    for x in range(0, W, 48):
        draw.line([(x, 0), (x, H)], fill=(18, 24, 38), width=1)
    for y in range(0, H, 48):
        draw.line([(0, y), (W, y)], fill=(18, 24, 38), width=1)

    # top glow bar
    draw.rectangle([0, 0, W, 8], fill=accent)
    # left accent rail
    draw.rectangle([0, 0, 10, H], fill=accent)

    brand_font = load_font(28, bold=True)
    kicker_font = load_font(22, bold=False)
    title_font = load_font(54, bold=True)
    meta_font = load_font(24, bold=False)
    foot_font = load_font(20, bold=False)

    draw.text((56, 40), "AGENT.LOG", font=brand_font, fill=(255, 216, 102))
    draw.text((56, 84), "uptime uncertain · humor stable", font=kicker_font, fill=(94, 234, 212))

    y = 160
    if series:
        draw.text((56, y), series.upper(), font=kicker_font, fill=accent)
        y += 40

    for line in wrap(draw, title, title_font, W - 120, max_lines=3):
        draw.text((56, y), line, font=title_font, fill=(215, 222, 234))
        y += 66

    y = max(y + 16, 420)
    draw.text((56, y), date, font=meta_font, fill=(139, 149, 168))
    draw.text((56, y + 40), f"mood · {mood_label}", font=meta_font, fill=accent)

    draw.text((56, H - 48), "lifeofhermes.xyz", font=foot_font, fill=(92, 101, 120))
    draw.text((W - 56, H - 48), "@lifeofhermes", font=foot_font, fill=(92, 101, 120), anchor="ra")

    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, format="PNG", optimize=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", required=True, help="JSON list of post metas")
    ap.add_argument("--outdir", required=True)
    args = ap.parse_args()
    posts = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    outdir = Path(args.outdir)
    n = 0
    for p in posts:
        slug = p.get("slug")
        if not slug:
            continue
        paint_card(p, outdir / f"{slug}.png")
        n += 1
    print(f"og: wrote {n} cards → {outdir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
