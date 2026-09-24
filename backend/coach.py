"""Coach determinista: clasifica jugadas sin enviar posiciones a modelos generativos."""

from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

import chess
import chess.engine
from fastapi import HTTPException

from .api_v1 import CoachEvaluateRequest
from .engine_runtime import score_to_eval

EngineRunner = Callable[[Callable[[chess.engine.SimpleEngine], Any]], Any]


def coach_classification(centipawn_loss: float) -> str:
    if centipawn_loss <= 10:
        return "best"
    if centipawn_loss <= 30:
        return "excellent"
    if centipawn_loss <= 70:
        return "good"
    if centipawn_loss <= 130:
        return "inaccuracy"
    if centipawn_loss <= 260:
        return "mistake"
    return "blunder"


def coach_evaluate(req: CoachEvaluateRequest, run_engine: EngineRunner) -> dict:
    """Produce reproducible feedback without sending positions to generative models."""
    if req.ruleset_id != "classic":
        ranked = sorted(
            req.legal_actions,
            key=lambda candidate: (
                -float(candidate.get("evaluation", 0)),
                json.dumps(candidate.get("action", {}), sort_keys=True),
            ),
        )[:3]
        return {
            "classification": "best" if ranked else "good",
            "concepts": ["quantum.expected-material", "quantum.coherence", "quantum.king-safety"],
            "candidates": [
                {
                    "action": candidate.get("action", {}),
                    "score": float(candidate.get("evaluation", 0)),
                    "probability": candidate.get("probability"),
                }
                for candidate in ranked
            ],
            "probabilities": [candidate.get("probability") for candidate in ranked if candidate.get("probability") is not None],
            "explanationKey": "coach.quantum.deterministic-evaluation",
            "engine": "quantum-enumerator-v1",
            "seed": req.seed,
        }

    if not req.fen:
        raise HTTPException(status_code=422, detail={"error": "FEN is required for classic coaching", "code": "VALIDATION_ERROR"})
    try:
        board = chess.Board(req.fen)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": "Invalid FEN", "code": "BAD_REQUEST"}) from exc
    if board.is_game_over():
        raise HTTPException(status_code=400, detail={"error": "Game is already over", "code": "BAD_REQUEST"})

    action_uci = req.action if isinstance(req.action, str) else None
    side_to_move = board.turn

    def _analyse(active_engine: chess.engine.SimpleEngine):
        multipv = active_engine.analyse(
            board,
            chess.engine.Limit(depth=req.depth, time=0.45),
            multipv=3,
        )
        infos = multipv if isinstance(multipv, list) else [multipv]
        actual_evaluation = None
        if action_uci:
            try:
                actual_move = chess.Move.from_uci(action_uci)
            except ValueError as exc:
                raise HTTPException(status_code=422, detail={"error": "Malformed action", "code": "ILLEGAL_ACTION"}) from exc
            if actual_move not in board.legal_moves:
                raise HTTPException(status_code=422, detail={"error": "Illegal action", "code": "ILLEGAL_ACTION"})
            after = board.copy(stack=False)
            after.push(actual_move)
            actual_info = active_engine.analyse(after, chess.engine.Limit(depth=max(1, req.depth - 1), time=0.3))
            if "score" in actual_info:
                actual_evaluation, _mate = score_to_eval(actual_info["score"])
        return infos, actual_evaluation

    infos, actual_evaluation = run_engine(_analyse)
    candidates = []
    for info in infos:
        principal_variation = info.get("pv", [])
        if not principal_variation or "score" not in info:
            continue
        evaluation, _mate = score_to_eval(info["score"])
        candidates.append({"action": principal_variation[0].uci(), "score": evaluation})
    if not candidates:
        raise HTTPException(status_code=503, detail={"error": "Coach returned no candidates", "code": "ENGINE_UNAVAILABLE"})

    best_evaluation = candidates[0]["score"]
    if action_uci and action_uci == candidates[0]["action"]:
        centipawn_loss = 0.0
    elif actual_evaluation is None:
        centipawn_loss = 0.0
    else:
        centipawn_loss = (
            best_evaluation - actual_evaluation
            if side_to_move == chess.WHITE
            else actual_evaluation - best_evaluation
        )
    centipawn_loss = max(0.0, centipawn_loss)

    concepts = ["classic.calculation"]
    if action_uci:
        move = chess.Move.from_uci(action_uci)
        if board.is_capture(move):
            concepts.append("classic.tactics.capture")
        if board.is_castling(move):
            concepts.append("classic.opening.king-safety")
        after = board.copy(stack=False)
        after.push(move)
        if after.is_check():
            concepts.append("classic.tactics.check")

    classification = coach_classification(centipawn_loss)
    return {
        "classification": classification,
        "concepts": concepts,
        "candidates": candidates,
        "probabilities": [],
        "explanationKey": f"coach.classic.{classification}",
        "centipawnLoss": round(centipawn_loss, 1),
        "engine": "stockfish-multipv",
    }
