"""Bakes the ELIA lockup into a signed distance field for the home page's door (web/src/scripts/door-gl.ts).

    python3 tools/door_sdf.py

Red: the amber e, green: the wordmark (the dot is a circle, drawn exactly by the shader). Each channel is 0.5 on
the shape's edge, rising inside and falling outside, RANGE texture pixels each way, so the edges stay sharp at any
zoom. The texture covers the lockup's box (brand/logo.ts VIEW.lockup), PAD logo units around it.
Writes web/public/media/brand/elia-sdf.webp (lossless) and prints the numbers door-gl.ts needs."""
import io, json, re, subprocess
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt
import cairosvg

ROOT = Path(__file__).resolve().parent.parent
logo = (ROOT / 'web/src/brand/logo.ts').read_text()
E = re.search(r'export const E = "([^"]+)"', logo).group(1)
WORD = re.findall(r'"(M[^"]+)"', logo[logo.index('export const WORDMARK'):])
X0, Y0, W, H = 237.9, 215.7, 366.0, 131.8          # VIEW.lockup
PAD = 6.0                                          # logo units of room around the lockup
HI = 12                                            # rendering scale (px per logo unit) before the distance field
OUT_W = 2048                                       # the texture's width
RANGE = 24                                         # texture pixels of distance each way of the edge

def raster(paths):
    vb = f'{X0 - PAD} {Y0 - PAD} {W + 2 * PAD} {H + 2 * PAD}'
    w, h = round((W + 2 * PAD) * HI), round((H + 2 * PAD) * HI)
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{w}" height="{h}"><rect x="{X0-PAD}" y="{Y0-PAD}" width="{W+2*PAD}" height="{H+2*PAD}" fill="#000"/>' + ''.join(f'<path d="{d}" fill="#fff"/>' for d in paths) + '</svg>'
    png = cairosvg.svg2png(bytestring=svg.encode())
    return np.asarray(Image.open(io.BytesIO(png)).convert('L'), dtype=np.float32) / 255.0

def sdf(mask):
    inside = mask > 0.5
    d_out = distance_transform_edt(~inside)
    d_in = distance_transform_edt(inside)
    d = (d_in - d_out) / HI                        # logo units, positive inside
    return d

dE, dW = sdf(raster([E])), sdf(raster(WORD))
k = OUT_W / (W + 2 * PAD)                          # texture px per logo unit
out_h = round((H + 2 * PAD) * k)
def enc(d):
    img = Image.fromarray(d.astype(np.float32), mode='F').resize((OUT_W, out_h), Image.BILINEAR)
    v = np.asarray(img) * k / RANGE * 0.5 + 0.5
    return (np.clip(v, 0, 1) * 255 + 0.5).astype(np.uint8)
rgb = np.stack([enc(dE), enc(dW), np.zeros((out_h, OUT_W), np.uint8)], axis=-1)
out = ROOT / 'web/public/media/brand/elia-sdf.webp'
Image.fromarray(rgb, 'RGB').save(out, lossless=True, quality=100, method=6)
print(json.dumps({'file': str(out.relative_to(ROOT)), 'size': [OUT_W, out_h], 'x0': X0 - PAD, 'y0': Y0 - PAD, 'w': W + 2 * PAD, 'h': H + 2 * PAD, 'range': RANGE, 'bytes': out.stat().st_size}))
