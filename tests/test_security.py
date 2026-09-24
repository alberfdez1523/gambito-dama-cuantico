"""Pruebas de endurecimiento: archivos estáticos, límite de peticiones y payloads."""

import os

os.environ.setdefault("SKIP_STOCKFISH", "1")

import pathlib

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import server
from backend.quantum_boards import (
    MAX_COMBINATIONS_SCANNED,
    QuantumCastling,
    QuantumPieceInfo,
    QuantumPieceSquare,
    QuantumStatePayload,
    generate_classical_boards,
)
from backend.rate_limit import RateLimitMiddleware, RateRule, SlidingWindowLimiter
from backend.static_site import mount_frontend, resolve_inside


@pytest.fixture
def site(tmp_path: pathlib.Path):
    dist = tmp_path / "frontend" / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("INDEX")
    (dist / "sw.js").write_text("SW")
    (dist / "assets" / "app.js").write_text("APP")
    (tmp_path / "secret.txt").write_text("SECRET")
    app = FastAPI()
    mount_frontend(app, tmp_path)
    return TestClient(app), tmp_path


@pytest.mark.parametrize(
    "path",
    ["/..%2Fsecret.txt", "/../secret.txt", "/%2e%2e/secret.txt", "/..%2F..%2Fetc%2Fpasswd", "/assets/..%2F..%2Fsecret.txt"],
)
def test_static_files_do_not_escape_dist(site, path):
    client, _root = site
    response = client.get(path)
    assert "SECRET" not in response.text
    assert response.status_code == 404


def test_resolve_inside_rejects_parent(tmp_path):
    (tmp_path / "dist").mkdir()
    (tmp_path / "outside.txt").write_text("x")
    assert resolve_inside(tmp_path / "dist", "../outside.txt") is None


def test_static_files_serve_build_and_spa_fallback(site):
    client, _root = site
    assert client.get("/assets/app.js").text == "APP"
    sw = client.get("/sw.js")
    assert sw.text == "SW"
    assert sw.headers["cache-control"] == "no-cache"
    fallback = client.get("/learn/some-lesson")
    assert fallback.text == "INDEX"
    assert client.get("/missing.js").status_code == 404
    assert client.get("/api/unknown").status_code == 404


def test_sliding_window_limiter_blocks_and_recovers():
    now = [0.0]
    limiter = SlidingWindowLimiter(clock=lambda: now[0])
    key = ("engine", "1.2.3.4")
    assert limiter.hit(key, 2) is None
    assert limiter.hit(key, 2) is None
    assert limiter.hit(key, 2) is not None
    assert limiter.hit(("engine", "5.6.7.8"), 2) is None
    now[0] = 61.0
    assert limiter.hit(key, 2) is None


def test_rate_limit_middleware_returns_429():
    app = FastAPI()

    @app.post("/api/eval")
    def fake_eval():
        return {"ok": True}

    @app.get("/api/health")
    def fake_health():
        return {"ok": True}

    app.add_middleware(RateLimitMiddleware, rules=[RateRule("engine", ("/api/eval",), 2)])
    client = TestClient(app)
    assert client.post("/api/eval").status_code == 200
    assert client.post("/api/eval").status_code == 200
    blocked = client.post("/api/eval")
    assert blocked.status_code == 429
    assert blocked.json()["code"] == "RATE_LIMITED"
    assert int(blocked.headers["retry-after"]) >= 1
    for _ in range(5):
        assert client.get("/api/health").status_code == 200


def test_health_does_not_leak_engine_path():
    with TestClient(server.app) as client:
        assert "engine_path" not in client.get("/api/health").json()


def test_cors_is_not_open_by_default():
    with TestClient(server.app) as client:
        response = client.get("/api/health", headers={"Origin": "https://evil.example"})
        assert "access-control-allow-origin" not in response.headers


def _piece(piece_id: str, piece_type: str, color: str, squares: dict[str, float]) -> QuantumPieceInfo:
    return QuantumPieceInfo(
        id=piece_id,
        type=piece_type,
        color=color,
        squares=[QuantumPieceSquare(square=sq, probability=p) for sq, p in squares.items()],
    )


def test_generate_boards_bounds_pathological_superpositions():
    # Muchas piezas superpuestas en las mismas casillas: casi todas las combinaciones
    # colisionan y antes el bucle podía recorrer el producto cartesiano completo.
    squares = {sq: 0.25 for sq in ("a3", "b3", "c3", "d3")}
    pieces = [_piece(f"n{i}", "n", "w", squares) for i in range(12)]
    pieces += [_piece("wk", "k", "w", {"e1": 1.0}), _piece("bk", "k", "b", {"e8": 1.0})]
    state = QuantumStatePayload(
        pieces=pieces,
        turn="w",
        castling=QuantumCastling(w={"k": False, "q": False}, b={"k": False, "q": False}),
    )
    assert generate_classical_boards(state) == []
    assert MAX_COMBINATIONS_SCANNED < 4 ** 12


def test_generate_boards_normalises_split_piece():
    state = QuantumStatePayload(
        pieces=[
            _piece("wk", "k", "w", {"e1": 1.0}),
            _piece("bk", "k", "b", {"e8": 1.0}),
            _piece("wn", "n", "w", {"f3": 0.5, "h3": 0.5}),
        ],
        turn="w",
        castling=QuantumCastling(w={"k": False, "q": False}, b={"k": False, "q": False}),
    )
    boards = generate_classical_boards(state)
    assert len(boards) == 2
    assert sum(b["probability"] for b in boards) == pytest.approx(1.0)


def test_quantum_payload_limits_are_validated():
    with TestClient(server.app) as client:
        response = client.post(
            "/api/quantum/eval",
            json={
                "quantum_state": {
                    "pieces": [{"id": "x", "type": "z", "color": "w", "squares": [{"square": "e9", "probability": 1}]}],
                    "turn": "w",
                    "castling": {"w": {}, "b": {}},
                },
                "max_boards": 10_000,
            },
        )
        assert response.status_code == 422
