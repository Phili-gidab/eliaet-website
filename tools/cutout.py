"""Cut the subject out of a photograph, for the magazine spreads (web/src/components/Spread.astro): the headline is
set between the photograph and its subject, so the subject stands in front of the type, as on a magazine cover.

The cut is made locally: a depth estimate of the photograph (MiDaS v2.1 small, ONNX) marks what is near; OpenCV's
GrabCut, seeded with it, finds the subject's outline; a guided filter softens the outline along the photograph's own
edges. The result is the whole photograph's size, transparent everywhere but the subject, so it lies exactly over
the photograph.

    python3 tools/cutout.py <midas onnx> <out dir> [name ...]

The settings for each photograph are in SHOTS below: what counts as near (a share of the depth range), where the
subject can be (a box, as shares of the frame), and areas that are surely background. A debug picture of each cut
goes next to it (<name>-check.jpg)."""
import sys, os
import numpy as np
import cv2
import onnxruntime as ort

MEDIA = os.path.join(os.path.dirname(__file__), '..', 'web', 'public', 'media')

# near: depth at or above which a pixel is probably the subject; far: below which it is surely not; core: surely
# the subject. box: x0, y0, x1, y1 where the subject can be. bg: boxes that are surely background. key: a colour
# backdrop to key out instead of depth (BGR, tolerance).
# zones: (box, near, core) where the subject is less near than the rest (a figure further back) and the thresholds
# are lower. sky: (box, ...) where the sky's blue and the white of the clouds are surely background.
SHOTS = {
    'highland-sheep': dict(src='profile/highland-sheep.webp', near=0.50, far=0.32, core=0.72, box=(0.12, 0.22, 1.0, 1.0),
                           bg=[(0, 0, 1, 0.18), (0.96, 0.55, 1, 0.8)], sky=[(0, 0, 1, 0.62)]),
    'lounge-wide': dict(src='fair/lounge-wide.webp', near=0.40, far=0.26, core=0.6, box=(0.0, 0.14, 1.0, 1.0),
                        bg=[(0, 0, 1, 0.1), (0, 0, 0.075, 0.6)]),
    'shepherd': dict(src='profile/shepherd.webp', near=0.55, far=0.40, core=0.78, box=(0.0, 0.3, 1.0, 1.0), bg=[(0, 0, 1, 0.36)],
                     zones=[((0.43, 0.36, 0.585, 0.7), 0.28, 0.4)], sky=[(0, 0, 1, 0.42)]),
    'carousel-0': dict(src='carousel-0.webp', near=0.45, far=0.28, core=0.7, box=(0.0, 0.0, 1.0, 1.0), bg=[]),
    'carousel-3': dict(src='carousel-3.webp', key=((244, 219, 196), 34), box=(0.0, 0.0, 1.0, 1.0), bg=[]),
    'fair-stand': dict(src='profile/fair-stand.webp', near=0.55, far=0.38, core=0.78, box=(0.0, 0.0, 0.36, 1.0), bg=[(0.36, 0, 1, 1)]),
}


def depth(sess, img):
    h, w = img.shape[:2]
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    x = cv2.resize(rgb, (256, 256), interpolation=cv2.INTER_AREA)
    x = (x - np.array([0.485, 0.456, 0.406], np.float32)) / np.array([0.229, 0.224, 0.225], np.float32)
    x = x.transpose(2, 0, 1)[None].astype(np.float32)
    out = sess.run(None, {sess.get_inputs()[0].name: x})[0][0]
    d = cv2.resize(out, (w, h), interpolation=cv2.INTER_CUBIC)
    lo, hi = np.percentile(d, 1), np.percentile(d, 99.5)
    return np.clip((d - lo) / (hi - lo), 0, 1)


def guided(I, p, r, eps):
    """He et al.'s guided filter: p smoothed, but keeping I's edges (I and p float32, 0..1)."""
    mean = lambda a: cv2.boxFilter(a, -1, (2 * r + 1, 2 * r + 1), borderType=cv2.BORDER_REFLECT)
    mI, mp = mean(I), mean(p)
    a = (mean(I * p) - mI * mp) / (mean(I * I) - mI * mI + eps)
    b = mp - a * mI
    return mean(a) * I + mean(b)


def boxmask(shape, box):
    h, w = shape
    m = np.zeros((h, w), bool)
    x0, y0, x1, y1 = box
    m[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)] = True
    return m


def cut(sess, name, s, out_dir):
    img = cv2.imread(os.path.join(MEDIA, s['src']), cv2.IMREAD_COLOR)
    h, w = img.shape[:2]
    inside = boxmask((h, w), s['box'])
    sure_bg = ~inside
    for b in s['bg']:
        sure_bg |= boxmask((h, w), b)
    mask = np.full((h, w), cv2.GC_PR_BGD, np.uint8)
    if 'key' in s:
        col, tol = s['key']
        dist = np.linalg.norm(img.astype(np.float32) - np.array(col, np.float32), axis=2)
        mask[dist < tol * 1.6] = cv2.GC_PR_BGD
        mask[dist < tol] = cv2.GC_BGD
        mask[dist > tol * 2.4] = cv2.GC_PR_FGD
        mask[dist > tol * 3.5] = cv2.GC_FGD
        d = None
    else:
        d = depth(sess, img)
        mask[d >= s['near']] = cv2.GC_PR_FGD
        mask[d >= s['core']] = cv2.GC_FGD
        mask[d < s['far']] = cv2.GC_BGD
        for box, near, core in s.get('zones', []):
            z = boxmask((h, w), box)
            mask[z & (d >= near)] = cv2.GC_PR_FGD
            mask[z & (d >= core)] = cv2.GC_FGD
    mask[sure_bg] = cv2.GC_BGD
    for box in s.get('sky', []):
        f = img.astype(np.float32)
        b, g, r = f[..., 0], f[..., 1], f[..., 2]
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.float32)
        sky = ((b - r) > 18) | ((hsv[..., 2] > 205) & (hsv[..., 1] < 34))
        mask[boxmask((h, w), box) & sky & (mask != cv2.GC_FGD)] = cv2.GC_BGD
    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(img, mask, None, bgd, fgd, 6, cv2.GC_INIT_WITH_MASK)
    fg = ((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD)).astype(np.uint8)
    # tidy: close small gaps, drop specks, fill holes
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, k)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(fg, 8)
    keep = np.zeros_like(fg)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] > 0.004 * h * w:
            keep[lab == i] = 1
    inv = (1 - keep).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(inv, 4)
    for i in range(1, n):
        x, y, bw, bh, area = stats[i]
        touches = x == 0 or y == 0 or x + bw == w or y + bh == h
        if not touches and area < 0.002 * h * w:
            keep[lab == i] = 1
    # soft edge: the hard cut, smoothed along the photograph's edges, kept hard well inside and well outside
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0
    r = max(4, round(min(h, w) / 220))
    a = guided(gray, keep.astype(np.float32), r, 1e-3)
    inner = cv2.erode(keep, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)))
    outer = cv2.dilate(keep, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)))
    a = np.where(inner > 0, 1.0, np.where(outer == 0, 0.0, np.clip(a, 0, 1)))
    alpha = (a * 255).astype(np.uint8)
    rgba = np.dstack([img, alpha])
    out = os.path.join(out_dir, f'{name}-cut.webp')
    cv2.imwrite(out, rgba, [cv2.IMWRITE_WEBP_QUALITY, 88])
    # the check picture: the cut on amber, beside the depth
    amber = np.zeros_like(img); amber[:] = (37, 160, 226)
    comp = (img * a[..., None] + amber * (1 - a[..., None])).astype(np.uint8)
    side = cv2.applyColorMap((d * 255).astype(np.uint8), cv2.COLORMAP_INFERNO) if d is not None else img
    edge = img.copy()
    cnts, _ = cv2.findContours(keep, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cv2.drawContours(edge, cnts, -1, (255, 0, 255), max(1, w // 600))
    row = np.hstack([cv2.resize(x, (w // 2, h // 2)) for x in (edge, comp, side)])
    cv2.imwrite(os.path.join(out_dir, f'{name}-check.jpg'), row, [cv2.IMWRITE_JPEG_QUALITY, 82])
    print(name, f'{w}x{h}', f'subject {keep.mean() * 100:.1f}% of the frame', os.path.getsize(out) // 1024, 'KB')


if __name__ == '__main__':
    model, out_dir = sys.argv[1], sys.argv[2]
    names = sys.argv[3:] or list(SHOTS)
    os.makedirs(out_dir, exist_ok=True)
    sess = ort.InferenceSession(model, providers=['CPUExecutionProvider'])
    for n in names:
        cut(sess, n, SHOTS[n], out_dir)
