# Run: python3 scripts/make-icons.py assets   (needs Pillow and the Inter font)
# Parking+ icon: a white car seen from above (two headlights at the front, four tyres) with a P on its roof and a "+" beside it, on the app's ink
# colour. Writes icon.png (iOS, full square), adaptive-icon.png (Android foreground inside the 66% safe
# zone, transparent) and splash-icon.png (transparent, shown on the ink splash colour) at 1024 px.
import math
import sys
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1]
S = 1024
INK = (14, 17, 22, 255)
WHITE = (255, 255, 255, 255)
GLASS = (178, 182, 190, 255)
TYRE = (120, 126, 136, 255)
FONT = '/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf'
SS = 4  # supersample for smooth edges


def mark(scale):
    """The car and plus, centred on a transparent square; scale 1.0 fills the icon like the iOS version."""
    W = S * SS
    im = Image.new('RGBA', (W, W), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    k = SS * scale; cx = W / 2; cy = W / 2
    def box(x0, y0, x1, y1):  # coordinates in the 1024 design, around the centre
        return [cx + (x0 - 512) * k, cy + (y0 - 512) * k, cx + (x1 - 512) * k, cy + (y1 - 512) * k]
    for ty in (300, 640):                                                                # tyres poking out at both axles
        for tx in (286, 694):
            d.rounded_rectangle(box(tx, ty, tx + 44, ty + 118), radius=14 * k, fill=TYRE)
    d.rounded_rectangle(box(312, 150, 712, 874), radius=170 * k, fill=WHITE)            # body
    # headlights: slanted lenses along the curve of the front corners, left and right
    for mx, ang in ((405, 137), (619, 43)):
        a, b, t = 48, 15, math.radians(ang)
        pts = [(mx + a * math.cos(u) * math.cos(t) - b * math.sin(u) * math.sin(t),
                205 + a * math.cos(u) * math.sin(t) + b * math.sin(u) * math.cos(t)) for u in (i * math.pi / 36 for i in range(72))]
        d.polygon([(cx + (x - 512) * k, cy + (y - 512) * k) for x, y in pts], fill=INK)
    d.rounded_rectangle(box(360, 250, 664, 360), radius=40 * k, fill=GLASS)              # windscreen
    d.rounded_rectangle(box(360, 690, 664, 780), radius=40 * k, fill=GLASS)              # rear window
    f = ImageFont.truetype(FONT, int(260 * k)); bb = d.textbbox((0, 0), 'P', font=f)
    d.text((cx - (bb[2] - bb[0]) / 2 - bb[0], cy + 13 * k - (bb[3] - bb[1]) / 2 - bb[1]), 'P', font=f, fill=INK)
    r, w = 60 * k, 32 * k; px, py = cx + 288 * k, cy - 282 * k                          # the "+"
    d.rounded_rectangle([px - r, py - w / 2, px + r, py + w / 2], radius=w / 2, fill=WHITE)
    d.rounded_rectangle([px - w / 2, py - r, px + w / 2, py + r], radius=w / 2, fill=WHITE)
    return im.resize((S, S), Image.LANCZOS)


def on_ink(img):
    bg = Image.new('RGBA', img.size, INK); bg.alpha_composite(img); return bg


on_ink(mark(1.0)).convert('RGB').save(f'{OUT}/icon.png')
mark(0.62).save(f'{OUT}/adaptive-icon.png')
mark(0.5).save(f'{OUT}/splash-icon.png')
