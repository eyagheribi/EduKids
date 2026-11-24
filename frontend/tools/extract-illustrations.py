"""Extract illustration assets from the EduKids mockups (design/ folder).

Each crop is cut out from its pastel background with a border flood-fill on
"light pastel" pixels, then the alpha edge is softened for anti-aliasing.
"""
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

DESIGN = Path(sys.argv[1])
OUT = Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)

FILES = {
    "welcome": "Bienvenue sur EduKids _ Parents et Enfants.png",
    "login": "Connexion Parent EduKids aux Couleurs Pastel.png",
    "dash": "Tableau de bord EduKids pour parents.png",
    "adam": "Tableau de bord EduKids pour Adam.png",
    "spaces": "Mes espaces enfants _ liste et création.png",
}

# name: (file, box, light-threshold)
CROPS = {
    "parent-child-tablet": ("welcome", (292, 335, 732, 600), 205),
    "child-headphones": ("welcome", (1005, 350, 1375, 600), 212),
    "parent-child-laptop": ("login", (92, 292, 788, 726), 214),
    "child-tablet": ("dash", (735, 150, 1012, 366), 212),
    "child-laptop": ("adam", (1300, 470, 1652, 792), 212),
    "parent-child-small": ("spaces", (1318, 128, 1668, 372), 212),
    "plant-books": ("dash", (40, 768, 246, 908), 214),
    "medal": ("dash", (1100, 742, 1190, 842), 214),
}


def cutout(img: Image.Image, threshold: int) -> Image.Image:
    rgb = np.asarray(img.convert("RGB")).astype(np.int16)
    h, w, _ = rgb.shape
    mn = rgb.min(axis=2)
    mx = rgb.max(axis=2)
    # Light pastel background: bright and not strongly saturated.
    light = (mn >= threshold) & ((mx - mn) <= 60)
    bg = np.zeros((h, w), dtype=bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if light[y, x] and not bg[y, x]:
                bg[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if light[y, x] and not bg[y, x]:
                bg[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not bg[ny, nx] and light[ny, nx]:
                bg[ny, nx] = True
                q.append((ny, nx))
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    # Soft fringe: pixels touching the background get partial alpha by lightness.
    mask = Image.fromarray(alpha, "L").filter(ImageFilter.MinFilter(3))
    mask = mask.filter(ImageFilter.GaussianBlur(0.9))
    a = np.asarray(mask).astype(np.float32)
    lightness = (mn.astype(np.float32) - (threshold - 40)) / 40.0
    fringe = (a > 0) & (a < 255)
    a[fringe] = a[fringe] * np.clip(1.0 - lightness[fringe] * 0.6, 0.35, 1.0)
    out = np.dstack([rgb.astype(np.uint8), a.clip(0, 255).astype(np.uint8)])
    res = Image.fromarray(out, "RGBA")
    bbox = res.getbbox()
    return res.crop(bbox) if bbox else res


# Regions (in mockup coordinates) painted with background before cutting:
# mockup copy text and floating UI cards rebuilt as real HTML/CSS.
CLEAR_LIGHT = {
    "parent-child-laptop": [(560, 470, 720, 512)],
}
CLEAR = {
    "parent-child-laptop": [(92, 292, 600, 372), (556, 292, 788, 488)],
}

for name, (key, box, threshold) in CROPS.items():
    src = Image.open(DESIGN / FILES[key]).convert("RGB")
    for cb in CLEAR.get(name, []):
        src.paste((250, 248, 254), cb)
    # Light-only clearing keeps dark artwork (hair) that overlaps the zone.
    arr = np.asarray(src).copy()
    for (x0, y0, x1, y1) in CLEAR_LIGHT.get(name, []):
        zone = arr[y0:y1, x0:x1]
        zone[zone.min(axis=2) > 165] = (250, 248, 254)
    src = Image.fromarray(arr)
    piece = cutout(src.crop(box), threshold)
    piece.save(OUT / f"{name}.webp", "WEBP", quality=92, method=6)
    piece.save(OUT.parent / "preview" / f"{name}.png") if (OUT.parent / "preview").exists() else None
    print(name, piece.size)
