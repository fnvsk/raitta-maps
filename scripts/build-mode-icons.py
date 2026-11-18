"""Cuts the four mode illustrations (bus, EV charger, train, route map) out of one 2x2 sheet,
takes away the sheet's light background, keeping the soft shadows as shadows, and writes
transparent WebP files for the app's mode tiles.

    python scripts/build-mode-icons.py path/to/sheet.png

Writes src/assets/modes/{transport,charging,trains,route}.webp.

The second sheet (release/art/modes-sheet-2.webp) holds a tram, a metro and a fuel station,
two on top and one below in the middle:

    python scripts/build-mode-icons.py --second release/art/modes-sheet-2.webp

writes src/assets/modes/{tram,metro,fuel}.webp.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

OUT = Path(__file__).resolve().parent.parent / 'src' / 'assets' / 'modes'
NAMES = ['transport', 'charging', 'trains', 'route']
HEIGHT = 240
FLOOD = 7.0
CLEAR = 4.0
SOLID = 22.0
EDGE_PX = 2
ENCLOSED_SKY_PX = {'trains': 2000, 'tram': 1500, 'fuel': 2500, 'metro': 4000}
SECOND = {'tram': (0, 0, 800, 560), 'metro': (800, 0, 1536, 560), 'fuel': (140, 540, 1400, 1024)}

def cut(tile: np.ndarray, name: str) -> Image.Image:
    rgb = tile[..., :3].astype(np.float64)
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    bg = np.median(border, axis=0)
    dist = np.linalg.norm(rgb - bg, axis=-1)

    labels, _ = ndimage.label(dist < FLOOD)
    edge = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    outside = np.isin(labels, edge[edge > 0])
    if name in ENCLOSED_SKY_PX:
        sizes = ndimage.sum(np.ones(dist.shape), labels, range(1, labels.max() + 1))
        sky = [i + 1 for i, size in enumerate(sizes) if size > ENCLOSED_SKY_PX[name]]
        outside |= np.isin(labels, sky)
    band = ndimage.binary_dilation(outside, iterations=EDGE_PX) & ~outside

    alpha = np.ones(dist.shape)
    alpha[outside] = 0
    alpha[band] = np.clip((dist[band] - CLEAR) / (SOLID - CLEAR), 0, 1)
    alpha = ndimage.gaussian_filter(alpha, 0.6)
    alpha[outside & (ndimage.binary_erosion(outside, iterations=2))] = 0

    a = alpha[..., None]
    with np.errstate(divide='ignore', invalid='ignore'):
        colour = np.where(a > 0.02, (rgb - (1 - a) * bg) / a, rgb)
    colour = np.clip(colour, 0, 255)

    out = np.dstack([colour, alpha * 255]).astype(np.uint8)
    image = Image.fromarray(out)
    box = image.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    return image.crop(box)

def main(sheet: str):
    image = np.array(Image.open(sheet).convert('RGB'))
    h, w = image.shape[:2]
    OUT.mkdir(parents=True, exist_ok=True)
    for index, name in enumerate(NAMES):
        row, col = divmod(index, 2)
        tile = image[row * h // 2 : (row + 1) * h // 2, col * w // 2 : (col + 1) * w // 2]
        cutout = cut(tile, name)
        scale = HEIGHT / cutout.height
        cutout = cutout.resize((round(cutout.width * scale), HEIGHT), Image.LANCZOS)
        path = OUT / f'{name}.webp'
        cutout.save(path, 'WEBP', quality=88, method=6)
        print(f'{path.name}: {cutout.width}x{cutout.height}, {path.stat().st_size // 1024} KB')

def save(cutout: Image.Image, name: str):
    scale = HEIGHT / cutout.height
    cutout = cutout.resize((round(cutout.width * scale), HEIGHT), Image.LANCZOS)
    path = OUT / f'{name}.webp'
    cutout.save(path, 'WEBP', quality=88, method=6)
    print(f'{path.name}: {cutout.width}x{cutout.height}, {path.stat().st_size // 1024} KB')

GLOW_CLEAR = 40
GLOW_SOLID = 140
GLOW = {'fuel': (120, 215), 'metro': (60, 160)}

def second(sheet: str):
    picture = Image.open(sheet).convert('RGBA')
    sx, sy = picture.width / 1536, picture.height / 1024
    image = np.array(picture).astype(np.float64)
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (left, top, right, bottom) in SECOND.items():
        tile = image[round(top * sy) : round(bottom * sy), round(left * sx) : round(right * sx)].copy()
        clear, solid = GLOW.get(name, (GLOW_CLEAR, GLOW_SOLID))
        alpha = np.clip((tile[..., 3] - clear) / (solid - clear), 0, 1)
        alpha = ndimage.gaussian_filter(alpha, 0.5)
        tile[..., 3] = alpha * 255
        cutout = Image.fromarray(tile.astype(np.uint8))
        box = cutout.getchannel('A').point(lambda v: 255 if v > 60 else 0).getbbox()
        save(cutout.crop(box), name)

if __name__ == '__main__':
    if sys.argv[1] == '--second':
        second(sys.argv[2])
    else:
        main(sys.argv[1])
