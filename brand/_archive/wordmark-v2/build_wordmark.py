#!/usr/bin/env python3
"""Generate the YB800 wordmark suite.

The mark is a custom monoline wordmark: "ЮБ" built from circles, stems and a
track connector, plus "800" in the accent colour. No separate symbol, no font
dependency for the wordmark. The descriptor is outlined Arial.
"""

from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

ROOT = Path(__file__).parent
ARIAL = "/System/Library/Fonts/Supplemental/Arial.ttf"

INK = "#030712"
PAPER = "#f9fafb"
MUTED_DARK = "#9ca3af"
MUTED_LIGHT = "#4b5563"
ACCENT = "#ccff00"
TRACK = "#1e5aa8"
WHITE = "#ffffff"


def glyph_paths(text, font_path, cap_height, tracking=0):
    font = TTFont(font_path)
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()

    probe = BoundsPen(glyphs)
    glyphs[cmap[ord("Б")]].draw(probe)
    cap = probe.bounds[3]
    scale = cap_height / cap

    x = 0.0
    parts = []
    for char in text:
        glyph = glyphs[cmap[ord(char)]]
        pen = SVGPathPen(glyphs)
        glyph.draw(TransformPen(pen, (scale, 0, 0, -scale, x, cap_height)))
        commands = pen.getCommands()
        if commands:
            parts.append(commands)
        x += glyph.width * scale + tracking

    return " ".join(parts), x - tracking


DESC, DESC_WIDTH = glyph_paths(
    "СБОРНАЯ ЮРИЯ БОРЗАКОВСКОГО", ARIAL, 10, 2.2
)


def yu_b(color):
    return f'''<g stroke="{color}">
  <path d="M 8 0 V 100"/>
  <path d="M 8 50 H 48"/>
  <ellipse cx="70" cy="50" rx="38" ry="42"/>
  <g transform="translate(132 0)">
    <path d="M 8 0 V 100"/>
    <path d="M 8 8 H 84"/>
    <path d="M 8 42 H 54 A 29 29 0 0 1 54 100 H 8"/>
  </g>
</g>'''


def eight_hundred(color):
    return f'''<g stroke="{color}">
  <ellipse cx="40" cy="28" rx="23" ry="20"/>
  <ellipse cx="40" cy="72" rx="27" ry="20"/>
  <ellipse cx="128" cy="50" rx="31" ry="42"/>
  <ellipse cx="216" cy="50" rx="31" ry="42"/>
</g>'''


def wordmark(main, accent):
    return f'''<g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="16">
  {yu_b(main)}
  <g transform="translate(240 0)">{eight_hundred(accent)}</g>
</g>'''


def horizontal(main, accent, desc_color, bg=None):
    bg_rect = f'<rect width="520" height="160" fill="{bg}"/>' if bg else ""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="520" height="160" viewBox="0 0 520 160" role="img" aria-label="ЮБ800 — Сборная Юрия Борзаковского">
{bg_rect}
<g transform="translate(8 8)">{wordmark(main, accent)}</g>
<g transform="translate(8 132)"><path d="{DESC}" fill="{desc_color}"/></g>
</svg>'''


def compact(main, accent, bg=None):
    bg_rect = f'<rect width="520" height="116" fill="{bg}"/>' if bg else ""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="520" height="116" viewBox="0 0 520 116" role="img" aria-label="ЮБ800">
{bg_rect}
<g transform="translate(8 8)">{wordmark(main, accent)}</g>
</svg>'''


def stacked(main, accent, desc_color, bg=None):
    bg_rect = f'<rect width="320" height="270" fill="{bg}"/>' if bg else ""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="320" height="270" viewBox="0 0 320 270" role="img" aria-label="ЮБ800 — Сборная Юрия Борзаковского">
{bg_rect}
<g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="16">
  <g transform="translate(48 8)">{yu_b(main)}</g>
  <g transform="translate(32 128)">{eight_hundred(accent)}</g>
</g>
<g transform="translate(21 252) scale(0.8)"><path d="{DESC}" fill="{desc_color}"/></g>
</svg>'''


def icon(color, bg):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160" role="img" aria-label="ЮБ800">
  <rect x="4" y="4" width="152" height="152" rx="36" fill="{bg}"/>
  <g transform="translate(10.5 49) scale(0.62)" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="16">
    {yu_b(color)}
  </g>
</svg>'''


def write(name, content):
    (ROOT / name).write_text(content)
    print(f"{name:40} {len(content):6} bytes")


write("wordmark-horizontal-dark.svg", horizontal(PAPER, ACCENT, MUTED_DARK))
write("wordmark-horizontal-light.svg", horizontal(INK, TRACK, MUTED_LIGHT))
write("wordmark-horizontal-blue.svg", horizontal(WHITE, ACCENT, "rgba(255,255,255,0.76)"))
write("wordmark-horizontal-white.svg", horizontal(WHITE, WHITE, "rgba(255,255,255,0.7)"))
write("wordmark-horizontal-black.svg", horizontal(INK, INK, "rgba(3,7,18,0.65)"))
write("wordmark-compact-dark.svg", compact(PAPER, ACCENT))
write("wordmark-compact-light.svg", compact(INK, TRACK))
write("wordmark-compact-blue.svg", compact(WHITE, ACCENT))
write("wordmark-compact-white.svg", compact(WHITE, WHITE))
write("wordmark-compact-black.svg", compact(INK, INK))
write("wordmark-stacked-dark.svg", stacked(PAPER, ACCENT, MUTED_DARK))
write("wordmark-stacked-light.svg", stacked(INK, TRACK, MUTED_LIGHT))
write("wordmark-icon-dark.svg", icon(ACCENT, INK))
write("wordmark-icon-light.svg", icon(INK, PAPER))
write("wordmark-icon-blue.svg", icon(ACCENT, TRACK))

print(f"\nWordmark width: 496")
print(f"Descriptor width: {DESC_WIDTH:.1f}")
