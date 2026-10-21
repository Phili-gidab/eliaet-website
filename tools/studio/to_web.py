"""Copy the studio renders into the site as WebP (web/public/media/studio, media/3d), at their rendered size and in
the smaller copies the pages list in srcset (name-480/-720/-960/-1280.webp, as tools/media_variants.py would, which
then leaves them alone). From the 16-bit renders, with a light dither, so the dark backdrop's gradients do not band;
encoded by sharp (webp.mjs). python3 to_web.py [name ...]"""
import os, sys, shutil, subprocess, tempfile
import cv2, numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
MEDIA = os.path.join(HERE, '..', '..', 'web', 'public', 'media')
WIDTHS, MARGIN = (480, 720, 960, 1280), 1.25
JOBS = {   # render -> site file, quality
    'head': ('studio/goods-head.webp', 86),
    'styles': ('studio/goods-styles.webp', 86),
    'aalf': ('studio/aalf-boot.webp', 86),
    'sectors': ('studio/goods-sectors.webp', 86),
    'lone': ('studio/boot-alone.webp', 86),
    'detail': ('studio/tote-detail.webp', 86),
    'card': ('studio/member-card.webp', 86),
    's3d_tote': ('3d/tote.webp', 88),
    's3d_boot': ('3d/boot.webp', 88),
}
rng = np.random.default_rng(7)


def load(path):
    im = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    return im.astype(np.float32) / (65535.0 if im.dtype == np.uint16 else 255.0)


def write(x, dst, q):
    """x: float 0..1, BGR(A) as cv2 reads it"""
    y = x * 255.0
    n = rng.random(y.shape[:2], dtype=np.float32) - rng.random(y.shape[:2], dtype=np.float32)
    n = n[..., None].repeat(y.shape[2], axis=2) * 0.75
    if y.shape[2] == 4:
        n[..., 3] = 0
    y = np.clip(np.round(y + n), 0, 255).astype(np.uint8)
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as t:
        tmp = t.name
    cv2.imwrite(tmp, y)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    r = subprocess.run(['node', os.path.join(HERE, 'webp.mjs'), tmp, dst, str(q)], capture_output=True, text=True, cwd=HERE)
    os.unlink(tmp)
    return r.stdout.strip() or r.stderr.strip()


names = [n for n in (sys.argv[1:] or list(JOBS)) if n in JOBS]
for n in names:
    src = os.path.join(OUT, n + '.png')
    if not os.path.exists(src):
        print('missing', src); continue
    rel, q = JOBS[n]
    dst = os.path.join(MEDIA, rel)
    x = load(src)
    if x.shape[2] == 4:                       # premultiply for resizing, so edges do not darken
        x[..., :3] *= x[..., 3:4]
    H, W = x.shape[:2]
    outs = [(W, dst)] + [(w, dst[:-5] + '-%d.webp' % w) for w in WIDTHS if W >= w * MARGIN]
    for w, path in outs:
        h = round(H * w / W)
        y = x if w == W else cv2.resize(x, (w, h), interpolation=cv2.INTER_AREA)
        if y.shape[2] == 4:
            a = np.maximum(y[..., 3:4], 1e-6); y = y.copy(); y[..., :3] = np.where(y[..., 3:4] > 0, y[..., :3] / a, 0)
        print(n, '->', write(y, path, q))

# two small crops for the inlays in the home page's title (pills about 1.5 by 0.8 of a letter's height)
INLAYS = {'inlay-stitch': ('detail', (0.30, 0.34, 0.62, 0.50)), 'inlay-boots': ('head', (0.56, 0.47, 0.98, 0.70))}
for name, (src, (x0, y0, x1, y1)) in INLAYS.items():
    p = os.path.join(OUT, src + '.png')
    if not os.path.exists(p) or src not in names:
        continue
    x = load(p); H, W = x.shape[:2]
    c = x[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)]
    c = cv2.resize(c, (288, round(288 * c.shape[0] / c.shape[1])), interpolation=cv2.INTER_AREA)
    print(name, '->', write(c, os.path.join(MEDIA, 'studio', name + '.webp'), 86))
for g in ('tote.glb', 'boot.glb'):
    s = os.path.join(HERE, 'models', g)
    if os.path.exists(s):
        d = os.path.join(MEDIA, '3d', g); os.makedirs(os.path.dirname(d), exist_ok=True)
        shutil.copyfile(s, d); print(g, os.path.getsize(d) // 1024, 'kB')
