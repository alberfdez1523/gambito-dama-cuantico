"""Quita fondo tipo tablero (checkerboard) por flood-fill desde los bordes."""

from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CURSOR_ASSETS = Path(
    r"C:\Users\alber\.cursor\projects\c-Users-alber-Downloads-gambito-dama-cuantico\assets"
)
ASSETS = CURSOR_ASSETS if CURSOR_ASSETS.exists() else ROOT / "assets"
OUT = ROOT / "frontend" / "public"

SOURCES = {
    "logo-dark.png": ASSETS
    / "c__Users_alber_AppData_Roaming_Cursor_User_workspaceStorage_b8ce9a1269beb26b9103ffc998f0a67f_images_ChatGPT_Image_20_may_2026__00_34_43-6adfc317-8f3c-44ce-87f6-9b65ecb5f979.png",
    "logo-light.png": ASSETS
    / "c__Users_alber_AppData_Roaming_Cursor_User_workspaceStorage_b8ce9a1269beb26b9103ffc998f0a67f_images_ChatGPT_Image_20_may_2026__00_36_19-9a1ded6a-b64b-4048-bfd0-b9327f03dbeb.png",
}


def is_background_rgb(r: int, g: int, b: int) -> bool:
    """Grises del checkerboard; conserva oro, negro y blanco del logo."""
    if abs(int(r) - int(g)) > 28 or abs(int(g) - int(b)) > 28:
        return False
    v = (int(r) + int(g) + int(b)) / 3
    return v >= 135 or (72 <= v <= 134)


def _flood_mask(
    data: np.ndarray,
    predicate,
    seeds: list[tuple[int, int]] | None = None,
) -> None:
    h, w = data.shape[:2]
    visited = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()

    if seeds is None:
        for x in range(w):
            q.append((x, 0))
            q.append((x, h - 1))
        for y in range(h):
            q.append((0, y))
            q.append((w - 1, y))
    else:
        q.extend(seeds)

    while q:
        x, y = q.popleft()
        if x < 0 or x >= w or y < 0 or y >= h:
            continue
        if visited[y, x]:
            continue
        r, g, b, a = (int(data[y, x, i]) for i in range(4))
        if a < 8 or not predicate(r, g, b):
            continue
        visited[y, x] = True
        data[y, x, 3] = 0
        q.append((x + 1, y))
        q.append((x - 1, y))
        q.append((x, y + 1))
        q.append((x, y - 1))


def is_dark_border(r: int, g: int, b: int) -> bool:
    return r < 40 and g < 40 and b < 40


def flood_transparent(data: np.ndarray) -> np.ndarray:
    _flood_mask(data, is_background_rgb)
    _flood_mask(data, is_dark_border)
    # Quitar grises del checker atrapados junto a zonas ya transparentes
    h, w = data.shape[:2]
    for _ in range(12):
        changed = False
        for y in range(h):
            for x in range(w):
                if data[y, x, 3] == 0:
                    continue
                r, g, b = (int(data[y, x, i]) for i in range(3))
                if not is_background_rgb(r, g, b):
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and data[ny, nx, 3] == 0:
                        data[y, x, 3] = 0
                        changed = True
                        break
        if not changed:
            break
    return data


def process(src: Path, dest: Path) -> None:
    im = Image.open(src).convert("RGBA")
    data = np.array(im)
    data = flood_transparent(data)
    dest.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(data).save(dest, optimize=True)
    print(f"OK {dest.relative_to(ROOT)} ({dest.stat().st_size // 1024} KB)")


def main() -> None:
    for name, src in SOURCES.items():
        if not src.exists():
            raise FileNotFoundError(src)
        process(src, OUT / name)


if __name__ == "__main__":
    main()
