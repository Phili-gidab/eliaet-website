"""Re-cut a cut-out's outline properly where it was cut from a light backdrop: fine hair especially.

The cut's own outline only says roughly where the subject ends. From it this makes a trimap (surely the subject well
inside it, surely the backdrop well outside, and a band between them, wide inside a box round fine hair and narrow
elsewhere), then works out the opacity of every pixel in the band from the photograph itself (closed-form matting,
pymatting), and the subject's own colour there with the backdrop's share taken out (its foreground estimate). Hair
keeps its wisps, without the grey of the backdrop between them that reads as a pale rim on a dark page.

    pip install pymatting
    python3 tools/rematte.py <photograph> <cut> <out> [--hair x0,y0,x1,y1] [--band 22] [--edge 4]

The photograph and the cut are the same size (tools/cutout.py makes them so); the box is in the picture's pixels."""
import argparse
import numpy as np
import cv2
from PIL import Image
from pymatting import estimate_alpha_cf, estimate_foreground_ml


def disc(r):
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('photo'); ap.add_argument('cut'); ap.add_argument('out')
    ap.add_argument('--hair', help='x0,y0,x1,y1: a box round fine hair, where the band is wide')
    ap.add_argument('--band', type=int, default=22, help='how far into the hair the band reaches, px')
    ap.add_argument('--edge', type=int, default=4, help='the band elsewhere, px')
    o = ap.parse_args()

    src = np.asarray(Image.open(o.photo).convert('RGB')).astype(np.float64) / 255
    a0 = np.asarray(Image.open(o.cut).convert('RGBA')).astype(np.float64)[..., 3] / 255
    h, w = a0.shape
    wide = np.zeros((h, w), bool)
    if o.hair:
        x0, y0, x1, y1 = (int(v) for v in o.hair.split(','))
        wide[y0:y1, x0:x1] = True
    inside = (a0 > 0.5).astype(np.uint8)
    touched = (a0 > 0.05).astype(np.uint8)
    sure_fg = np.where(wide, cv2.erode(inside, disc(o.band)), cv2.erode(inside, disc(o.edge))).astype(bool)
    sure_bg = ~np.where(wide, cv2.dilate(touched, disc(10)), cv2.dilate(touched, disc(o.edge))).astype(bool)
    tri = np.full((h, w), 0.5)
    tri[sure_fg] = 1.0
    tri[sure_bg] = 0.0

    alpha = np.clip(estimate_alpha_cf(src, tri), 0, 1)
    fg = np.clip(estimate_foreground_ml(src, alpha), 0, 1)
    out = np.dstack([fg, alpha])
    Image.fromarray((out * 255 + 0.5).astype(np.uint8), 'RGBA').save(o.out, quality=90, method=6, alpha_quality=100)
    print(f'{o.out}: {int((np.abs(alpha - a0) > 0.05).sum())} pixels re-cut')


if __name__ == '__main__':
    main()
