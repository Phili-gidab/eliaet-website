"""Smaller copies of the large photos in web/public/media, for phones and small windows.

For every photo wider than it needs to be, writes name-480.webp and name-720.webp (and name-960.webp and
name-1280.webp when the photo is big enough) next to it. The pages list these copies in srcset (web/src/lib/media.ts
finds them by name), so a phone downloads a copy its size instead of the full picture. Run it again after adding or
replacing a large photo:

    python tools/media_variants.py            (needs Pillow: pip install pillow)

Logos, icons and the link-preview image are left alone. Copies that already exist and are newer than the photo are
kept, so it only does the work that is new."""
import os
import re
import sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web', 'public', 'media')
SKIP_DIRS = {'partners', 'gov-partners', 'icons', 'mdgs', 'og', 'texture'}
WIDTHS = (480, 720, 960, 1280)
MARGIN = 1.25         # a copy is made only if the photo is at least this much wider than it
QUALITY = 76


def is_variant(name):
    return re.search(r'-(480|640|720|960|1280)$', os.path.splitext(name)[0]) is not None


def main():
    made = kept = 0
    for dirpath, dirnames, files in os.walk(ROOT):
        rel = os.path.relpath(dirpath, ROOT)
        if rel.split(os.sep)[0] in SKIP_DIRS:
            continue
        for f in sorted(files):
            if not f.endswith('.webp') or is_variant(f):
                continue
            src = os.path.join(dirpath, f)
            with Image.open(src) as im:
                w, h = im.size
                for vw in WIDTHS:
                    if w < vw * MARGIN:
                        continue
                    out = os.path.join(dirpath, '%s-%d.webp' % (os.path.splitext(f)[0], vw))
                    if os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(src):
                        kept += 1
                        continue
                    vh = round(h * vw / w)
                    mode = 'RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB'
                    im.convert(mode).resize((vw, vh), Image.LANCZOS).save(out, 'WEBP', quality=QUALITY, method=6)
                    made += 1
                    print('%-40s %5d -> %4d  %4d KB' % (os.path.relpath(out, ROOT), w, vw, os.path.getsize(out) // 1024))
    print('made %d, already there %d' % (made, kept))


if __name__ == '__main__':
    sys.exit(main())
