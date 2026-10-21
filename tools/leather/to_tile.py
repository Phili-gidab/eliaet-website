"""A hide tile from hide_tile.py (rendered with a 32-pixel margin) → the site's three files in web/public/media/leather:
<tone>.webp (desktop), <tone>-2x.webp (sharp desktop screens), <tone>-m.webp (phones). styles/leather.css shows the
square 880 pixels across (640 on a phone). The light tan has much more fine detail to store, so it goes a size smaller.

    python3 tools/leather/to_tile.py <render.webp|png> <chestnut|saddle|tan> [out dir]
"""
import os
import sys
from PIL import Image

src, tone = sys.argv[1], sys.argv[2]
out = sys.argv[3] if len(sys.argv) > 3 else os.path.join(os.path.dirname(__file__), '..', '..', 'web', 'public', 'media', 'leather')
B = 32
SIZES = {   # file suffix: (pixels, WebP quality)
    'chestnut': {'': (1100, 62), '-2x': (2200, 58), '-m': (1400, 56)},
    'saddle': {'': (1100, 62), '-2x': (2200, 58), '-m': (1400, 56)},
    'tan': {'': (1100, 56), '-2x': (1600, 55), '-m': (1100, 50)},
}[tone]
im = Image.open(src).convert('RGB')
n = im.size[0] - 2 * B
t = im.crop((B, B, B + n, B + n))
os.makedirs(out, exist_ok=True)
for suf, (px, q) in SIZES.items():
    s = t if px == n else t.resize((px, px), Image.LANCZOS)
    f = os.path.join(out, f'{tone}{suf}.webp')
    s.save(f, 'WEBP', quality=q, method=6)
    print(f, px, round(os.path.getsize(f) / 1024), 'kB')
