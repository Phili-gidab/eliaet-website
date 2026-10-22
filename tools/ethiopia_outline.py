"""Traces the outline of Ethiopia that the brand film draws before the e (web/public/film/logo-1280.mp4, at 2.25 s)
and writes it in the logo's own units, placed against the e as in the film, for the home page's door
(web/src/brand/ethiopia.ts). Needs ffmpeg, OpenCV and cairosvg.

    python3 tools/ethiopia_outline.py"""
import io, re, subprocess, tempfile
from pathlib import Path
import numpy as np, cv2, cairosvg
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FILM = ROOT / 'web/public/film/logo-1280.mp4'
def frame(t):
    with tempfile.NamedTemporaryFile(suffix='.png') as f:
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t), '-i', str(FILM), '-frames:v', '1', f.name], check=True)
        return np.asarray(Image.open(f.name).convert('RGB')).astype(int)

# the mark in the film's last frames, and the same mark drawn from the logo's vectors: the scale and place between them
fin = frame(6.0)
amber = (fin[:, :, 0] > 180) & (fin[:, :, 2] < 120) & (fin[:, :, 1] > 110)
ys, xs = np.nonzero(amber)
film_box = (xs.min(), ys.min(), xs.max(), ys.max())
logo = (ROOT / 'web/src/brand/logo.ts').read_text()
E = re.search(r'export const E = "([^"]+)"', logo).group(1)
cx, cy, r = [float(v) for v in re.search(r'DOT = \{ cx: ([\d.]+), cy: ([\d.]+), r: ([\d.]+)', logo).groups()]
HI, X0, Y0, W, H = 10, 230.0, 205.0, 170.0, 150.0
svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{X0} {Y0} {W} {H}" width="{int(W*HI)}" height="{int(H*HI)}"><path d="{E}" fill="#000"/><circle cx="{cx}" cy="{cy}" r="{r}" fill="#000"/></svg>'
m = np.asarray(Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode()))).convert('RGBA'))[:, :, 3] > 127
ys, xs = np.nonzero(m)
logo_box = (X0 + xs.min() / HI, Y0 + ys.min() / HI, X0 + (xs.max() + 1) / HI, Y0 + (ys.max() + 1) / HI)
sx = (logo_box[2] - logo_box[0]) / (film_box[2] - film_box[0] + 1)
sy = (logo_box[3] - logo_box[1]) / (film_box[3] - film_box[1] + 1)
s = (sx + sy) / 2
to_logo = lambda px, py: (logo_box[0] + (px - film_box[0]) * s, logo_box[1] + (py - film_box[1]) * s)

# the outline: the dark stroke, closed, filled, then traced along the middle of the stroke
out = frame(2.0)
# the stroke, with the amber dot that sits on it at the western point (where the e will start)
dot_px = (out[:, :, 0] > 180) & (out[:, :, 2] < 120) & (out[:, :, 1] > 110)
dark = (((out.sum(axis=2) < 360) | dot_px)).astype(np.uint8) * 255
dark = cv2.morphologyEx(dark, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
dys, dxs = np.nonzero(dot_px)
START = to_logo(dxs.mean(), dys.mean()) if len(dxs) else None
filled = dark.copy()
h, w = filled.shape
mask = np.zeros((h + 2, w + 2), np.uint8)
cv2.floodFill(filled, mask, (0, 0), 128)
shape = (filled != 128).astype(np.uint8) * 255                  # the country, stroke included
thick = cv2.distanceTransform(dark, cv2.DIST_L2, 5).max() * 2      # the stroke's width
mid = cv2.erode(shape, np.ones((3, 3), np.uint8), iterations=max(1, int(thick / 2 + 0.5)))
print('stroke px', thick, 'shape px', int((shape > 0).sum()), 'mid px', int((mid > 0).sum()))
cs, _ = cv2.findContours(mid, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
c = max(cs, key=cv2.contourArea)
c = cv2.approxPolyDP(c, 1.2, True)[:, 0, :]
pts = [to_logo(x, y) for x, y in c]
d = 'M' + ' L'.join(f'{x:.2f} {y:.2f}' for x, y in pts) + ' Z'
stroke = thick * s
dst = ROOT / 'web/src/brand/ethiopia.ts'
# start the path at the western point (where the film's amber dot appears), so it draws from there round
if START:
    i0 = min(range(len(pts)), key=lambda i: (pts[i][0] - START[0]) ** 2 + (pts[i][1] - START[1]) ** 2)
    pts = pts[i0:] + pts[:i0]
d = 'M' + ' L'.join(f'{x:.2f} {y:.2f}' for x, y in pts) + ' Z'
dst.write_text(f"""/* The outline of Ethiopia that the brand film draws before the amber e, traced from the film
   (tools/ethiopia_outline.py) and set in the logo's own units, where the film places it against the e. The path
   starts at the western point, where the film's amber dot appears and the e begins. */
export const ETHIOPIA = '{d}'
/** the film's stroke width, in logo units */
export const ETHIOPIA_STROKE = {stroke:.2f}
/** where the film's amber dot sits on the outline before the e draws out of it, in logo units */
export const ETHIOPIA_START = {{ x: {START[0]:.2f}, y: {START[1]:.2f} }} as const
""")
print('points', len(pts), 'stroke', round(stroke, 2), 'scale', round(s, 4), 'film box', film_box, 'logo box', [round(v, 1) for v in logo_box])
xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
print('outline box (logo units)', round(min(xs), 1), round(min(ys), 1), round(max(xs), 1), round(max(ys), 1))
