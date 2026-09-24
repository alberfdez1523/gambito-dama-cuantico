"""Limitador de peticiones en memoria por IP y grupo de rutas (ventana deslizante).

Protege los endpoints que consumen Stockfish y la ingesta anónima de analítica. Es
un límite por proceso: con varias instancias hay que moverlo a un almacén compartido.
"""

from __future__ import annotations

import math
import os
import threading
import time
from collections import deque
from dataclasses import dataclass

from starlette.types import ASGIApp, Receive, Scope, Send

WINDOW_SECONDS = 60.0
MAX_TRACKED_KEYS = 10_000


@dataclass(frozen=True)
class RateRule:
    name: str
    prefixes: tuple[str, ...]
    per_minute: int


def _env_limit(name: str, default: int) -> int:
    try:
        return max(1, int(os.getenv(name, str(default))))
    except ValueError:
        return default


def default_rules() -> list[RateRule]:
    # El orden importa: gana la primera regla cuyo prefijo coincida.
    return [
        RateRule(
            "engine",
            ("/api/move", "/api/eval", "/api/quantum/", "/api/v1/coach/"),
            _env_limit("RATE_LIMIT_ENGINE_PER_MINUTE", 60),
        ),
        RateRule("analytics", ("/api/v1/analytics/",), _env_limit("RATE_LIMIT_ANALYTICS_PER_MINUTE", 120)),
        RateRule("api", ("/api/v1/",), _env_limit("RATE_LIMIT_API_PER_MINUTE", 240)),
    ]


class SlidingWindowLimiter:
    def __init__(self, clock=time.monotonic) -> None:
        self._clock = clock
        self._hits: dict[tuple[str, str], deque[float]] = {}
        self._lock = threading.Lock()

    def hit(self, key: tuple[str, str], limit: int) -> float | None:
        """Registra un acceso. Devuelve None si se permite o los segundos de espera."""
        now = self._clock()
        cutoff = now - WINDOW_SECONDS
        with self._lock:
            hits = self._hits.get(key)
            if hits is None:
                if len(self._hits) >= MAX_TRACKED_KEYS:
                    self._prune(cutoff)
                hits = self._hits.setdefault(key, deque())
            while hits and hits[0] <= cutoff:
                hits.popleft()
            if len(hits) >= limit:
                return max(0.0, hits[0] + WINDOW_SECONDS - now)
            hits.append(now)
            return None

    def _prune(self, cutoff: float) -> None:
        stale = [key for key, hits in self._hits.items() if not hits or hits[-1] <= cutoff]
        for key in stale:
            del self._hits[key]
        if len(self._hits) >= MAX_TRACKED_KEYS:
            self._hits.clear()

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


class RateLimitMiddleware:
    def __init__(self, app: ASGIApp, rules: list[RateRule] | None = None, limiter: SlidingWindowLimiter | None = None):
        self.app = app
        self.rules = rules if rules is not None else default_rules()
        self.limiter = limiter or SlidingWindowLimiter()
        self.enabled = os.getenv("RATE_LIMIT_ENABLED", "1") != "0"

    def _rule_for(self, path: str) -> RateRule | None:
        for rule in self.rules:
            if any(path.startswith(prefix) for prefix in rule.prefixes):
                return rule
        return None

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if not self.enabled or scope["type"] != "http" or scope.get("method") == "OPTIONS":
            await self.app(scope, receive, send)
            return
        rule = self._rule_for(scope.get("path", ""))
        if rule is None:
            await self.app(scope, receive, send)
            return

        client = scope.get("client")
        client_ip = client[0] if client else "unknown"
        retry_after = self.limiter.hit((rule.name, client_ip), rule.per_minute)
        if retry_after is None:
            await self.app(scope, receive, send)
            return

        body = b'{"error":"Too many requests; retry later","code":"RATE_LIMITED"}'
        await send({
            "type": "http.response.start",
            "status": 429,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(body)).encode()),
                (b"retry-after", str(max(1, math.ceil(retry_after))).encode()),
            ],
        })
        await send({"type": "http.response.body", "body": body})
