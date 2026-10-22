"""Cut the subject out of a photograph for the magazine spreads (web/src/components/Spread.astro), with a
salient-object model: the headline is set between the photograph and its subject, so the subject stands in front of
the type, as on a magazine cover.

    python3 tools/segment.py <model dir> <out dir> [name ...]

<model dir> holds the ONNX models of the rembg project (github.com/danielgatis/rembg, releases v0.0.0):
BiRefNet-general-bb_swin_v1_tiny-epoch_232.onnx and isnet-general-use.onnx. Each photograph's cut is the model's
matte (SHOTS says which model, and what to leave out), its edge colours taken from inside the subject so no
background shows round it. The cut is the photograph's own size, transparent but for the subject, so it lies exactly
over the photograph: web/public/media/cut/<name>.webp. A check picture of each goes to <out dir>."""
import sys, os
import numpy as np
import cv2
import onnxruntime as ort
sys.path.insert(0, os.path.dirname(__file__))
from cutout import depth  # MiDaS: the near ground goes in front of the type with the subject

ROOT = os.path.join(os.path.dirname(__file__), '..')
MEDIA = os.path.join(ROOT, 'web', 'public', 'media')

# model: 'birefnet' or 'isnet' (or 'max' of both). drop: boxes (shares of the frame) whose subject is cleared, for
# things the model counts as subject that should stay behind the type (far animals, a stand's furniture).
SHOTS = {
    'highland-sheep': dict(src='profile/highland-sheep.webp', model='isnet', drop=[], ground=(0.7, 0.78, 0.6), matte=True, band=10, exclude=('green', 'cloud')),
    'shepherd': dict(src='profile/shepherd.webp', model='isnet', drop=[], ground=(0.74, 0.84, 0.6), matte=True, band=8, exclude=('cloud',)),
    'lounge-wide': dict(src='fair/lounge-wide.webp', model='isnet', speck=0.05, ground=(0.72, 0.82, 0.62),
                        drop=[(0.5556, 0.36, 0.5767, 0.42), (0.636, 0.3, 0.745, 0.358), (0.487, 0.62, 0.605, 0.74)]),
    'fair-stand': dict(src='profile/fair-stand.webp', model='isnet', drop=[(0.47, 0, 1, 1), (0.26, 0.0, 0.47, 0.62)]),
    'carousel-0': dict(src='carousel-0.webp', model='isnet', drop=[], fill=0.03, matte=True, band=8),
    'carousel-3': dict(src='carousel-3.webp', model='isnet', drop=[]),
    # the covers (components/Cover.astro): studio photographs, the subject alone on the page's colour
    'aalf-model-5': dict(studio=True, src='AALF-model-5.webp', model='isnet', drop=[],
                         holes=[(0.36, 0.6, 0.5, 0.8), (0.64, 0.66, 0.8, 0.88)]),
    'aalf-model-3': dict(studio=True, src='AALF-model-3.webp', model='isnet', drop=[]),
    'samra-leather': dict(studio=True, src='samra-leather.webp', model='isnet', drop=[]),
    'sheep-solo': dict(src='profile/highland-sheep.webp', model='isnet', drop=[], matte=True, band=10, exclude=('green', 'cloud'), shadow=dict(squash=0.14, skew=0.9)),
    'sheep-ridge': dict(src='profile/highland-sheep.webp', model='isnet', drop=[], ground=(0.7, 0.78, 0.6), nosky=True, fade=(0.22, 0.06)),
    'herder': dict(src='EHL01.webp', model='isnet', drop=[], matte=True, band=8, exclude=('green', 'cloud'), crop=True, shadow=dict(squash=0.12, skew=1.4, pad=0.3)),
    'herder-rock': dict(src='EHL01.webp', model='isnet', drop=[], ground=(0.62, 0.74, 0.7), nosky=True, crop=True, env=1.6, fade=(0.3, 0.3)),
    'ribbon': dict(src='carousel-5.webp', model='isnet', drop=[]),
    'messenger': dict(studio=True, src='home/leather1.webp', model='isnet', drop=[], matte=True, band=6, shadow=dict(squash=0.1, skew=1.0, pad=0.3)),
}

MODELS = {
    'birefnet': ('BiRefNet-general-bb_swin_v1_tiny-epoch_232.onnx', (0.485, 0.456, 0.406), (0.229, 0.224, 0.225), True),
    'isnet': ('isnet-general-use.onnx', (0.5, 0.5, 0.5), (1.0, 1.0, 1.0), False),
}
_sessions = {}


def session(model_dir, key):
    if key not in _sessions:
        # BiRefNet at 1024 squared needs a lot of memory: no arena, no pattern planning
        o = ort.SessionOptions(); o.intra_op_num_threads = 2
        o.enable_cpu_mem_arena = False; o.enable_mem_pattern = False
        _sessions.clear()
        _sessions[key] = ort.InferenceSession(os.path.join(model_dir, MODELS[key][0]), o, providers=['CPUExecutionProvider'])
    return _sessions[key]


def matte(model_dir, key, img):
    """The model's matte for a BGR picture, 0..1 at the picture's size."""
    _, mean, std, sigmoid = MODELS[key]
    s = session(model_dir, key)
    h, w = img.shape[:2]
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    x = cv2.resize(rgb, (1024, 1024), interpolation=cv2.INTER_LANCZOS4).astype(np.float32)
    x = x / max(float(x.max()), 1e-6)
    x = (x - np.array(mean, np.float32)) / np.array(std, np.float32)
    x = x.transpose(2, 0, 1)[None].astype(np.float32)
    out = s.run(None, {s.get_inputs()[0].name: x})[0][0, 0]
    if sigmoid:
        out = 1 / (1 + np.exp(-out))
    out = (out - out.min()) / max(out.max() - out.min(), 1e-6)
    return np.clip(cv2.resize(out, (w, h), interpolation=cv2.INTER_LANCZOS4), 0, 1)


def bleed(img, a, power=2):
    """The subject's colours carried out over its soft edge, so no background colour is left round it."""
    solid = (a > 0.97).astype(np.uint8)
    if solid.sum() == 0:
        return img
    f = img.astype(np.float32) * solid[..., None]
    wsum = solid.astype(np.float32)
    acc, wacc = f.copy(), wsum.copy()
    for r in (3, 7, 15, 31):
        k = (2 * r + 1, 2 * r + 1)
        bf = cv2.blur(f, k); bw = cv2.blur(wsum, k)
        fill = (wacc < 0.5) & (bw > 1e-3)
        acc[fill] = bf[fill] / bw[fill][..., None]
        wacc[fill] = 1
    soft = (a > 0.02) & (a <= 0.97)
    out = img.astype(np.float32).copy()
    # keep a little of the photograph's own edge (fine wool and hair), the more the more opaque; against a studio's
    # plain backdrop (power 4) far less, or its grey would ring the hair
    k = (a[soft] ** power)[..., None]
    out[soft] = acc[soft] * (1 - k) + out[soft] * k
    return np.clip(out, 0, 255).astype(np.uint8)


def midas_session(model_dir):
    if 'midas' not in _sessions:
        _sessions['midas'] = ort.InferenceSession(os.path.join(model_dir, 'model-small.onnx'), providers=['CPUExecutionProvider'])
    return _sessions['midas']


def spread_from(val, mask, radii=(3, 7, 15, 31, 63)):
    """val (H x W or H x W x C) carried out from where mask is set, nearest first."""
    m = mask.astype(np.float32)
    v = val.astype(np.float32) * (m[..., None] if val.ndim == 3 else m)
    acc, got = v.copy(), m.copy()
    for r in radii:
        k = (2 * r + 1, 2 * r + 1)
        bv = cv2.blur(v, k); bw = cv2.blur(m, k)
        fill = (got < 0.5) & (bw > 1e-4)
        acc[fill] = bv[fill] / (bw[fill][..., None] if val.ndim == 3 else bw[fill])
        got[fill] = 1
    return acc


def studio_edge(img, a, holes_in=()):
    """A subject on a studio's plain backdrop: along its outline the matte is measured again from how much darker
    each pixel is than the backdrop there (hair and leather are darker), and the backdrop's colour is taken out of
    the edge, so no grey rings the hair. Where the subject is as light as the backdrop (a white skirt) the model's
    matte stands."""
    f = img.astype(np.float32) / 255.0
    L = 0.0722 * f[..., 0] + 0.7152 * f[..., 1] + 0.2126 * f[..., 2]
    hard = (a > 0.5).astype(np.uint8)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41))
    band = (cv2.dilate(hard, k) > 0) & (cv2.erode(hard, k) == 0)
    bg = a < 0.02
    Lb = spread_from(L, bg)                      # the backdrop's lightness, carried in under the subject
    B = spread_from(f, bg)                       # and its colour
    solid = cv2.erode(hard, k) > 0
    Lf = spread_from(L, solid)                   # the subject's own lightness, carried out to its edge
    gap = Lb - Lf
    key = np.clip((Lb - L) / np.maximum(gap, 0.05), 0, 1)
    conf = np.clip((gap - 0.12) / 0.18, 0, 1)    # how far the subject is from the backdrop's lightness
    a2 = a.copy()
    a2[band] = (conf * np.minimum(a, key ** 0.9) + (1 - conf) * a)[band]
    # the backdrop seen through the subject (between an arm and the body): pieces inside the outline as light as
    # the backdrop and of its colour, not touching the frame's edge (a white skirt does), are taken out, their edge
    # keyed like the outline's
    # (only inside the boxes a shot names: a white shirt between the jacket's fronts is as light as the backdrop)
    h, w = a.shape
    Bg = np.median(f[bg], axis=0) if bg.any() else np.array([0.9, 0.9, 0.9], np.float32)
    Lbg = float(0.0722 * Bg[0] + 0.7152 * Bg[1] + 0.2126 * Bg[2])
    where = np.zeros((h, w), bool)
    for box in holes_in:
        where |= boxmask((h, w), box)
    like = where & (np.abs(f - Bg).max(axis=2) < 0.1) & (L > Lbg - 0.1) & (a > 0.5)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(like.astype(np.uint8), 8)
    holes = np.zeros_like(like)
    for i in range(1, n):
        x, y, bw, bh, area = stats[i]
        if area >= 40:
            holes |= lab == i
    if holes.any():
        ring = cv2.dilate(holes.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))) > 0
        a2[holes] = 0
        edge2 = ring & ~holes
        a2[edge2] = np.minimum(a2, np.clip(key, 0, 1) ** 0.9)[edge2]
        band = band | ring
    # the backdrop taken out of the edge's colour: F = (I - (1 - a) B) / a
    al = np.clip(a2, 1e-3, 1)[..., None]
    F = np.clip((f - (1 - al) * B) / al, 0, 1)
    edge = band & (a2 > 0.01) & (a2 < 0.995)
    out = f.copy(); out[edge] = F[edge]
    return (out * 255 + 0.5).astype(np.uint8), a2


def cast_shadow(rgba, squash=0.16, skew=0.55, blur=0.022, strength=0.42, contact=0.6, pad=0.12):
    """A shadow layer under a cut-out, on a canvas grown at the foot and to the right so it has room. Each figure
    (each piece of the cut-out that is big enough) throws its own: its silhouette laid down flat behind it (squashed
    to `squash` of its height, slanted by `skew`), blurred, plus a tight dark contact shadow along where it stands."""
    h, w = rgba.shape[:2]
    a = rgba[..., 3].astype(np.float32) / 255.0
    ph, pw = int(pad * h * 0.6), int(pad * w)
    H, W = h + ph, w + pw
    shadow = np.zeros((H, W), np.float32)
    hard = (a > 0.5).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(hard, 8)
    big = stats[1:, cv2.CC_STAT_AREA].max() if n > 1 else 0
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] < 0.08 * big:
            continue
        m = (lab == i)
        ys, xs = np.nonzero(m)
        base = int(np.percentile(ys, 99.5))           # where it stands
        top = ys.min()
        fh = max(1, base - top)
        # the silhouette laid down: each row at height d above the foot goes to d * squash behind it, slanted right
        sil = (a * m).astype(np.float32)
        M = np.float32([[1, skew * squash * 0 + skew, -skew * base], [0, squash, base * (1 - squash) - 0]])
        # x' = x + skew * (base - y) * squash ; y' = base - (base - y) * squash
        M = np.float32([[1, -skew * squash, skew * squash * base], [0, squash, base * (1 - squash)]])
        laid = cv2.warpAffine(sil, M, (W, H), flags=cv2.INTER_LINEAR, borderValue=0)
        k = max(3, int(blur * fh * 6) | 1)
        laid = cv2.GaussianBlur(laid, (k, k), 0) * strength
        # contact: the bottom edge of the figure, pressed flat and dark
        foot = np.zeros((H, W), np.float32)
        band = m & (np.arange(h)[:, None] > base - max(3, int(0.04 * fh)))
        fys, fxs = np.nonzero(band)
        for x0 in np.unique(fxs):
            pass
        if fxs.size:
            foot_band = np.zeros((H, W), np.float32)
            foot_band[base - 2: base + 3, fxs.min(): fxs.max() + 1] = 1
            kk = max(3, int(0.05 * fh) | 1)
            foot = cv2.GaussianBlur(foot_band, (kk * 2 + 1, kk | 1), 0) * contact
        shadow = np.maximum(shadow, np.clip(laid + foot, 0, 1))
    A = np.zeros((H, W), np.float32); A[:h, :w] = a
    C = np.zeros((H, W, 3), np.float32); C[:h, :w] = rgba[..., :3].astype(np.float32)
    dark = np.array([22, 30, 60], np.float32)        # the brand's brown (BGR)
    S = shadow * (1 - A)
    out_a = A + S
    out_c = (C * A[..., None] + dark * S[..., None]) / np.maximum(out_a, 1e-4)[..., None]
    out = np.dstack([np.clip(out_c, 0, 255), np.clip(out_a * 255, 0, 255)]).astype(np.uint8)
    return out


def refine_matte(img, a, band=12, holes=(), surely_not=()):
    """The outline drawn again by closed-form alpha matting (pymatting): the model's cut says what is surely the
    subject and surely not, and along the outline (a band either side) the matte is solved from the photograph's own
    colours, so wool, fur and hair keep their fine edge; then the subject's colours are estimated there without the
    background's (no fringe). holes: boxes (shares of the frame) where backdrop seen through the subject (between an
    arm and the body) is surely background."""
    from pymatting import estimate_alpha_cf, estimate_foreground_ml
    h, w = a.shape
    a = a.copy()
    if holes:
        f = img.astype(np.float32) / 255.0
        bgm = a < 0.02
        Bg = np.median(f[bgm], axis=0) if bgm.any() else np.array([0.9, 0.9, 0.9], np.float32)
        where = np.zeros((h, w), bool)
        for box in holes:
            where |= boxmask((h, w), box)
        like = where & (np.abs(f - Bg).max(axis=2) < 0.1)
        n, lab, stats, _ = cv2.connectedComponentsWithStats(like.astype(np.uint8), 8)
        for i in range(1, n):
            if stats[i, cv2.CC_STAT_AREA] >= 40:
                a[lab == i] = 0
    ys, xs = np.nonzero(a > 0.05)
    m = band * 3
    y0, y1 = max(0, ys.min() - m), min(h, ys.max() + m + 1)
    x0, x1 = max(0, xs.min() - m), min(w, xs.max() + m + 1)
    I = cv2.cvtColor(img[y0:y1, x0:x1], cv2.COLOR_BGR2RGB).astype(np.float64) / 255.0
    A = a[y0:y1, x0:x1]
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * band + 1, 2 * band + 1))
    fg = cv2.erode((A > 0.9).astype(np.uint8), k) > 0
    bg = cv2.dilate((A > 0.1).astype(np.uint8), k) == 0
    tri = np.full(A.shape, 0.5, np.float64); tri[fg] = 1; tri[bg] = 0
    # what the subject is surely not, wherever it lies along the outline: grass and leaves (green over red and blue),
    # cloud and sky (light, without colour); none of the sheep or the herder's skin is either
    if surely_not:
        hsv = cv2.cvtColor(img[y0:y1, x0:x1], cv2.COLOR_BGR2HSV).astype(np.float32) / 255.0
        b_, g_, r_ = [img[y0:y1, x0:x1][..., i].astype(np.float32) for i in range(3)]
        no = np.zeros(A.shape, bool)
        if 'green' in surely_not:
            no |= g_ > np.maximum(r_, b_) + 10
        if 'cloud' in surely_not:
            no |= (hsv[..., 2] > 0.8) & (hsv[..., 1] < 0.13)
        tri[no & ~fg] = 0
    alpha = np.clip(estimate_alpha_cf(I, tri), 0, 1)
    F = estimate_foreground_ml(I, alpha)
    out_a = np.zeros((h, w), np.float32); out_a[y0:y1, x0:x1] = alpha
    out = img.copy()
    out[y0:y1, x0:x1] = cv2.cvtColor((np.clip(F, 0, 1) * 255 + 0.5).astype(np.uint8), cv2.COLOR_RGB2BGR)
    return out, out_a


def boxmask(shape, box):
    h, w = shape
    m = np.zeros((h, w), bool)
    x0, y0, x1, y1 = box
    m[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)] = True
    return m


def cut(model_dir, name, s, check_dir, keys):
    img = cv2.imread(os.path.join(MEDIA, s['src']), cv2.IMREAD_COLOR)
    h, w = img.shape[:2]
    mats = {k: matte(model_dir, k, img) for k in keys}
    a = np.maximum(*mats.values()) if s['model'] == 'max' and len(mats) > 1 else mats.get(s['model'], next(iter(mats.values())))
    for b in s['drop']:
        a[boxmask((h, w), b)] = 0
    # the model is unsure inside some subjects (a dress, a hide): there the type would show through. The subject is
    # made solid: its body is what is surely in (holes filled), and only its edge keeps the model's softness
    hard = (a > s.get('cut', 0.45)).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(hard, 8)
    big = stats[1:, cv2.CC_STAT_AREA].max() if n > 1 else 0
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] < s.get('speck', 0.01) * big:
            hard[lab == i] = 0
    inv = (1 - hard).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(inv, 4)
    for i in range(1, n):
        x, y, bw, bh, area = stats[i]
        if not (x == 0 or y == 0 or x + bw == w or y + bh == h) and area < s.get('fill', 0.003) * h * w:
            hard[lab == i] = 1
    r = max(2, round(min(h, w) / 400))
    core = cv2.erode(hard, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)))
    near = cv2.dilate(hard, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)))
    raw = a
    a = np.clip((a - 0.12) / 0.5, 0, 1)
    a[core > 0] = 1
    # the soft edge only right at the subject's outline: a faint smear further out (a white wall the model half
    # took for the subject) goes
    a[(near == 0) | ((hard == 0) & (raw < 0.3))] = 0
    subject = a.copy()
    if 'ground' in s:
        # the ground in front: what is nearer than a depth (soft over a band of depths), below a line, its edge
        # following the photograph's own (grass, a ridge)
        d0, d1, y0 = s['ground']
        dp = depth(midas_session(model_dir), img)
        g = np.clip((dp - d0) / (d1 - d0), 0, 1)
        g = g * g * (3 - 2 * g)
        g[: int(y0 * h)] = 0
        if s.get('nosky'):
            # cloud and mist behind the ground are not ground, however near the depth makes them
            hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.float32) / 255.0
            cloud = (hsv[..., 2] > 0.8) & (hsv[..., 1] < 0.14)
            cloud = cv2.dilate(cloud.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))) > 0
            g[cloud] = 0
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0
        from cutout import guided
        g = np.clip(guided(gray, g.astype(np.float32), max(3, round(min(h, w) / 260)), 1e-3), 0, 1)
        subject = a.copy()
        a = np.maximum(a, g)
    if s.get('matte'):
        mimg, ma = refine_matte(img, subject if 'ground' in s else a, s.get('band', 12), s.get('holes', ()), s.get('exclude', ()))
        if 'ground' in s:
            a = np.maximum(ma, np.where(subject > 0.5, 0, a))    # the ground keeps its own soft edge
            rgb = np.where((ma > 0.02)[..., None], mimg, bleed(img, a))
        else:
            a, rgb = ma, mimg
    elif s.get('studio'):
        rgb, a = studio_edge(img, a, s.get('holes', ()))
    else:
        rgb = bleed(img, a)
    alpha = (a * 255 + 0.5).astype(np.uint8)
    out_dir = os.path.join(MEDIA, 'cut'); os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, f'{name}.webp')
    rgba = np.dstack([rgb, alpha])
    if s.get('crop'):
        # a cover's figure: the subject (with the ground it stands on, if any) and some room round it (it is set by
        # its height). env: how much of the ground to keep beside it, as shares of the subject's width
        base = (subject if 'ground' in s else a) > 0.5
        ys, xs = np.nonzero(base)
        m = int(0.03 * max(np.ptp(ys), np.ptp(xs)))
        sw = np.ptp(xs)
        side = s.get('env', 0)
        y0 = max(0, ys.min() - m)
        y1 = h if 'ground' in s else min(h, ys.max() + m + 1)
        x0, x1 = max(0, xs.min() - m - int(side * sw)), min(w, xs.max() + m + 1 + int(side * sw))
        rgba = rgba[y0:y1, x0:x1].copy()
        print(name, 'cropped to', rgba.shape[1], 'x', rgba.shape[0])
    if s.get('shadow'):
        # standing on the cover's own field: under each figure a contact shadow where it touches the ground, and a
        # soft cast shadow thrown back and to the right (the light is the studio's, from the front left and above)
        rgba = cast_shadow(rgba, **s['shadow'])
    if s.get('fade'):
        # the ground's ends feathered into the page: alpha eased to nothing towards the left and right edges
        fl, fr = s['fade']
        hh, ww = rgba.shape[:2]
        ramp = np.ones(ww, np.float32)
        nl, nr = int(fl * ww), int(fr * ww)
        if nl: ramp[:nl] = np.linspace(0, 1, nl) ** 1.6
        if nr: ramp[ww - nr:] = np.linspace(1, 0, nr) ** 1.6
        rgba[..., 3] = (rgba[..., 3].astype(np.float32) * ramp[None, :]).astype(np.uint8)
    cv2.imwrite(out, rgba, [cv2.IMWRITE_WEBP_QUALITY, 90])
    # check: each model's cut on amber, and the chosen one over a checker, at half size
    amber = np.zeros_like(img); amber[:] = (37, 160, 226)
    tiles = []
    for k, m in mats.items():
        tiles.append((img * m[..., None] + amber * (1 - m[..., None])).astype(np.uint8))
        cv2.putText(tiles[-1], k, (20, 60), cv2.FONT_HERSHEY_SIMPLEX, 1.6, (255, 255, 255), 3)
    chk = np.indices((h, w)).sum(axis=0) // 24 % 2
    board = np.where(chk[..., None] == 1, 70, 40).astype(np.uint8) * np.ones((1, 1, 3), np.uint8)
    tiles.append((rgb * a[..., None] + board * (1 - a[..., None])).astype(np.uint8))
    row = np.hstack([cv2.resize(t, (w // 2, h // 2), interpolation=cv2.INTER_AREA) for t in tiles])
    cv2.imwrite(os.path.join(check_dir, f'{name}.jpg'), row, [cv2.IMWRITE_JPEG_QUALITY, 84])
    print(name, f'{w}x{h}', f'subject {(a > 0.5).mean() * 100:.1f}%', os.path.getsize(out) // 1024, 'KB', flush=True)


if __name__ == '__main__':
    model_dir, check_dir = sys.argv[1], sys.argv[2]
    names = [n for n in sys.argv[3:] if not n.startswith('--')] or list(SHOTS)
    keys = ['birefnet', 'isnet'] if '--both' in sys.argv else None
    os.makedirs(check_dir, exist_ok=True)
    for n in names:
        s = SHOTS[n]
        cut(model_dir, n, s, check_dir, keys or (['birefnet', 'isnet'] if s['model'] == 'max' else [s['model']]))
