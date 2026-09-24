"""Enumeración de universos clásicos a partir de un estado cuántico (enfoque multiverso)."""

from __future__ import annotations

from itertools import product
from typing import Annotated, Literal

import chess
from pydantic import BaseModel, Field

from .engine_runtime import DifficultyLevel

# Límites defensivos: el producto cartesiano crece exponencialmente con el número de
# piezas superpuestas, así que acotamos tanto la entrada como el trabajo total.
MAX_PIECES = 32
MAX_SQUARES_PER_PIECE = 16
MAX_BOARDS = 256
MAX_COMBINATIONS_SCANNED = 20_000

SquareName = Annotated[str, Field(pattern=r"^[a-h][1-8]$")]


class QuantumPieceSquare(BaseModel):
    square: SquareName
    probability: Annotated[float, Field(ge=0.0, le=1.000001)]


class QuantumPieceInfo(BaseModel):
    id: Annotated[str, Field(max_length=40)]
    type: Literal["p", "n", "b", "r", "q", "k"]
    color: Literal["w", "b"]
    squares: Annotated[list[QuantumPieceSquare], Field(min_length=1, max_length=MAX_SQUARES_PER_PIECE)]


class QuantumCastling(BaseModel):
    w: dict[str, bool]  # { k: bool, q: bool }
    b: dict[str, bool]


class QuantumStatePayload(BaseModel):
    pieces: Annotated[list[QuantumPieceInfo], Field(max_length=MAX_PIECES)]
    turn: Literal["w", "b"]
    castling: QuantumCastling


class QuantumMoveRequest(BaseModel):
    quantum_state: QuantumStatePayload
    difficulty: DifficultyLevel = "medium"


class QuantumMoveResponse(BaseModel):
    pieceId: str
    from_sq: str  # "from" es palabra reservada en Python
    to: str
    promotion: str | None = None
    weightedEval: float
    universeCount: int


class QuantumEvalRequest(BaseModel):
    quantum_state: QuantumStatePayload
    depth: Annotated[int, Field(ge=1, le=18)] = 8
    max_boards: Annotated[int, Field(ge=1, le=MAX_BOARDS)] = 128


class QuantumEvalResponse(BaseModel):
    evaluation: float
    mate: int | None
    universeCount: int


class QuantumEvalBatchRequest(BaseModel):
    quantum_states: Annotated[list[QuantumStatePayload], Field(max_length=24)]
    depth: Annotated[int, Field(ge=1, le=18)] = 8
    max_boards: Annotated[int, Field(ge=1, le=MAX_BOARDS)] = 128


class QuantumEvalBatchItem(BaseModel):
    evaluation: float
    mate: int | None
    universeCount: int


class QuantumEvalBatchResponse(BaseModel):
    results: list[QuantumEvalBatchItem]


PIECE_TYPE_MAP = {
    "p": chess.PAWN,
    "n": chess.KNIGHT,
    "b": chess.BISHOP,
    "r": chess.ROOK,
    "q": chess.QUEEN,
    "k": chess.KING,
}


def _castling_rights(castling: QuantumCastling) -> int:
    rights = chess.BB_EMPTY
    if castling.w.get("k", False):
        rights |= chess.BB_H1
    if castling.w.get("q", False):
        rights |= chess.BB_A1
    if castling.b.get("k", False):
        rights |= chess.BB_H8
    if castling.b.get("q", False):
        rights |= chess.BB_A8
    return rights


def _board_from_placements(
    placements: dict[str, QuantumPieceInfo],
    turn: str,
    castling: QuantumCastling,
) -> chess.Board:
    board = chess.Board(None)
    for square, piece in placements.items():
        piece_type = PIECE_TYPE_MAP.get(piece.type)
        if piece_type is not None:
            board.set_piece_at(chess.parse_square(square), chess.Piece(piece_type, piece.color == "w"))
    board.turn = chess.WHITE if turn == "w" else chess.BLACK
    board.castling_rights = _castling_rights(castling)
    return board


def generate_classical_boards(qs: QuantumStatePayload, max_boards: int = 128) -> list[dict]:
    """Genera los tableros clásicos posibles a partir del estado cuántico.

    Cada pieza cuántica (>1 posición) aporta opciones; el producto cartesiano produce
    universos clásicos. Se descartan universos con dos piezas en la misma casilla.
    """
    max_boards = max(1, min(max_boards, MAX_BOARDS))
    classical = [p for p in qs.pieces if len(p.squares) == 1 and p.squares[0].probability >= 0.999999]
    quantum = [p for p in qs.pieces if not (len(p.squares) == 1 and p.squares[0].probability >= 0.999999)]

    base: dict[str, QuantumPieceInfo] = {}
    for piece in classical:
        square = piece.squares[0].square
        if square in base:
            return []
        base[square] = piece

    boards: list[dict] = []
    options = [[(piece, sq.square, sq.probability) for sq in piece.squares] for piece in quantum]

    for scanned, combo in enumerate(product(*options)):
        if len(boards) >= max_boards or scanned >= MAX_COMBINATIONS_SCANNED:
            break

        probability = 1.0
        placements = dict(base)
        valid = True
        for piece, square, square_probability in combo:
            probability *= square_probability
            if square in placements:
                valid = False
                break
            placements[square] = piece

        if not valid or probability < 1e-6:
            continue

        board = _board_from_placements(placements, qs.turn, qs.castling)
        piece_map = {square: piece.id for square, piece in placements.items()}
        boards.append({"fen": board.fen(), "probability": probability, "piece_map": piece_map})

    total = sum(b["probability"] for b in boards)
    if total > 0:
        for b in boards:
            b["probability"] /= total
    return boards
