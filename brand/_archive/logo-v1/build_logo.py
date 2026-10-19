#!/usr/bin/env python3
"""Generate the YB800 logo suite as SVG.

The mark is a custom Cyrillic "Ю": a start/finish line, a lane connector and
a stadium-shaped track oval. The wordmark continues with "Б800", so the full
lockup reads "ЮБ800". The type is converted to outlines with fontTools, so the
SVGs do not depend on a font being installed.
"""

from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

ROOT = Path(__file__).parent
ARIAL_BLACK = "/System/Library/Fonts/Supplemental/Arial Black.ttf"
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


WORD, WORD_WIDTH = glyph_paths("Б800", ARIAL_BLACK, 100, -2)
DESC, DESC_WIDTH = glyph_paths(
    "БЕГОВОЙ КЛУБ ЮРИЯ БОРЗАКОВСКОГО", ARIAL, 10, 2.2
)


def mark(color, x=0, y=0, scale=1):
    return f'''<g transform="translate({x} {y}) scale({scale})" fill="{color}" stroke="{color}">
  <rect x="0" y="0" width="18" height="100" rx="4" stroke="none"/>
  <rect x="18" y="41" width="42" height="18" stroke="none"/>
  <rect x="60" y="8" width="52" height="84" rx="26" fill="none" stroke-width="16"/>
  <rect x="76" y="24" width="20" height="52" rx="10" fill="none" stroke-width="2" opacity="0.45"/>
</g>'''


def horizontal(mark_color, text_color, desc_color, bg=None):
    bg_rect = f'<rect width="580" height="160" fill="{bg}"/>' if bg else ""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="580" height="160" viewBox="0 0 580 160" role="img" aria-label="ЮБ800 — беговой клуб Юрия Борзаковского">
{bg_rect}
{mark(mark_color)}
<g transform="translate(140 0)">
  <path d="{WORD}" fill="{text_color}"/>
</g>
<g transform="translate(140 122)">
  <path d="{DESC}" fill="{desc_color}"/>
</g>
</svg>'''


def compact(mark_color, text_color, bg=None):
    bg_rect = f'<rect width="540" height="110" fill="{bg}"/>' if bg else ""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="540" height="110" viewBox="0 0 540 110" role="img" aria-label="ЮБ800">
{bg_rect}
{mark(mark_color)}
<g transform="translate(140 0)">
  <path d="{WORD}" fill="{text_color}"/>
</g>
</svg>'''


def vertical(mark_color, text_color, desc_color, bg=None):
    bg_rect = f'<rect width="320" height="250" fill="{bg}"/>' if bg else ""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="320" height="250" viewBox="0 0 320 250" role="img" aria-label="ЮБ800 — беговой клуб Юрия Борзаковского">
{bg_rect}
{mark(mark_color, 100, 0)}
<g transform="translate(28 150) scale(0.7)">
  <path d="{WORD}" fill="{text_color}"/>
</g>
<g transform="translate(22 240) scale(0.8)">
  <path d="{DESC}" fill="{desc_color}"/>
</g>
</svg>'''


def icon(mark_color, bg):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160" role="img" aria-label="ЮБ800">
  <rect x="4" y="4" width="152" height="152" rx="36" fill="{bg}"/>
  {mark(mark_color, 20, 30)}
</svg>'''


def write(name, content):
    (ROOT / name).write_text(content)
    print(f"{name:38} {len(content):6} bytes")


write("logo-horizontal-dark.svg", horizontal(ACCENT, PAPER, MUTED_DARK))
write("logo-horizontal-light.svg", horizontal(INK, INK, MUTED_LIGHT))
write("logo-horizontal-blue.svg", horizontal(ACCENT, WHITE, "rgba(255,255,255,0.76)"))
write("logo-horizontal-white.svg", horizontal(WHITE, WHITE, "rgba(255,255,255,0.7)"))
write("logo-horizontal-black.svg", horizontal(INK, INK, "rgba(3,7,18,0.65)"))
write("logo-compact-dark.svg", compact(ACCENT, PAPER))
write("logo-compact-light.svg", compact(INK, INK))
write("logo-compact-blue.svg", compact(ACCENT, WHITE))
write("logo-compact-white.svg", compact(WHITE, WHITE))
write("logo-compact-black.svg", compact(INK, INK))
write("logo-vertical-dark.svg", vertical(ACCENT, PAPER, MUTED_DARK))
write("logo-vertical-light.svg", vertical(INK, INK, MUTED_LIGHT))
write("logo-icon-dark.svg", icon(ACCENT, INK))
write("logo-icon-light.svg", icon(INK, PAPER))
write("logo-icon-blue.svg", icon(ACCENT, TRACK))
write(
    "logo-mark.svg",
    f'''<svg xmlns="http://www.w3.org/2000/svg" width="120" height="100" viewBox="0 0 120 100" role="img" aria-label="ЮБ800">
{mark(ACCENT)}
</svg>''',
)

print(f"\nWordmark width: {WORD_WIDTH:.1f}")
print(f"Descriptor width: {DESC_WIDTH:.1f}")
