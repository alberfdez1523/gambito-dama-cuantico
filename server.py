"""
Backend de Gambito de Dama Cuantico.

Este servicio hace 3 cosas:
1) Levanta Stockfish localmente.
2) Expone endpoints HTTP para pedir jugadas/evaluaciones.
3) Sirve el frontend estático para jugar desde el navegador.

Ejecución local:
    python server.py
"""

import os, pathlib, json, sys, threading
from concurrent.futures import CancelledError
from contextlib import asynccontextmanager

import chess
import chess.engine
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
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

    def is_executable_file(path: pathlib.Path) -> bool:
        """True si existe, es archivo regular y tiene permiso de ejecución."""
        return path.is_file() and os.access(path, os.X_OK)

    # Rutas típicas en Linux (incluyendo muchos contenedores Docker).
    for system_path in ["/usr/games/stockfish", "/usr/bin/stockfish", "/usr/local/bin/stockfish"]:
        sp = pathlib.Path(system_path)
        if is_executable_file(sp):
            return str(sp)

    # Si está en el PATH, usamos esa versión.
    sf = shutil.which("stockfish")
    if sf:
        return sf

    # Si no está en PATH, buscamos una copia local en engine/.
    engine_dir = HERE / "engine"
    if engine_dir.exists():
        is_windows = platform.system() == "Windows"

        # 1) Ruta esperada cuando se compila desde source en Linux (Render).
        preferred_candidates = [
            engine_dir / "stockfish" / "src" / ("stockfish.exe" if is_windows else "stockfish"),
            engine_dir / ("stockfish.exe" if is_windows else "stockfish"),
        ]
        for candidate in preferred_candidates:
            if is_executable_file(candidate):
                return str(candidate)

        # 2) Búsqueda general: solo archivos ejecutables y con nombre razonable.
        if is_windows:
            for p in engine_dir.rglob("*.exe"):
                if "stockfish" in p.name.lower() and is_executable_file(p):
                    return str(p)
        else:
            for p in engine_dir.rglob("*"):
                if "stockfish" in p.name.lower() and is_executable_file(p):
                    return str(p)
    return None

STOCKFISH_PATH = find_stockfish()
if STOCKFISH_PATH is None:
    print("ERROR: Stockfish binary not found.")
    print("       Compile it first:  cd engine/stockfish/src && make -j2 build ARCH=x86-64")
    sys.exit(1)
else:
    print(f"Stockfish found: {STOCKFISH_PATH}")

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
engine_lock = threading.Lock()


def _score_to_eval(score: chess.engine.PovScore) -> tuple[float, int | None]:
    """Convierte un score de python-chess a evaluación numérica y mate."""
    white_score = score.white()
    if white_score.is_mate():
        mate = white_score.mate()
        evaluation = 10000.0 if (mate and mate > 0) else -10000.0
        return evaluation, mate
    return float(white_score.score(mate_score=10000)), None


def _with_engine_lock(callback):
    """Serializa acceso al motor compartido para evitar cancelaciones internas."""
    global engine

    with engine_lock:
        active_engine = engine
        if active_engine is None:
            raise HTTPException(503, "Engine not ready")

        try:
            return callback(active_engine)
        except CancelledError as exc:
            raise HTTPException(503, "Engine request was interrupted, retry the move") from exc
        except chess.engine.EngineTerminatedError as exc:
            engine = None
            raise HTTPException(503, "Engine terminated unexpectedly") from exc
        except chess.engine.EngineError as exc:
            raise HTTPException(503, f"Engine error: {exc}") from exc

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ciclo de vida de FastAPI: arranque y apagado limpio del motor."""
    global engine
    print("Starting Stockfish engine...")
    with engine_lock:
        engine = chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH)
        # Ajustes conservadores para equipos normales.
        engine.configure({"Threads": 2, "Hash": 128})
    print("Engine ready")
    yield
    print("Shutting down engine...")
    with engine_lock:
        if engine is not None:
            engine.quit()
            engine = None


app = FastAPI(title="Gambito de Dama Cuantico", lifespan=lifespan)

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


# ─── Esquemas cuánticos ───

class QuantumPieceSquare(BaseModel):
    square: str
    probability: float

class QuantumPieceInfo(BaseModel):
    id: str
    type: str          # p, n, b, r, q, k
    color: str         # w, b
    squares: list[QuantumPieceSquare]

class QuantumCastling(BaseModel):
    w: dict  # { k: bool, q: bool }
    b: dict

class QuantumStatePayload(BaseModel):
    pieces: list[QuantumPieceInfo]
    turn: str
    castling: QuantumCastling

class QuantumMoveRequest(BaseModel):
    quantum_state: QuantumStatePayload
    difficulty: str = "medium"

class QuantumMoveResponse(BaseModel):
    pieceId: str
    from_sq: str          # "from" es palabra reservada en Python
    to: str
    promotion: str | None = None
    weightedEval: float
    universeCount: int


# ---------------------------------------------------------------------------
# Generador de tableros clásicos desde estado cuántico (Enfoque Multiverso)
# ---------------------------------------------------------------------------

PIECE_TYPE_MAP = {"p": chess.PAWN, "n": chess.KNIGHT, "b": chess.BISHOP,
                  "r": chess.ROOK, "q": chess.QUEEN, "k": chess.KING}

def _generate_classical_boards(qs: QuantumStatePayload, max_boards: int = 128):
    """Genera todos los tableros clásicos posibles a partir del estado cuántico.

    Cada pieza cuántica (>1 posición) genera opciones.
    El producto cartesiano de opciones produce universos clásicos.
    Se descartan universos con conflictos (dos piezas en la misma casilla).
    """
    classical = []
    quantum = []

    for p in qs.pieces:
        if len(p.squares) == 1 and p.squares[0].probability >= 1.0:
            classical.append(p)
        else:
            quantum.append(p)

    if not quantum:
        # Todo clásico → un solo tablero
        board = _build_board(classical, [], qs.turn, qs.castling)
        if board:
            piece_map = {s.squares[0].square: s.id for s in classical}
            return [{"fen": board.fen(), "probability": 1.0, "piece_map": piece_map}]
        return []

    # Generar opciones para cada pieza cuántica
    options_list = []
    for p in quantum:
        opts = [(p, sq.square, sq.probability) for sq in p.squares]
        options_list.append(opts)

    from itertools import product as cart_product
    boards = []

    for combo in cart_product(*options_list):
        if len(boards) >= max_boards:
            break

        prob = 1.0
        placements = {}  # square → piece_info
        valid = True

        # Primero poner piezas clásicas
        for p in classical:
            sq = p.squares[0].square
            if sq in placements:
                valid = False
                break
            placements[sq] = p

        if not valid:
            continue

        # Luego las cuánticas para esta combinación
        for piece_info, sq, sq_prob in combo:
            prob *= sq_prob
            if sq in placements:
                valid = False
                break
            placements[sq] = piece_info

        if not valid or prob < 1e-6:
            continue

        # Construir tablero chess.Board
        board = chess.Board(None)
        board.clear()

        for sq_str, pi in placements.items():
            cell = chess.parse_square(sq_str)
            ptype = PIECE_TYPE_MAP.get(pi.type)
            if ptype is None:
                continue
            is_white = pi.color == "w"
            board.set_piece_at(cell, chess.Piece(ptype, is_white))

        board.turn = chess.WHITE if qs.turn == "w" else chess.BLACK

        # Derechos de enroque
        cr = chess.BB_EMPTY
        if qs.castling.w.get("k", False):
            cr |= chess.BB_H1
        if qs.castling.w.get("q", False):
            cr |= chess.BB_A1
        if qs.castling.b.get("k", False):
            cr |= chess.BB_H8
        if qs.castling.b.get("q", False):
            cr |= chess.BB_A8
        board.castling_rights = cr

        piece_map = {sq_str: pi.id for sq_str, pi in placements.items()}
        boards.append({"fen": board.fen(), "probability": prob, "piece_map": piece_map})

    # Normalizar probabilidades
    total = sum(b["probability"] for b in boards)
    if total > 0:
        for b in boards:
            b["probability"] /= total

    return boards


def _build_board(classical_pieces, quantum_choices, turn, castling):
    """Helper para construir un chess.Board."""
    board = chess.Board(None)
    board.clear()

    for p in classical_pieces:
        sq = chess.parse_square(p.squares[0].square)
        ptype = PIECE_TYPE_MAP.get(p.type)
        if ptype:
            board.set_piece_at(sq, chess.Piece(ptype, p.color == "w"))

    for p, sq_str, _ in quantum_choices:
        sq = chess.parse_square(sq_str)
        ptype = PIECE_TYPE_MAP.get(p.type)
        if ptype:
            board.set_piece_at(sq, chess.Piece(ptype, p.color == "w"))

    board.turn = chess.WHITE if turn == "w" else chess.BLACK
    cr = chess.BB_EMPTY
    if castling.w.get("k", False):
        cr |= chess.BB_H1
    if castling.w.get("q", False):
        cr |= chess.BB_A1
    if castling.b.get("k", False):
        cr |= chess.BB_H8
    if castling.b.get("q", False):
        cr |= chess.BB_A8
    board.castling_rights = cr
    return board


# ---------------------------------------------------------------------------
# Endpoints API
# ---------------------------------------------------------------------------
@app.post("/api/move", response_model=MoveResponse)
def get_best_move(req: MoveRequest):
    """Devuelve la mejor jugada de Stockfish para una posición FEN."""
    preset = DIFFICULTIES.get(req.difficulty, DIFFICULTIES["medium"])

    try:
        board = chess.Board(req.fen)
    except ValueError:
        raise HTTPException(400, "Invalid FEN")

    if board.is_game_over():
        raise HTTPException(400, "Game is already over")

    # Algunos binarios soportan Skill Level explícito.
    # Si no lo soporta, continuamos con límites de profundidad/tiempo.
    def _run_move(active_engine: chess.engine.SimpleEngine):
        try:
            active_engine.configure({"Skill Level": preset["skill"]})
        except chess.engine.EngineError:
            pass  # some builds don't support it

        # Combinamos límite por profundidad y por tiempo:
        # termina al alcanzar el primero, dando buena respuesta en UI.
        limit = chess.engine.Limit(
            depth=preset["depth"],
            time=preset["time"],
        )
        return active_engine.play(board, limit, info=chess.engine.INFO_SCORE)

    result = _with_engine_lock(_run_move)

    evaluation = 0.0
    mate = None
    if result.info and "score" in result.info:
        evaluation, mate = _score_to_eval(result.info["score"])

    if result.move is None:
        raise HTTPException(503, "Engine did not return a move")

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
    try:
        board = chess.Board(req.fen)
    except ValueError:
        raise HTTPException(400, "Invalid FEN")

    info = _with_engine_lock(
        lambda active_engine: active_engine.analyse(
            board,
            chess.engine.Limit(depth=min(req.depth, 18), time=0.3),
        )
    )
    if "score" not in info:
        raise HTTPException(503, "Engine did not return an evaluation")

    evaluation, mate = _score_to_eval(info["score"])

    return EvalResponse(evaluation=evaluation, mate=mate)


@app.get("/api/health")
def health():
    """Endpoint liviano para saber si backend+motor están listos."""
    return {"status": "ok", "engine": STOCKFISH_PATH is not None}


# ---------------------------------------------------------------------------
# Endpoint Cuántico — Enfoque Multiverso
# ---------------------------------------------------------------------------
@app.post("/api/quantum/move")
def quantum_move(req: QuantumMoveRequest):
    """Evalúa todos los tableros clásicos posibles del estado cuántico
    y devuelve la mejor jugada ponderada por probabilidad."""
    preset = DIFFICULTIES.get(req.difficulty, DIFFICULTIES["medium"])

    # 1) Generar todos los universos clásicos
    boards = _generate_classical_boards(req.quantum_state)
    if not boards:
        raise HTTPException(400, "No valid classical boards could be generated")

    # 2) Para cada universo, pedir a Stockfish la mejor jugada
    move_votes: dict[str, float] = {}    # move_uci → suma de probabilidades
    move_evals: dict[str, list] = {}      # move_uci → lista de (prob, eval)
    move_piece_maps: dict[str, dict] = {} # move_uci → piece_map del primer universo

    def _run_quantum(active_engine: chess.engine.SimpleEngine):
        try:
            active_engine.configure({"Skill Level": preset["skill"]})
        except chess.engine.EngineError:
            pass

        limit = chess.engine.Limit(depth=min(preset["depth"], 14), time=min(preset["time"], 0.5))

        for b in boards:
            try:
                board = chess.Board(b["fen"])
            except ValueError:
                continue

            if board.is_game_over() or not any(board.legal_moves):
                continue

            try:
                result = active_engine.play(board, limit, info=chess.engine.INFO_SCORE)
            except chess.engine.EngineError:
                continue

            if result.move is None:
                continue

            move_uci = result.move.uci()
            prob = b["probability"]

            ev = 0.0
            if result.info and "score" in result.info:
                ev, _ = _score_to_eval(result.info["score"])

            if move_uci not in move_votes:
                move_votes[move_uci] = 0.0
                move_evals[move_uci] = []
                move_piece_maps[move_uci] = b["piece_map"]

            move_votes[move_uci] += prob
            move_evals[move_uci].append((prob, ev))

    _with_engine_lock(_run_quantum)

    if not move_votes:
        raise HTTPException(400, "No legal moves found in any universe")

    # 3) Elegir movimiento con mayor voto ponderado
    best_move = max(move_votes, key=move_votes.get)

    # 4) Calcular evaluación ponderada total
    weighted_eval = sum(p * ev for evals in move_evals.values() for p, ev in evals)

    # 5) Identificar qué pieza mueve (del piece_map del primer universo con ese movimiento)
    from_sq = best_move[:2]
    to_sq = best_move[2:4]
    promotion = best_move[4] if len(best_move) > 4 else None

    piece_map = move_piece_maps.get(best_move, {})
    piece_id = piece_map.get(from_sq, "")

    return {
        "pieceId": piece_id,
        "from": from_sq,
        "to": to_sq,
        "promotion": promotion,
        "weightedEval": round(weighted_eval, 1),
        "universeCount": len(boards),
    }


# ---------------------------------------------------------------------------
# Frontend estático
# ---------------------------------------------------------------------------
DIST_DIR = HERE / "frontend" / "dist"
USE_REACT = DIST_DIR.exists() and (DIST_DIR / "index.html").exists()

if USE_REACT:
    print(f"Serving React build from {DIST_DIR}")
else:
        print("React build not found. Run 'cd frontend && npm run build' or use 'npm run dev' inside frontend/")


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
            body {
                font-family: system-ui, sans-serif;
                margin: 0;
                min-height: 100vh;
                display: grid;
                place-items: center;
                background: #111111;
                color: #f5f5f5;
            }
            main {
                max-width: 680px;
                padding: 32px;
                border: 1px solid #2a2a2a;
                border-radius: 16px;
                background: #1a1a1a;
            }
            code {
                font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
                background: #222222;
                padding: 2px 6px;
                border-radius: 6px;
            }
        </style>
    </head>
    <body>
        <main>
            <h1>El frontend no está compilado</h1>
            <p>Este backend ya no usa el frontend legado de la raíz del proyecto.</p>
            <p>Compila la aplicación React con <code>cd frontend && npm install && npm run build</code> o ejecuta el entorno de desarrollo con <code>cd frontend && npm run dev</code>.</p>
        </main>
    </body>
</html>
                """.strip(),
                status_code=503,
        )

# Música siempre se sirve desde music/
_music_dir = HERE / "music"
if _music_dir.exists():
    app.mount("/music", StaticFiles(directory=str(_music_dir)), name="music")

# Assets del build de Vite (JS/CSS hasheados)
if USE_REACT and (DIST_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")


@app.get("/")
def root():
    if USE_REACT:
        return FileResponse(str(DIST_DIR / "index.html"))
    return frontend_not_built_response()


@app.head("/")
def root_head():
    # Evita 405 en health checks que usan HEAD /
    return {"status": "ok"}


@app.get("/{filename:path}")
def static_files(filename: str):
    """Sirve frontend estático con fallback SPA para React."""
    if USE_REACT:
        fp = DIST_DIR / filename
        if fp.is_file():
            return FileResponse(str(fp))

        # Si parece un asset (tiene extensión), no devolver index.html.
        # Evita que CSS/JS faltantes rompan silenciosamente la UI.
        name = pathlib.Path(filename).name
        if "." in name:
            raise HTTPException(404)

        return FileResponse(str(DIST_DIR / "index.html"))

    name = pathlib.Path(filename).name
    if "." in name:
        raise HTTPException(404)
    return frontend_not_built_response()


# ---------------------------------------------------------------------------
# Punto de entrada local
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    print(f"\nGambito de Dama Cuantico server -> http://localhost:{port}\n")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
