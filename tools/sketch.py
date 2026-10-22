"""Draw a cut-out as a pencil sketch, for the faint drawings behind a section's text (components/Sketch.astro).

The drawing is the photograph's own tones turned to graphite, the way a pencil sketch is made from a photograph by
hand: the grey of the picture divided by a blurred copy of its negative (a colour dodge) keeps only what changes, the
outlines and the texture of wool and cloth, as a pencil would lay them down; a little paper grain breaks the strokes.
It is saved as brown "ink" whose opacity is the pencil's density, cropped to the subject.

With it go the two paths that draw it in on the page: one round the subject's outline, then one that goes back and
forth over it, like a hand shading; the page reveals the drawing along them (a mask), so it appears as it is drawn.

    python3 tools/sketch.py <cut.webp> <name> [--floor y] [--alpha 0.5] [--blur 12] [--gamma 2] [--width 1100]

Writes web/public/media/sketch/<name>.webp and web/src/data/sketches/<name>.json (its size and the two paths)."""
import argparse
import json
import math
import os
import numpy as np
import cv2
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
INK = (60, 30, 22)        # the brand brown, RGB


def rdp(pts, eps):
    pts = np.asarray(pts, float)
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    ab = b - a
    n = math.hypot(*ab)
    v = pts - a
    d = np.abs(ab[0] * v[:, 1] - ab[1] * v[:, 0]) / n if n else np.hypot(v[:, 0], v[:, 1])
    i = int(np.argmax(d))
    if d[i] > eps:
        return np.vstack([rdp(pts[:i + 1], eps)[:-1], rdp(pts[i:], eps)])
    return np.vstack([a, b])


def d_of(polys):
    out = []
    for p in polys:
        p = np.round(np.asarray(p, float)).astype(int)
        out.append(f'M{p[0][0]} {p[0][1]}' + ''.join(f'l{q[0] - r[0]} {q[1] - r[1]}' for r, q in zip(p, p[1:])))
    return ''.join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cut'); ap.add_argument('name')
    ap.add_argument('--floor', type=int, default=0, help='leave out everything below this row (the ground a cut stands on)')
    ap.add_argument('--alpha', type=float, default=0.5, help='opacity above which the cut counts as the subject')
    ap.add_argument('--blur', type=float, default=9, help='the dodge blur: larger keeps more of the tone')
    ap.add_argument('--levels', default='0.08,0.7', help='the greys that become paper, and those that become full pencil')
    ap.add_argument('--gamma', type=float, default=1.0, help='larger lays the pencil heavier')
    ap.add_argument('--width', type=int, default=1100, help="the drawing's width, px")
    ap.add_argument('--grain', type=float, default=0.75, help='how much the paper breaks the strokes')
    ap.add_argument('--quality', type=int, default=72, help='WebP quality (the drawing is shown faint)')
    o = ap.parse_args()

    rgba = cv2.imread(o.cut, cv2.IMREAD_UNCHANGED).astype(np.float32) / 255
    a = rgba[..., 3].copy()
    if o.floor:
        a[o.floor:] = 0
    comp = rgba[..., :3] * a[..., None] + (1 - a[..., None])
    g = cv2.cvtColor((comp * 255).astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.float32) / 255

    # the colour dodge: what changes stays, what is flat goes to paper
    b = cv2.GaussianBlur(1 - g, (0, 0), o.blur)
    dark = 1 - np.clip(g / np.maximum(1 - b, 1e-3), 0, 1)
    # the faintest greys go back to paper and the rest darkens, as a pencil leaves white between its strokes
    lo, hi = (float(v) for v in o.levels.split(','))
    dark = np.clip((dark - lo) / (hi - lo), 0, 1) ** (1 / o.gamma)
    rng = np.random.default_rng(3)
    grain = cv2.GaussianBlur(rng.random(g.shape).astype(np.float32), (0, 0), 0.8)
    dark *= np.clip(1 - o.grain * 0.5 + grain * o.grain, 0, 1)
    m = (a > o.alpha).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    soft = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.5)
    dark *= soft

    ys, xs = np.nonzero(dark > 0.03)
    H0, W0 = dark.shape
    x0, y0 = max(int(xs.min()) - 6, 0), max(int(ys.min()) - 6, 0)
    x1, y1 = min(int(xs.max()) + 7, W0), min(int(ys.max()) + 7, H0)
    s = o.width / (x1 - x0)
    W, H = o.width, int(round((y1 - y0) * s))
    crop = cv2.resize(dark[y0:y1, x0:x1], (W, H), interpolation=cv2.INTER_AREA)
    mask = cv2.resize(m[y0:y1, x0:x1], (W, H), interpolation=cv2.INTER_NEAREST)

    img = np.zeros((H, W, 4), np.uint8)
    img[..., 0], img[..., 1], img[..., 2] = INK                                # RGB
    img[..., 3] = np.clip(crop * 255, 0, 255).astype(np.uint8)
    out_img = os.path.join(ROOT, 'web', 'public', 'media', 'sketch', f'{o.name}.webp')
    os.makedirs(os.path.dirname(out_img), exist_ok=True)
    # the picture is all one colour: the drawing is in its opacity, which may be stored lossy like the rest
    Image.fromarray(img, 'RGBA').save(out_img, 'WEBP', quality=o.quality, alpha_quality=o.quality, method=6)

    # the outline, as a hand would go round it
    cs, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    outline = [rdp(c[:, 0, :], 2.0) for c in sorted(cs, key=lambda c: -len(c)) if len(c) > 40]
    # then shading, back and forth across it at a slant, only where the subject is
    grow = cv2.dilate(mask, np.ones((25, 25), np.uint8))
    ang = math.radians(32)
    dvec, nvec = np.array([math.cos(ang), -math.sin(ang)]), np.array([math.sin(ang), math.cos(ang)])
    corners = np.array([[0, 0], [W, 0], [0, H], [W, H]], float)
    pn, pd = corners @ nvec, corners @ dvec
    step = 38
    fill, cur, flip = [], [], False
    for off in np.arange(pn.min(), pn.max(), step):
        ts = np.arange(pd.min(), pd.max(), 4.0)
        pts = nvec * off + np.outer(ts, dvec)
        xi, yi = pts[:, 0].astype(int), pts[:, 1].astype(int)
        ok = (xi >= 0) & (yi >= 0) & (xi < W) & (yi < H)
        inside = np.zeros(len(pts), bool)
        inside[ok] = grow[yi[ok], xi[ok]] > 0
        idx = np.nonzero(inside)[0]
        if not len(idx):
            continue
        p0, p1 = pts[idx[0]], pts[idx[-1]]
        a_, b_ = (p1, p0) if flip else (p0, p1)
        if cur and math.dist(cur[-1], a_) > step * 3.2:
            fill.append(cur); cur = []
        cur += [tuple(a_), tuple(b_)]
        flip = not flip
    if cur:
        fill.append(cur)

    data = {'w': W, 'h': H, 'outline': d_of(outline), 'fill': d_of(fill)}
    out_json = os.path.join(ROOT, 'web', 'src', 'data', 'sketches', f'{o.name}.json')
    os.makedirs(os.path.dirname(out_json), exist_ok=True)
    json.dump(data, open(out_json, 'w'))
    print(f'{out_img}: {W}x{H}, {os.path.getsize(out_img) // 1024} kB; paths {len(data["outline"]) + len(data["fill"])} chars')


if __name__ == '__main__':
    main()
