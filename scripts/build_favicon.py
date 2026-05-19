"""Genera favicons desde la imagen del rey blanco."""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(
    r"C:\Users\alber\.cursor\projects\c-Users-alber-Downloads-gambito-dama-cuantico\assets"
    r"\c__Users_alber_AppData_Roaming_Cursor_User_workspaceStorage_b8ce9a1269beb26b9103ffc998f0a67f_images_"
    r"image-vuq3IJJEE8kB6iU6hTwCb8NpVLEWwB-befebe8e-69f3-41f4-b7bb-aa55ece6aa5c.png"
)
OUT = ROOT / "frontend" / "public"


def remove_near_black_bg(img: Image.Image, threshold: int = 28) -> Image.Image:
    data = img.convert("RGBA")
    px = data.load()
    w, h = data.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r <= threshold and g <= threshold and b <= threshold:
                px[x, y] = (r, g, b, 0)
    return data


def main() -> None:
    if not SRC.exists():
        raise FileNotFoundError(SRC)
    img = Image.open(SRC)
    img = remove_near_black_bg(img)
    # Recorte al contenido visible
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)

    for size, name in ((16, "favicon-16.png"), (32, "favicon-32.png"), (180, "apple-touch-icon.png")):
        icon = img.copy()
        icon.thumbnail((size, size), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        ox = (size - icon.width) // 2
        oy = (size - icon.height) // 2
        canvas.paste(icon, (ox, oy), icon)
        canvas.save(OUT / name, optimize=True)
        print(f"OK {name}")

    icon32 = img.copy()
    icon32.thumbnail((32, 32), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    ox = (32 - icon32.width) // 2
    oy = (32 - icon32.height) // 2
    canvas.paste(icon32, (ox, oy), icon32)
    canvas.save(OUT / "favicon.png", optimize=True)
    print("OK favicon.png")


if __name__ == "__main__":
    main()
