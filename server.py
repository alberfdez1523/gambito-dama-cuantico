"""
Backend de ChessAI.

Este servicio hace 3 cosas:
1) Levanta Stockfish localmente.
2) Expone endpoints HTTP para pedir jugadas/evaluaciones.
3) Sirve el frontend estático para jugar desde el navegador.

Ejecución local:
    python server.py
"""

import os, sys, pathlib, json
from contextlib import asynccontextmanager

import chess
import chess.engine
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Localización del binario de Stockfish
# ---------------------------------------------------------------------------
HERE = pathlib.Path(__file__).parent.resolve()

def find_stockfish():
    """Busca el binario de Stockfish en rutas del sistema y en `engine/`.

    Orden de búsqueda:
    1. Rutas comunes del sistema (útil en Linux/Docker).
    2. PATH.
    3. Cualquier ejecutable compatible dentro de `engine/`.
    """
    import shutil, platform

    # Rutas típicas en Linux (incluyendo muchos contenedores Docker).
    for system_path in ["/usr/games/stockfish", "/usr/bin/stockfish", "/usr/local/bin/stockfish"]:
        if os.path.isfile(system_path) and os.access(system_path, os.X_OK):
            return system_path

    # Si está en el PATH, usamos esa versión.
    sf = shutil.which("stockfish")
    if sf:
        return sf

    # Si no está en PATH, buscamos una copia local en engine/.
    engine_dir = HERE / "engine"
    if engine_dir.exists():
        ext = ".exe" if platform.system() == "Windows" else ""
        for p in engine_dir.rglob("*"):
            if "stockfish" in p.name.lower() and p.is_file():
                if ext and p.name.endswith(ext):
                    return str(p)
                elif not ext and not p.name.endswith(".exe"):
                    return str(p)
        # Último recurso en Windows: cualquier .exe con "stockfish" en el nombre.
        if platform.system() == "Windows":
            for p in engine_dir.rglob("*.exe"):
                if "stockfish" in p.name.lower():
                    return str(p)
    return None

STOCKFISH_PATH = find_stockfish()
if STOCKFISH_PATH is None:
    print("ERROR: Stockfish binary not found.  Place it inside  engine/  folder.")
    sys.exit(1)

print(f"✓ Stockfish: {STOCKFISH_PATH}")

# ---------------------------------------------------------------------------
# Presets de dificultad
# ---------------------------------------------------------------------------
# `skill` controla fuerza interna del motor (0-20 en builds compatibles).
# `depth` y `time` limitan búsqueda para mantener respuesta fluida.
DIFFICULTIES = {
    "beginner": {"skill": 0,  "depth": 1,  "time": 0.05, "elo": 800},
    "easy":     {"skill": 5,  "depth": 5,  "time": 0.15, "elo": 1200},
    "medium":   {"skill": 10, "depth": 10, "time": 0.3,  "elo": 1600},
    "hard":     {"skill": 15, "depth": 14, "time": 0.6,  "elo": 2000},
    "master":   {"skill": 20, "depth": 20, "time": 1.0,  "elo": 2600},
}

# ---------------------------------------------------------------------------
# Motor global reutilizable
# ---------------------------------------------------------------------------
# Mantener una sola instancia reduce latencia y evita abrir procesos por request.
engine: chess.engine.SimpleEngine | None = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ciclo de vida de FastAPI: arranque y apagado limpio del motor."""
    global engine
    print("Starting Stockfish engine …")
    engine = chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH)
    # Ajustes conservadores para equipos normales.
    engine.configure({"Threads": 2, "Hash": 128})
    print("✓ Engine ready")
    yield
    print("Shutting down engine …")
    engine.quit()


app = FastAPI(title="ChessAI", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Esquemas de entrada/salida (validación + documentación automática)
# ---------------------------------------------------------------------------
class MoveRequest(BaseModel):
    fen: str
    difficulty: str = "medium"

class MoveResponse(BaseModel):
    bestmove: str          # UCI notation e.g. "e2e4"
    evaluation: float      # centipawns from white's perspective
    mate: int | None       # mate in N moves (None if no mate)
    ponder: str | None     # ponder move


class EvalRequest(BaseModel):
    fen: str
    depth: int = 12

class EvalResponse(BaseModel):
    evaluation: float
    mate: int | None


# ---------------------------------------------------------------------------
# Endpoints API
# ---------------------------------------------------------------------------
@app.post("/api/move", response_model=MoveResponse)
def get_best_move(req: MoveRequest):
    """Devuelve la mejor jugada de Stockfish para una posición FEN."""
    global engine
    if engine is None:
        raise HTTPException(503, "Engine not ready")

    preset = DIFFICULTIES.get(req.difficulty, DIFFICULTIES["medium"])

    try:
        board = chess.Board(req.fen)
    except ValueError:
        raise HTTPException(400, "Invalid FEN")

    if board.is_game_over():
        raise HTTPException(400, "Game is already over")

    # Algunos binarios soportan Skill Level explícito.
    # Si no lo soporta, continuamos con límites de profundidad/tiempo.
    try:
        engine.configure({"Skill Level": preset["skill"]})
    except chess.engine.EngineError:
        pass  # some builds don't support it

    # Combinamos límite por profundidad y por tiempo:
    # termina al alcanzar el primero, dando buena respuesta en UI.
    limit = chess.engine.Limit(
        depth=preset["depth"],
        time=preset["time"],
    )
    result = engine.play(board, limit, info=chess.engine.INFO_SCORE)

    # Parseo de evaluación en perspectiva de blancas.
    evaluation = 0.0
    mate = None
    if result.info and "score" in result.info:
        score = result.info["score"].white()  # always from white's view
        if score.is_mate():
            mate = score.mate()
            evaluation = 10000.0 if (mate and mate > 0) else -10000.0
        else:
            evaluation = float(score.score(mate_score=10000))

    ponder_uci = result.ponder.uci() if result.ponder else None
    best_uci = result.move.uci()

    return MoveResponse(
        bestmove=best_uci,
        evaluation=evaluation,
        mate=mate,
        ponder=ponder_uci,
    )


@app.post("/api/eval", response_model=EvalResponse)
def get_evaluation(req: EvalRequest):
    """Evalúa una posición sin pedir jugada."""
    global engine
    if engine is None:
        raise HTTPException(503, "Engine not ready")

    try:
        board = chess.Board(req.fen)
    except ValueError:
        raise HTTPException(400, "Invalid FEN")

    info = engine.analyse(board, chess.engine.Limit(depth=min(req.depth, 18), time=0.3))
    score = info["score"].white()

    evaluation = 0.0
    mate = None
    if score.is_mate():
        mate = score.mate()
        evaluation = 10000.0 if (mate and mate > 0) else -10000.0
    else:
        evaluation = float(score.score(mate_score=10000))

    return EvalResponse(evaluation=evaluation, mate=mate)


@app.get("/api/health")
def health():
    """Endpoint liviano para saber si backend+motor están listos."""
    return {"status": "ok", "engine": STOCKFISH_PATH is not None}


# ---------------------------------------------------------------------------
# Frontend estático
# ---------------------------------------------------------------------------
# Montamos todo el directorio raíz para servir HTML/CSS/JS y assets.
app.mount("/static", StaticFiles(directory=str(HERE)), name="static")

@app.get("/")
def root():
    return FileResponse(str(HERE / "index.html"))

@app.get("/{filename:path}")
def static_files(filename: str):
    """Sirve archivos estáticos del proyecto, excepto el árbol `engine/`."""
    fp = HERE / filename
    if fp.is_file() and not str(fp.resolve()).startswith(str(HERE / "engine")):
        return FileResponse(str(fp))
    raise HTTPException(404)


# ---------------------------------------------------------------------------
# Punto de entrada local
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "3000"))
    print(f"\n🚀  ChessAI server → http://localhost:{port}\n")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
