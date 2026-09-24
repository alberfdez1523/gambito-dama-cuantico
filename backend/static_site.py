"""Sirve el build de Vite y la música, con fallback SPA y sin salir de sus directorios."""

from __future__ import annotations

import pathlib

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

# Archivos que deben revalidarse siempre para que las actualizaciones de la PWA lleguen.
NO_CACHE_FILES = {"index.html", "sw.js", "registerSW.js", "manifest.webmanifest"}


class CacheStaticFiles(StaticFiles):
    def __init__(self, *args, cache_control: str, **kwargs):
        super().__init__(*args, **kwargs)
        self.cache_control = cache_control

    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        response.headers.setdefault("Cache-Control", self.cache_control)
        return response


def cached_file_response(path: pathlib.Path, cache_control: str | None = None) -> FileResponse:
    response = FileResponse(str(path))
    if cache_control:
        response.headers.setdefault("Cache-Control", cache_control)
    return response


def resolve_inside(base_dir: pathlib.Path, relative: str) -> pathlib.Path | None:
    """Devuelve el archivo pedido solo si queda dentro de `base_dir` (evita path traversal)."""
    base = base_dir.resolve()
    try:
        candidate = (base / relative).resolve()
    except (OSError, ValueError):
        return None
    if not candidate.is_relative_to(base) or not candidate.is_file():
        return None
    return candidate


def _cache_policy(path: pathlib.Path) -> str | None:
    if path.name in NO_CACHE_FILES:
        return "no-cache"
    return "public, max-age=604800" if path.suffix else None


def frontend_not_built_response() -> HTMLResponse:
    return HTMLResponse(
        """
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Frontend no compilado</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: grid;
             place-items: center; background: #111111; color: #f5f5f5; }
      main { max-width: 680px; padding: 32px; border: 1px solid #2a2a2a; border-radius: 16px;
             background: #1a1a1a; }
      code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; background: #222222;
             padding: 2px 6px; border-radius: 6px; }
    </style>
  </head>
  <body>
    <main>
      <h1>El frontend no está compilado</h1>
      <p>Compila la aplicación React con <code>cd frontend && npm ci && npm run build</code>
      o ejecuta el entorno de desarrollo con <code>cd frontend && npm run dev</code>.</p>
    </main>
  </body>
</html>
        """.strip(),
        status_code=503,
    )


def mount_frontend(app: FastAPI, root_dir: pathlib.Path) -> None:
    """Registra música, assets hasheados y el fallback SPA. Debe llamarse al final."""
    dist_dir = root_dir / "frontend" / "dist"
    use_react = (dist_dir / "index.html").is_file()
    if use_react:
        print(f"Serving React build from {dist_dir}")
    else:
        print("React build not found. Run 'cd frontend && npm run build' or use 'npm run dev' inside frontend/")

    music_dir = root_dir / "music"
    if music_dir.exists():
        app.mount(
            "/music",
            CacheStaticFiles(directory=str(music_dir), cache_control="public, max-age=604800"),
            name="music",
        )

    if use_react and (dist_dir / "assets").exists():
        app.mount(
            "/assets",
            CacheStaticFiles(
                directory=str(dist_dir / "assets"),
                cache_control="public, max-age=31536000, immutable",
            ),
            name="assets",
        )

    @app.get("/")
    def root():
        if use_react:
            return cached_file_response(dist_dir / "index.html", "no-cache")
        return frontend_not_built_response()

    @app.head("/")
    def root_head():
        # Evita 405 en health checks que usan HEAD /
        return {"status": "ok"}

    @app.get("/{filename:path}")
    def static_files(filename: str):
        """Sirve frontend estático con fallback SPA para React."""
        if filename.startswith("api/"):
            raise HTTPException(404)
        # Si parece un asset (tiene extensión), no devolver index.html para que
        # los CSS/JS faltantes no rompan la UI en silencio.
        looks_like_asset = "." in pathlib.PurePosixPath(filename).name
        if not use_react:
            if looks_like_asset:
                raise HTTPException(404)
            return frontend_not_built_response()

        file_path = resolve_inside(dist_dir, filename)
        if file_path is not None:
            return cached_file_response(file_path, _cache_policy(file_path))
        if looks_like_asset or ".." in filename:
            raise HTTPException(404)
        return cached_file_response(dist_dir / "index.html", "no-cache")
