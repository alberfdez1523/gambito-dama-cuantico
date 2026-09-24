"""Localización de Stockfish, presets de dificultad y acceso acotado al pool de motores."""

from __future__ import annotations

import os
import pathlib
import platform
import shutil
from concurrent.futures import CancelledError
from typing import Callable, Literal, TypeVar

import chess
import chess.engine
from fastapi import HTTPException

from .stockfish_pool import EnginePoolTimeout, StockfishPool

ROOT_DIR = pathlib.Path(__file__).resolve().parent.parent

# `skill` controla fuerza interna del motor (0-20 en builds compatibles).
# `depth` y `time` limitan búsqueda para mantener respuesta fluida.
DIFFICULTIES = {
    "beginner": {"skill": 0, "depth": 1, "time": 0.05, "elo": 800},
    "easy": {"skill": 5, "depth": 5, "time": 0.15, "elo": 1200},
    "medium": {"skill": 10, "depth": 10, "time": 0.3, "elo": 1600},
    "hard": {"skill": 15, "depth": 14, "time": 0.6, "elo": 2000},
    "master": {"skill": 20, "depth": 20, "time": 1.0, "elo": 2600},
}

DifficultyLevel = Literal["beginner", "easy", "medium", "hard", "master"]

T = TypeVar("T")


def _is_executable_file(path: pathlib.Path) -> bool:
    return path.is_file() and os.access(path, os.X_OK)


def find_stockfish(root: pathlib.Path = ROOT_DIR) -> str | None:
    """Busca Stockfish en rutas del sistema, en PATH y dentro de `engine/`."""
    for system_path in ("/usr/games/stockfish", "/usr/bin/stockfish", "/usr/local/bin/stockfish"):
        candidate = pathlib.Path(system_path)
        if _is_executable_file(candidate):
            return str(candidate)

    on_path = shutil.which("stockfish")
    if on_path:
        return on_path

    engine_dir = root / "engine"
    if not engine_dir.exists():
        return None

    is_windows = platform.system() == "Windows"
    binary = "stockfish.exe" if is_windows else "stockfish"
    for candidate in (engine_dir / "stockfish" / "src" / binary, engine_dir / binary):
        if _is_executable_file(candidate):
            return str(candidate)

    pattern = "*.exe" if is_windows else "*"
    for candidate in engine_dir.rglob(pattern):
        if "stockfish" in candidate.name.lower() and _is_executable_file(candidate):
            return str(candidate)
    return None


def score_to_eval(score: chess.engine.PovScore) -> tuple[float, int | None]:
    """Convierte un score de python-chess a evaluación numérica (blancas) y mate."""
    white_score = score.white()
    if white_score.is_mate():
        mate = white_score.mate()
        evaluation = 10000.0 if (mate and mate > 0) else -10000.0
        return evaluation, mate
    return float(white_score.score(mate_score=10000)), None


def engine_unavailable(message: str) -> HTTPException:
    return HTTPException(status_code=503, detail={"error": message, "code": "ENGINE_UNAVAILABLE"})


class EngineRuntime:
    """Mantiene el pool de Stockfish y presta un motor por orden."""

    def __init__(self, stockfish_path: str | None, *, skip: bool) -> None:
        self.stockfish_path = stockfish_path
        self.skip = skip
        self.pool: StockfishPool | None = None

    def start(self) -> None:
        if not self.stockfish_path or self.skip:
            print("Skipping engine startup (test mode or no binary)")
            return
        pool_size = max(1, min(int(os.getenv("STOCKFISH_POOL_SIZE", "2")), 8))
        print(f"Starting Stockfish pool ({pool_size} workers)...")
        self.pool = StockfishPool(
            self.stockfish_path,
            size=pool_size,
            acquire_timeout=float(os.getenv("STOCKFISH_QUEUE_TIMEOUT", "3")),
        )
        self.pool.start()
        print("Engine pool ready")

    def close(self) -> None:
        if self.pool is not None:
            print("Shutting down engine pool...")
            self.pool.close()
            self.pool = None

    def alive(self) -> bool:
        return self.pool is not None and self.pool.healthy()

    def run(self, callback: Callable[[chess.engine.SimpleEngine], T]) -> T:
        """Presta un motor del pool durante `callback` y traduce los fallos a 503."""
        active_pool = self.pool
        if active_pool is None:
            raise engine_unavailable("Engine not ready")
        try:
            return active_pool.run(callback)
        except (CancelledError, EnginePoolTimeout) as exc:
            raise engine_unavailable("Engine queue is busy; retry the request") from exc
        except chess.engine.EngineTerminatedError as exc:
            raise engine_unavailable("Engine terminated unexpectedly") from exc
        except chess.engine.EngineError as exc:
            raise engine_unavailable(f"Engine error: {exc}") from exc
