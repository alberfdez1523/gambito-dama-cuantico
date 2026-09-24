"""
Backend de Gambito de Dama Cuantico.

Este servicio hace 3 cosas:
1) Levanta un pool acotado de Stockfish.
2) Expone endpoints HTTP para jugadas/evaluaciones clásicas y cuánticas y la API v1.
3) Sirve el frontend estático para jugar desde el navegador.

Ejecución local:
    python server.py
"""

from __future__ import annotations

import asyncio
import os
import sys
import threading
import time
from contextlib import asynccontextmanager
from functools import partial
from typing import Annotated

import chess
import chess.engine
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from backend.api_v1 import (
    CoachEvaluateRequest,
    academy_repository,
    create_api_v1_router,
    match_repository,
)
from backend.coach import coach_evaluate
from backend.engine_runtime import (
    DIFFICULTIES,
    ROOT_DIR,
    DifficultyLevel,
    EngineRuntime,
    engine_unavailable,
    find_stockfish,
    score_to_eval,
)
from backend.quantum_boards import (
    QuantumCastling,
    QuantumEvalBatchItem,
    QuantumEvalBatchRequest,
    QuantumEvalBatchResponse,
    QuantumEvalRequest,
    QuantumEvalResponse,
    QuantumMoveRequest,
    QuantumPieceInfo,
    QuantumPieceSquare,
    QuantumStatePayload,
    generate_classical_boards,
)
from backend.rate_limit import RateLimitMiddleware
from backend.static_site import mount_frontend

# Alias públicos conservados para las pruebas y scripts existentes.
_score_to_eval = score_to_eval
_generate_classical_boards = generate_classical_boards

__all__ = [
    "app",
    "QuantumCastling",
    "QuantumPieceInfo",
    "QuantumPieceSquare",
    "QuantumStatePayload",
]

# ---------------------------------------------------------------------------
# Motor
# ---------------------------------------------------------------------------
STOCKFISH_PATH = find_stockfish()
SKIP_STOCKFISH = os.getenv("SKIP_STOCKFISH") == "1"

if STOCKFISH_PATH is None and not SKIP_STOCKFISH:
    print("ERROR: Stockfish binary not found.")
    print("       Compile it first:  cd engine/stockfish/src && make -j2 build ARCH=x86-64")
    sys.exit(1)
elif STOCKFISH_PATH is None:
    print("WARNING: Stockfish not found (SKIP_STOCKFISH=1). Engine endpoints will be unavailable.")
else:
    print(f"Stockfish found: {STOCKFISH_PATH}")

engine = EngineRuntime(STOCKFISH_PATH, skip=SKIP_STOCKFISH)

eval_cache_lock = threading.Lock()
eval_cache: dict[tuple[str, int], tuple[float, float, int | None]] = {}
EVAL_CACHE_TTL_SECONDS = 300
EVAL_CACHE_MAX_ITEMS = 512


def _bad_request(message: str) -> HTTPException:
    return HTTPException(status_code=400, detail={"error": message, "code": "BAD_REQUEST"})


def _json_error(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": message, "code": code})


def _http_status_to_code(status_code: int) -> str:
    return {
        400: "BAD_REQUEST",
        404: "NOT_FOUND",
        422: "VALIDATION_ERROR",
        429: "RATE_LIMITED",
        503: "ENGINE_UNAVAILABLE",
    }.get(status_code, "ERROR")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Ciclo de vida de FastAPI: arranque y apagado limpio del motor."""
    engine.start()
    yield
    engine.close()


app = FastAPI(title="Gambito de Dama Cuantico", lifespan=lifespan)


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict) and "error" in exc.detail and "code" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return _json_error(exc.status_code, _http_status_to_code(exc.status_code), str(exc.detail))


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, _exc: RequestValidationError):
    return _json_error(422, "VALIDATION_ERROR", "Invalid request payload")


app.add_middleware(RateLimitMiddleware)

# El frontend se sirve desde el mismo origen, así que CORS solo hace falta para
# orígenes explícitos (por ejemplo un frontend desplegado aparte).
_cors_origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "").split(",") if origin.strip()]
if _cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Guest-Id"],
    )


# ---------------------------------------------------------------------------
# Esquemas clásicos
# ---------------------------------------------------------------------------
FenString = Annotated[str, Field(min_length=1, max_length=120)]


class MoveRequest(BaseModel):
    fen: FenString
    difficulty: DifficultyLevel = "medium"


class MoveResponse(BaseModel):
    bestmove: str  # UCI, p. ej. "e2e4"
    evaluation: float  # centipawns desde blancas
    mate: int | None
    ponder: str | None


class EvalRequest(BaseModel):
    fen: FenString
    depth: Annotated[int, Field(ge=1, le=30)] = 12


class EvalResponse(BaseModel):
    evaluation: float
    mate: int | None


def _parse_fen(fen: str) -> chess.Board:
    try:
        return chess.Board(fen)
    except ValueError as exc:
        raise _bad_request("Invalid FEN") from exc


async def _run_blocking(func, *args):
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, partial(func, *args))


# ---------------------------------------------------------------------------
# Endpoints clásicos
# ---------------------------------------------------------------------------
def _get_best_move_sync(req: MoveRequest) -> MoveResponse:
    preset = DIFFICULTIES[req.difficulty]
    board = _parse_fen(req.fen)
    if board.is_game_over():
        raise _bad_request("Game is already over")

    def _run_move(active_engine: chess.engine.SimpleEngine):
        try:
            active_engine.configure({"Skill Level": preset["skill"]})
        except chess.engine.EngineError:
            pass
        limit = chess.engine.Limit(depth=preset["depth"], time=preset["time"])
        return active_engine.play(board, limit, info=chess.engine.INFO_SCORE)

    result = engine.run(_run_move)
    if result.move is None:
        raise engine_unavailable("Engine did not return a move")

    evaluation, mate = 0.0, None
    if result.info and "score" in result.info:
        evaluation, mate = score_to_eval(result.info["score"])

    return MoveResponse(
        bestmove=result.move.uci(),
        evaluation=evaluation,
        mate=mate,
        ponder=result.ponder.uci() if result.ponder else None,
    )


def _get_evaluation_sync(req: EvalRequest) -> EvalResponse:
    board = _parse_fen(req.fen)
    depth = min(req.depth, 18)
    cache_key = (board.fen(), depth)
    now = time.monotonic()
    with eval_cache_lock:
        cached = eval_cache.get(cache_key)
        if cached and now - cached[0] <= EVAL_CACHE_TTL_SECONDS:
            return EvalResponse(evaluation=cached[1], mate=cached[2])

    info = engine.run(
        lambda active_engine: active_engine.analyse(board, chess.engine.Limit(depth=depth, time=0.3))
    )
    if "score" not in info:
        raise engine_unavailable("Engine did not return an evaluation")

    evaluation, mate = score_to_eval(info["score"])
    with eval_cache_lock:
        eval_cache[cache_key] = (now, evaluation, mate)
        if len(eval_cache) > EVAL_CACHE_MAX_ITEMS:
            oldest_key = min(eval_cache, key=lambda key: eval_cache[key][0])
            eval_cache.pop(oldest_key, None)
    return EvalResponse(evaluation=evaluation, mate=mate)


@app.post("/api/move", response_model=MoveResponse)
async def get_best_move(req: MoveRequest):
    """Devuelve la mejor jugada de Stockfish para una posición FEN."""
    return await _run_blocking(_get_best_move_sync, req)


@app.post("/api/eval", response_model=EvalResponse)
async def get_evaluation(req: EvalRequest):
    """Evalúa una posición sin pedir jugada."""
    return await _run_blocking(_get_evaluation_sync, req)


@app.get("/api/health")
def health():
    """Endpoint liviano para saber si backend+motor están listos."""
    alive = engine.alive()
    return {"status": "ok" if alive else "degraded", "engine": alive}


# ---------------------------------------------------------------------------
# Endpoints cuánticos — enfoque multiverso
# ---------------------------------------------------------------------------
def _quantum_move_sync(req: QuantumMoveRequest):
    preset = DIFFICULTIES[req.difficulty]
    boards = generate_classical_boards(req.quantum_state)
    if not boards:
        raise _bad_request("No valid classical boards could be generated")

    move_votes: dict[str, float] = {}  # move_uci → suma de probabilidades
    move_evals: dict[str, list[tuple[float, float]]] = {}
    move_piece_maps: dict[str, dict] = {}  # move_uci → piece_map del primer universo

    def _run_quantum(active_engine: chess.engine.SimpleEngine):
        try:
            active_engine.configure({"Skill Level": preset["skill"]})
        except chess.engine.EngineError:
            pass
        limit = chess.engine.Limit(depth=min(preset["depth"], 14), time=min(preset["time"], 0.5))

        for candidate in boards:
            try:
                board = chess.Board(candidate["fen"])
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
            evaluation = 0.0
            if result.info and "score" in result.info:
                evaluation, _ = score_to_eval(result.info["score"])

            if move_uci not in move_votes:
                move_votes[move_uci] = 0.0
                move_evals[move_uci] = []
                move_piece_maps[move_uci] = candidate["piece_map"]
            move_votes[move_uci] += candidate["probability"]
            move_evals[move_uci].append((candidate["probability"], evaluation))

    engine.run(_run_quantum)
    if not move_votes:
        raise _bad_request("No legal moves found in any universe")

    best_move = max(move_votes, key=move_votes.get)
    weighted_eval = sum(p * ev for evals in move_evals.values() for p, ev in evals)
    from_sq = best_move[:2]
    return {
        "pieceId": move_piece_maps.get(best_move, {}).get(from_sq, ""),
        "from": from_sq,
        "to": best_move[2:4],
        "promotion": best_move[4] if len(best_move) > 4 else None,
        "weightedEval": round(weighted_eval, 1),
        "universeCount": len(boards),
    }


def _quantum_eval_sync(req: QuantumEvalRequest) -> QuantumEvalResponse:
    boards = generate_classical_boards(req.quantum_state, max_boards=req.max_boards)
    if not boards:
        raise _bad_request("No valid classical boards could be generated")

    depth = min(req.depth, 10)

    def _run_eval(active_engine: chess.engine.SimpleEngine):
        weighted_eval = 0.0
        total_prob = 0.0
        mate = None
        for candidate in boards:
            try:
                board = chess.Board(candidate["fen"])
            except ValueError:
                continue
            if board.is_game_over():
                continue
            info = active_engine.analyse(board, chess.engine.Limit(depth=depth, time=0.2))
            if "score" not in info:
                continue
            evaluation, local_mate = score_to_eval(info["score"])
            weighted_eval += candidate["probability"] * evaluation
            total_prob += candidate["probability"]
            if local_mate is not None:
                mate = local_mate

        if total_prob <= 0:
            raise _bad_request("No evaluable boards")
        return QuantumEvalResponse(
            evaluation=round(weighted_eval / total_prob, 1),
            mate=mate,
            universeCount=len(boards),
        )

    return engine.run(_run_eval)


def _quantum_eval_batch_sync(req: QuantumEvalBatchRequest) -> QuantumEvalBatchResponse:
    if not req.quantum_states:
        raise _bad_request("No quantum states provided")

    results: list[QuantumEvalBatchItem] = []
    for state in req.quantum_states:
        item = _quantum_eval_sync(
            QuantumEvalRequest(quantum_state=state, depth=req.depth, max_boards=req.max_boards),
        )
        results.append(
            QuantumEvalBatchItem(evaluation=item.evaluation, mate=item.mate, universeCount=item.universeCount)
        )
    return QuantumEvalBatchResponse(results=results)


@app.post("/api/quantum/eval", response_model=QuantumEvalResponse)
async def quantum_eval(req: QuantumEvalRequest):
    """Evalúa un estado cuántico ponderando universos clásicos (sin decidir jugadas)."""
    return await _run_blocking(_quantum_eval_sync, req)


@app.post("/api/quantum/eval-batch", response_model=QuantumEvalBatchResponse)
async def quantum_eval_batch(req: QuantumEvalBatchRequest):
    """Evalúa varios estados cuánticos en una sola petición."""
    return await _run_blocking(_quantum_eval_batch_sync, req)


@app.post("/api/quantum/move")
async def quantum_move(req: QuantumMoveRequest):
    """Endpoint experimental: voto de bestmove clásico por universo.

    La IA de producto usa quantumAi.ts + /api/quantum/eval. Este endpoint queda
    para análisis/QA manual.
    """
    return await _run_blocking(_quantum_move_sync, req)


# ---------------------------------------------------------------------------
# API v1: progreso, coach determinista, retos y partidas autoritativas
# ---------------------------------------------------------------------------
def _coach_evaluate(req: CoachEvaluateRequest) -> dict:
    return coach_evaluate(req, engine.run)


app.include_router(
    create_api_v1_router(
        academy=academy_repository,
        matches=match_repository,
        coach_evaluator=_coach_evaluate,
    )
)

# Debe registrarse al final: incluye la ruta comodín del fallback SPA.
mount_frontend(app, ROOT_DIR)


# ---------------------------------------------------------------------------
# Punto de entrada local
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    print(f"\nGambito de Dama Cuantico server -> http://localhost:{port}\n")
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info",
        # Detrás de un proxy (Render) la IP real llega en X-Forwarded-For; solo se
        # confía en ella para las IPs indicadas, necesario para el limitador.
        proxy_headers=True,
        forwarded_allow_ips=os.getenv("FORWARDED_ALLOW_IPS", "127.0.0.1"),
    )
