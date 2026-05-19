import os
import pytest
from unittest.mock import MagicMock, patch

os.environ.setdefault("SKIP_STOCKFISH", "1")

from fastapi.testclient import TestClient
import server


@pytest.fixture()
def client():
    server.engine = None
    with TestClient(server.app) as test_client:
        yield test_client
    server.engine = None


def test_health_degraded_without_engine(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "degraded"
    assert data["engine"] is False


def test_move_invalid_fen_returns_json_error(client):
    response = client.post("/api/move", json={"fen": "not-a-fen", "difficulty": "medium"})
    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "BAD_REQUEST"
    assert "error" in body


def test_eval_invalid_fen_returns_json_error(client):
    response = client.post("/api/eval", json={"fen": "bad"})
    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "BAD_REQUEST"


def test_move_with_mock_engine(client):
    mock_engine = MagicMock()
    mock_move = MagicMock()
    mock_move.uci.return_value = "e2e4"
    mock_result = MagicMock()
    mock_result.move = mock_move
    mock_result.ponder = None
    mock_result.info = {"score": MagicMock()}

    with patch.object(server, "engine", mock_engine), patch.object(server, "_score_to_eval", return_value=(25.0, None)):
        mock_engine.play.return_value = mock_result
        response = client.post(
            "/api/move",
            json={"fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "difficulty": "easy"},
        )

    assert response.status_code == 200
    assert response.json()["bestmove"] == "e2e4"


def test_invalid_difficulty_rejected(client):
    response = client.post(
        "/api/move",
        json={"fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "difficulty": "impossible"},
    )
    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "VALIDATION_ERROR"
