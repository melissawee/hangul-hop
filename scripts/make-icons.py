#!/usr/bin/env python3
"""Generates every app icon for Hangul Hop from one design.

    python3 scripts/make-icons.py

Outputs into public/icons/:
  icon.svg                  rounded-square source (purpose "any")
  icon-maskable.svg         full-bleed source, art kept inside the 80% safe zone
  favicon.svg               simplified bunny for tiny sizes
  icon-192.png icon-512.png                 purpose "any"
  icon-maskable-192.png icon-maskable-512.png   purpose "maskable"
  apple-touch-icon.png      180x180, full-bleed (iOS rounds the corners itself)
  favicon-32.png favicon.ico

Needs: rsvg-convert (librsvg) and Pillow. No fonts are used: the hangul letter on
the keycap is drawn with strokes, so the SVGs render identically everywhere.
"""
import subprocess, sys, shutil
from pathlib import Path
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

INK = "#4a3b5c"

# --- the bunny, drawn on a 200x200 grid (same character as the in-game mascot) ---
BUNNY = f"""
  <ellipse cx="68" cy="50" rx="20" ry="46" fill="#fff" stroke="#f0cfe2" stroke-width="3.5" transform="rotate(-12 68 50)"/>
  <ellipse cx="68" cy="56" rx="10" ry="30" fill="#ffc9e0" transform="rotate(-12 68 56)"/>
  <ellipse cx="132" cy="50" rx="20" ry="46" fill="#fff" stroke="#f0cfe2" stroke-width="3.5" transform="rotate(12 132 50)"/>
  <ellipse cx="132" cy="56" rx="10" ry="30" fill="#ffc9e0" transform="rotate(12 132 56)"/>
  <ellipse cx="100" cy="124" rx="72" ry="58" fill="#fff" stroke="#f0cfe2" stroke-width="3.5"/>
  <path d="M146 92 l-21-10 v20 z M146 92 l21-10 v20 z" fill="#b9a4ff"/>
  <circle cx="146" cy="92" r="6.5" fill="#e2d8ff"/>
  <circle cx="54" cy="139" r="14" fill="#ffb3d1" opacity=".7"/>
  <circle cx="146" cy="139" r="14" fill="#ffb3d1" opacity=".7"/>
  <ellipse cx="76" cy="121" rx="8" ry="10.5" fill="{INK}"/><circle cx="73" cy="117" r="3.2" fill="#fff"/>
  <ellipse cx="124" cy="121" rx="8" ry="10.5" fill="{INK}"/><circle cx="121" cy="117" r="3.2" fill="#fff"/>
  <ellipse cx="100" cy="135" rx="5" ry="3.6" fill="#ff9ec7"/>
  <path d="M90 143 Q95 151 100 143 Q105 151 110 143" fill="none" stroke="{INK}" stroke-width="3.4" stroke-linecap="round"/>
"""

# --- a pastel keycap showing ㅎ, drawn from strokes (no font needed) ---
def keycap(cx, cy, s):
    return f"""
  <g transform="translate({cx} {cy}) scale({s}) translate(-60 -60)">
    <rect x="2" y="12" width="116" height="106" rx="30" fill="#d9ccff"/>
    <rect x="2" y="4" width="116" height="104" rx="30" fill="#fff" stroke="#e7defc" stroke-width="3"/>
    <rect x="12" y="12" width="96" height="48" rx="22" fill="#fff4fa" opacity=".9"/>
    <g fill="none" stroke="#8f76ee" stroke-width="9.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M60 20 V30"/><path d="M40 38 H80"/><circle cx="60" cy="68" r="19"/>
    </g>
  </g>"""

def sparkle(x, y, r, o=.9):
    return (f'<path d="M{x} {y-r} Q{x+r*.18} {y-r*.18} {x+r} {y} Q{x+r*.18} {y+r*.18} {x} {y+r} '
            f'Q{x-r*.18} {y+r*.18} {x-r} {y} Q{x-r*.18} {y-r*.18} {x} {y-r} Z" fill="#fff" opacity="{o}"/>')

def art(badge=True, bunny_scale=1.62, bunny_y=84, badge_at=(370, 368), badge_scale=1.0):
    s = bunny_scale
    tx = 256 - 100 * s - (14 if badge else 0)
    parts = [
        '<ellipse cx="248" cy="414" rx="132" ry="17" fill="#c9a8f5" opacity=".42"/>',   # soft ground shadow
        f'<g transform="translate({tx:.1f} {bunny_y}) scale({s})">{BUNNY}</g>',
    ]
    if badge:
        parts.append(keycap(badge_at[0], badge_at[1], badge_scale))
    return "\n".join(parts)

def background(kind):
    shape = {
        "rounded": '<rect width="512" height="512" rx="116" fill="url(#bg)"/>',
        "full":    '<rect width="512" height="512" fill="url(#bg)"/>',
    }[kind]
    clip = '<clipPath id="c"><rect width="512" height="512" rx="116"/></clipPath>' if kind == "rounded" else ""
    cp = ' clip-path="url(#c)"' if kind == "rounded" else ""
    return f"""
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffd1e6"/><stop offset=".55" stop-color="#ecd9ff"/><stop offset="1" stop-color="#cfe6ff"/>
    </linearGradient>
    <radialGradient id="glow" cx=".5" cy=".42" r=".55"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    {clip}
  </defs>
  {shape}
  <g{cp}>
    <circle cx="256" cy="236" r="250" fill="url(#glow)"/>
    <circle cx="70" cy="452" r="86" fill="#fff3b8" opacity=".55"/>
    <circle cx="452" cy="70" r="74" fill="#c9f3e3" opacity=".6"/>
  </g>"""

def svg(kind, badge=True, **kw):
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <title>Hangul Hop</title>{background(kind)}
  {art(badge, **kw)}
  {sparkle(92, 112, 22)}{sparkle(424, 168, 16, .85)}{sparkle(120, 330, 12, .8)}
</svg>
"""

def write(name, text):
    (OUT / name).write_text(text, encoding="utf-8")

def render(svg_name, png_name, size):
    if not shutil.which("rsvg-convert"):
        sys.exit("rsvg-convert not found (install librsvg2-bin)")
    subprocess.run(["rsvg-convert", "-w", str(size), "-h", str(size), str(OUT / svg_name), "-o", str(OUT / png_name)], check=True)

write("icon.svg", svg("rounded"))
# maskable/apple: full bleed. Everything important sits inside the central 80% circle (r=205 of 256).
write("icon-maskable.svg", svg("full", bunny_scale=1.46, bunny_y=100, badge_at=(352, 356), badge_scale=0.9))
# tiny sizes: no keycap, bigger bunny
write("favicon.svg", svg("rounded", badge=False, bunny_scale=1.7, bunny_y=80))

for size in (192, 512):
    render("icon.svg", f"icon-{size}.png", size)
    render("icon-maskable.svg", f"icon-maskable-{size}.png", size)
render("icon-maskable.svg", "apple-touch-icon.png", 180)
render("favicon.svg", "favicon-32.png", 32)

sizes = []
for n in (16, 32, 48):
    render("favicon.svg", f"_fav{n}.png", n)
    sizes.append(Image.open(OUT / f"_fav{n}.png").convert("RGBA"))
sizes[-1].save(OUT / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)], append_images=sizes[:-1])
for n in (16, 32, 48):
    (OUT / f"_fav{n}.png").unlink()
print("icons written to", OUT)
for p in sorted(OUT.iterdir()):
    print(f"  {p.name:28s}{p.stat().st_size:>8,} bytes")
