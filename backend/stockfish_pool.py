"""Bounded Stockfish process pool.

Each python-chess ``SimpleEngine`` instance may serve only one command at a time.
Leasing engines from a bounded queue prevents concurrent requests from cancelling
each other while also putting a hard ceiling on CPU and process usage.
"""

from __future__ import annotations

import contextlib
import queue
import threading
from collections.abc import Callable
from typing import TypeVar

import chess.engine

ResultT = TypeVar("ResultT")


class EnginePoolTimeout(RuntimeError):
    """Raised when all Stockfish workers remain busy past the queue timeout."""


class StockfishPool:
    def __init__(
        self,
        executable: str,
        *,
        size: int = 2,
        acquire_timeout: float = 3.0,
        engine_options: dict[str, int | str | bool] | None = None,
    ) -> None:
        self.executable = executable
        self.size = max(1, min(size, 8))
        self.acquire_timeout = max(0.05, acquire_timeout)
        self.engine_options = engine_options or {"Threads": 1, "Hash": 64}
        self._available: queue.Queue[chess.engine.SimpleEngine] = queue.Queue(maxsize=self.size)
        self._engines: list[chess.engine.SimpleEngine] = []
        self._lifecycle_lock = threading.Lock()
        self._started = False

    @property
    def started(self) -> bool:
        return self._started

    def start(self) -> None:
        with self._lifecycle_lock:
            if self._started:
                return
            try:
                for _ in range(self.size):
                    engine = chess.engine.SimpleEngine.popen_uci(self.executable)
                    engine.configure(self.engine_options)
                    self._engines.append(engine)
                    self._available.put_nowait(engine)
            except Exception:
                self._close_unlocked()
                raise
            self._started = True

    def run(self, callback: Callable[[chess.engine.SimpleEngine], ResultT]) -> ResultT:
        if not self._started:
            raise EnginePoolTimeout("Stockfish pool is not running")
        try:
            engine = self._available.get(timeout=self.acquire_timeout)
        except queue.Empty as exc:
            raise EnginePoolTimeout("Stockfish queue timed out") from exc

        reusable = True
        try:
            return callback(engine)
        except chess.engine.EngineTerminatedError:
            reusable = False
            self._replace_engine(engine)
            raise
        finally:
            if reusable and self._started:
                self._available.put(engine)

    def healthy(self) -> bool:
        if not self._started or not self._engines:
            return False
        try:
            return self.run(lambda engine: engine.ping() is None)
        except Exception:
            return False

    def _replace_engine(self, failed: chess.engine.SimpleEngine) -> None:
        with self._lifecycle_lock:
            if failed in self._engines:
                self._engines.remove(failed)
            try:
                replacement = chess.engine.SimpleEngine.popen_uci(self.executable)
                replacement.configure(self.engine_options)
                self._engines.append(replacement)
                if self._started:
                    self._available.put(replacement)
            except Exception:
                # The next health check reports the degraded pool. Startup is not
                # retried in a request loop, avoiding an unbounded process storm.
                return

    def close(self) -> None:
        with self._lifecycle_lock:
            self._close_unlocked()

    def _close_unlocked(self) -> None:
        self._started = False
        while True:
            try:
                self._available.get_nowait()
            except queue.Empty:
                break
        for engine in self._engines:
            # Apagado de mejor esfuerzo: un motor ya caído no debe impedir cerrar el resto.
            with contextlib.suppress(Exception):
                engine.quit()
        self._engines.clear()

