#!/usr/bin/env python3
"""Strict YB800 wordmark in Futura Bold.

Nike Futura ND is a proprietary Nike font and is not installed here. This draft
uses Futura Bold, the closest available geometric sans with Cyrillic support.
Replace FUTURA with the licensed Nike Futura ND file to get the exact cut.
"""

from pathlib import Path
from fontTools.ttLib import TTCollection
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

ROOT = Path(__file__).parent
FUTURA = "/System/Library/Fonts/Supplemental/Futura.ttc"

INK = "#030712"
PAPER = "#f9fafb"
ACCENT = "#ccff00"
TRACK = "#1e5aa8"
WHITE = "#ffffff"


def load_futura_bold():
    collection = TTCollection(FUTURA)
    for font in collection.fonts:
        name = font["name"].getDebugName(4) or ""
        if "Bold" in name and "Condensed" not in name:
            return font
    return collection.fonts[2]


FONT = load_futura_bold()


def text_path(text, cap_height, tracking=0):
    glyphs = FONT.getGlyphSet()
    cmap = FONT.getBestCmap()

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


FULL, FULL_WIDTH = text_path("ЮБ800", 100, 0)
YU_B, YU_B_WIDTH = text_path("ЮБ", 100, 0)
EIGHT, EIGHT_WIDTH = text_path("800", 100, 0)


def wordmark(main, accent=None):
    if accent is None:
        return f'<path d="{FULL}" fill="{main}"/>'
    return (
        f'<path d="{YU_B}" fill="{main}"/>'
        f'<g transform="translate({YU_B_WIDTH:.3f} 0)">'
        f'<path d="{EIGHT}" fill="{accent}"/>'
        f"</g>"
    )


def svg(main, accent=None, bg=None):
    bg_rect = f'<rect width="560" height="132" fill="{bg}"/>' if bg else ""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="560" height="132" viewBox="0 0 560 132" role="img" aria-label="ЮБ800">
{bg_rect}
<g transform="translate(16 16)">{wordmark(main, accent)}</g>
</svg>'''


def write(name, content):
    (ROOT / name).write_text(content)
    print(f"{name:36} {len(content):6} bytes")


write("logo-wordmark-dark.svg", svg(PAPER))
write("logo-wordmark-light.svg", svg(INK))
write("logo-wordmark-blue.svg", svg(WHITE))
write("logo-wordmark-white.svg", svg(WHITE))
write("logo-wordmark-black.svg", svg(INK))
write("logo-wordmark-accent-dark.svg", svg(PAPER, ACCENT))
write("logo-wordmark-accent-light.svg", svg(INK, TRACK))
write("logo-wordmark-accent-blue.svg", svg(WHITE, ACCENT))

# Favicon: strict "800" on graphite. The wordmark's digits are wide, so the
# icon uses a tighter cap height with even margins.
ICON_EIGHT, ICON_WIDTH = text_path("800", 20, 0)
ICON_X = (64 - ICON_WIDTH) / 2
ICON_Y = 22
write(
    "icon-800.svg",
    f'''<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="ЮБ800">
  <rect x="2" y="2" width="60" height="60" rx="14" fill="{INK}"/>
  <g transform="translate({ICON_X:.3f} {ICON_Y})">
    <path d="{ICON_EIGHT}" fill="{ACCENT}"/>
  </g>
</svg>''',
)

print(f"\nWordmark width: {FULL_WIDTH:.2f}")
print(f"ЮБ width: {YU_B_WIDTH:.2f}")
print(f"800 width: {EIGHT_WIDTH:.2f}")
