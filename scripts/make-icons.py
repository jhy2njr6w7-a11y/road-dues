# Run: python3 scripts/make-icons.py assets   (needs Pillow and the Inter font)
# Parking+ icon: the blue UAE parking-sign "P" on the app's ink colour, with a small green tick
# badge (paid). Writes icon.png, adaptive-icon.png, splash-icon.png at 1024px into argv[1].
import sys
from PIL import Image, ImageDraw, ImageFont
OUT = sys.argv[1]
INK = (14, 17, 22, 255); BLUE = (26, 86, 184, 255); WHITE = (255, 255, 255, 255); GREEN = (21, 128, 61, 255)
FONT = '/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf'
S = 4  # supersample

def mark(size, scale):
    """Blue rounded tile with P and a paid tick, centred on a transparent square of `size`."""
    W = size * S
    im = Image.new('RGBA', (W, W), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    t = int(W * scale); x0 = (W - t) // 2; y0 = x0
    d.rounded_rectangle([x0, y0, x0 + t, y0 + t], radius=int(t * 0.24), fill=BLUE)
    f = ImageFont.truetype(FONT, int(t * 0.74))
    bb = d.textbbox((0, 0), 'P', font=f)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    d.text((x0 + (t - tw) / 2 - bb[0], y0 + (t - th) / 2 - bb[1]), 'P', font=f, fill=WHITE)
    # tick badge at the lower right, ringed in ink so it reads on any background
    r = int(t * 0.2); cx = x0 + t - int(r * 0.55); cy = y0 + t - int(r * 0.55); ring = int(r * 0.22)
    d.ellipse([cx - r - ring, cy - r - ring, cx + r + ring, cy + r + ring], fill=INK)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=GREEN)
    w = max(2, int(r * 0.3))
    d.line([(cx - r * 0.45, cy + r * 0.02), (cx - r * 0.1, cy + r * 0.38), (cx + r * 0.5, cy - r * 0.35)], fill=WHITE, width=w, joint='curve')
    return im.resize((size, size), Image.LANCZOS)

def on_ink(img):
    bg = Image.new('RGBA', img.size, INK); bg.alpha_composite(img); return bg

on_ink(mark(1024, 0.58)).convert('RGB').save(f'{OUT}/icon.png')          # iOS: full square, system rounds it
mark(1024, 0.46).save(f'{OUT}/adaptive-icon.png')                         # Android: inside the 66% safe zone
mark(1024, 0.42).save(f'{OUT}/splash-icon.png')                           # shown on the ink splash colour
