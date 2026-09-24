"""Deterministic, append-only Academy progress domain service.

The repository is intentionally storage-agnostic. The in-memory adapter keeps local
development and tests useful; production persistence is defined by the versioned
Supabase migration and can implement the same methods without changing the API.
"""

from __future__ import annotations

import hashlib
import threading
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any

REVIEW_INTERVAL_DAYS = (1, 3, 7, 14, 30)
ACTIVITY_KINDS = ("lesson", "guided", "puzzle", "exam")
COURSE_MODULES = {
    "classic": (
        ("classic-board", "classic.board"),
        ("classic-rules", "classic.rules"),
        ("classic-opening", "classic.opening"),
        ("classic-tactics", "classic.tactics"),
        ("classic-defense", "classic.defense"),
        ("classic-pawns", "classic.pawns"),
        ("classic-endgames", "classic.endgames"),
        ("classic-calculation", "classic.calculation"),
    ),
    "quantum": (
        ("quantum-model", "quantum.model"),
        ("quantum-classical", "quantum.classical"),
        ("quantum-split", "quantum.split"),
        ("quantum-merge", "quantum.merge"),
        ("quantum-measurement", "quantum.measurement"),
        ("quantum-tunnel", "quantum.tunnel"),
        ("quantum-entanglement", "quantum.entanglement"),
        ("quantum-strategy", "quantum.strategy"),
    ),
}


def _now() -> datetime:
    return datetime.now(UTC)


def _parse_timestamp(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def lesson_skill(lesson_id: str) -> str | None:
    for modules in COURSE_MODULES.values():
        for module_id, skill_id in modules:
            if lesson_id in {f"{module_id}-{kind}" for kind in ACTIVITY_KINDS}:
                return skill_id
    return None


def course_lesson_ids(course: str) -> list[str]:
    return [
        f"{module_id}-{kind}"
        for module_id, _skill_id in COURSE_MODULES.get(course, ())
        for kind in ACTIVITY_KINDS
    ]


@dataclass
class Mastery:
    skill_id: str
    mastery: float = 0
    confidence: int = 0
    attempts: int = 0
    independent_passes: int = 0
    interval_index: int = -1
    last_practiced_at: str | None = None
    next_review_at: str | None = None

    def public(self) -> dict[str, Any]:
        return {
            "skillId": self.skill_id,
            "mastery": self.mastery,
            "confidence": self.confidence,
            "attempts": self.attempts,
            "independentPasses": self.independent_passes,
            "intervalIndex": max(0, self.interval_index),
            "lastPracticedAt": self.last_practiced_at,
            "nextReviewAt": self.next_review_at,
        }


class AcademyRepository:
    """Thread-safe append-only adapter used when no database adapter is configured."""

    def __init__(self) -> None:
        self._events: dict[str, dict[str, dict[str, Any]]] = {}
        self._mastery: dict[str, dict[str, Mastery]] = {}
        self._daily_attempts: dict[str, dict[str, dict[str, Any]]] = {}
        self._finished_replays: dict[str, dict[str, dict[str, Any]]] = {}
        self._analytics_events: dict[str, dict[str, Any]] = {}
        self._guest_claims: dict[str, str] = {}
        self._lock = threading.RLock()

    def claim_guest(self, profile_actor: str, guest_id: str) -> None:
        """Atomically merge a local guest identity into a linked account."""
        if not profile_actor.startswith("profile:"):
            raise ValueError("A linked profile is required")
        guest_actor = f"guest:{guest_id}"
        with self._lock:
            claimed_by = self._guest_claims.get(guest_id)
            if claimed_by and claimed_by != profile_actor:
                raise PermissionError("Guest progress was already linked to another account")
            self._guest_claims[guest_id] = profile_actor
            combined = {
                **self._events.get(guest_actor, {}),
                **self._events.get(profile_actor, {}),
            }
            self._events[profile_actor] = {}
            self._mastery[profile_actor] = {}
            self._events.pop(guest_actor, None)
            self._mastery.pop(guest_actor, None)
            guest_daily = self._daily_attempts.pop(guest_actor, {})
            self._daily_attempts.setdefault(profile_actor, {}).update(guest_daily)
            self.sync(profile_actor, list(combined.values()), "classic")

    def sync(self, actor: str, events: list[dict[str, Any]], course: str) -> dict[str, Any]:
        accepted: list[str] = []
        duplicates: list[str] = []
        with self._lock:
            actor_events = self._events.setdefault(actor, {})
            actor_mastery = self._mastery.setdefault(actor, {})
            for event in sorted(events, key=lambda item: (item["completedAt"], item["id"])):
                event_id = event["id"]
                if event_id in actor_events:
                    duplicates.append(event_id)
                    continue
                skill_id = lesson_skill(event["lessonId"])
                if skill_id is None:
                    # Unknown content versions are retained for audit but do not
                    # mutate mastery until that curriculum is deployed server-side.
                    actor_events[event_id] = {**event, "status": "unknown-content"}
                    accepted.append(event_id)
                    continue

                actor_events[event_id] = {**event, "status": "applied"}
                accepted.append(event_id)
                previous = actor_mastery.get(skill_id, Mastery(skill_id=skill_id))
                score = max(0, min(100, int(event["score"])))
                successful = bool(event["correct"]) and score >= 70
                independent = successful and int(event["hintsUsed"]) == 0
                interval_index = (
                    min(len(REVIEW_INTERVAL_DAYS) - 1, previous.interval_index + 1)
                    if successful
                    else max(0, previous.interval_index - 1)
                )
                completed_at = _parse_timestamp(event["completedAt"])
                actor_mastery[skill_id] = Mastery(
                    skill_id=skill_id,
                    mastery=round(previous.mastery * 0.7 + score * 0.3, 1),
                    confidence=min(100, previous.confidence + (18 if independent else 12 if successful else 8)),
                    attempts=previous.attempts + 1,
                    independent_passes=previous.independent_passes + (1 if independent else 0),
                    interval_index=interval_index,
                    last_practiced_at=completed_at.isoformat(),
                    next_review_at=(completed_at + timedelta(days=REVIEW_INTERVAL_DAYS[interval_index])).isoformat(),
                )

            recommendation = self._recommendation_unlocked(actor, course)
            return {
                "acceptedEventIds": accepted,
                "duplicateEventIds": duplicates,
                "mastery": {key: value.public() for key, value in actor_mastery.items()},
                "recommendation": recommendation,
                "serverTime": _now().isoformat(),
            }

    def recommendation(self, actor: str, course: str) -> dict[str, Any]:
        with self._lock:
            return self._recommendation_unlocked(actor, course)

    def _recommendation_unlocked(self, actor: str, course: str) -> dict[str, Any]:
        now = _now()
        mastery = self._mastery.get(actor, {})
        due_skills = {
            skill_id
            for skill_id, item in mastery.items()
            if item.next_review_at and _parse_timestamp(item.next_review_at) <= now
        }
        applied = [
            event
            for event in self._events.get(actor, {}).values()
            if event.get("status") == "applied" and event.get("correct")
        ]
        completed = {event["lessonId"] for event in applied}
        ids = course_lesson_ids(course)

        for lesson_id in ids:
            if lesson_id in completed and lesson_skill(lesson_id) in due_skills:
                return {"lessonId": lesson_id, "reason": "review", "dueReviewCount": len(due_skills)}
        for lesson_id in ids:
            if lesson_id not in completed:
                return {
                    "lessonId": lesson_id,
                    "reason": "continue" if completed else "start",
                    "dueReviewCount": 0,
                }
        return {"lessonId": None, "reason": "complete", "dueReviewCount": 0}

    def daily(self, requested_date: date, course: str) -> dict[str, Any]:
        digest = hashlib.sha256(f"academy-daily-v1:{requested_date.isoformat()}".encode()).hexdigest()
        puzzle_ids = [lesson_id for lesson_id in course_lesson_ids(course) if lesson_id.endswith("-puzzle")]
        lesson_id = puzzle_ids[int(digest[:8], 16) % len(puzzle_ids)]
        return {
            "date": requested_date.isoformat(),
            "seed": digest[:24],
            "rulesetId": "classic" if course == "classic" else "quantum-standard",
            "difficulty": "medium",
            "scoringPolicy": "score-v1-time-tiebreak",
            "lessonId": lesson_id,
        }

    def add_daily_attempt(self, actor: str, requested_date: date, attempt: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            attempts = self._daily_attempts.setdefault(actor, {})
            attempt_id = attempt["attemptId"]
            duplicate = attempt_id in attempts
            if not duplicate:
                correct = int(attempt["answerIndex"]) == 1
                hint_penalties = (0, 8, 20, 35, 50)
                hints_used = max(0, min(4, int(attempt["hintsUsed"])))
                efficiency_penalty = min(15, max(0, int(attempt["actionsTaken"]) - 1) * 5)
                score = max(0, min(100, (100 if correct else 35) - hint_penalties[hints_used] - efficiency_penalty))
                attempts[attempt_id] = {
                    **attempt,
                    "correct": correct,
                    "score": score,
                    "date": requested_date.isoformat(),
                    "validatedOnline": True,
                    "receivedAt": _now().isoformat(),
                }
            same_day = [row for row in attempts.values() if row["date"] == requested_date.isoformat()]
            ordered = sorted(same_day, key=lambda row: (-int(row["score"]), int(row["durationMs"])))
            rank = next((index + 1 for index, row in enumerate(ordered) if row["attemptId"] == attempt_id), None)
            saved = attempts[attempt_id]
            return {
                "accepted": not duplicate,
                "validatedOnline": True,
                "correct": saved["correct"],
                "score": saved["score"],
                "privateRank": rank,
            }

    def sync_finished_replays(self, actor: str, replays: list[dict[str, Any]]) -> dict[str, Any]:
        """Idempotently stores neutral action streams for linked accounts."""
        if not actor.startswith("profile:"):
            raise PermissionError("A linked profile is required to sync replays")
        accepted: list[str] = []
        duplicates: list[str] = []
        with self._lock:
            stored = self._finished_replays.setdefault(actor, {})
            for replay in sorted(replays, key=lambda item: (item["createdAt"], item["id"])):
                replay_id = replay["id"]
                if replay_id in stored:
                    duplicates.append(replay_id)
                    continue
                stored[replay_id] = {**replay, "receivedAt": _now().isoformat()}
                accepted.append(replay_id)
        return {
            "acceptedReplayIds": accepted,
            "duplicateReplayIds": duplicates,
            "serverTime": _now().isoformat(),
        }

    def record_analytics(self, event: dict[str, Any]) -> bool:
        """Stores only the validated anonymous allow-list; returns false for duplicates."""
        with self._lock:
            event_id = event["id"]
            if event_id in self._analytics_events:
                return False
            self._analytics_events[event_id] = {
                key: event[key]
                for key in (
                    "id", "anonymousSessionId", "route", "lessonId", "concept",
                    "durationMs", "score", "hintLevel",
                )
            } | {"receivedAt": _now().isoformat()}
            return True

    def export(self, actor: str) -> dict[str, Any]:
        with self._lock:
            return {
                "schemaVersion": 1,
                "exportedAt": _now().isoformat(),
                "progressEvents": list(self._events.get(actor, {}).values()),
                "mastery": {
                    key: value.public() for key, value in self._mastery.get(actor, {}).items()
                },
                "dailyAttempts": list(self._daily_attempts.get(actor, {}).values()),
                "finishedReplays": list(self._finished_replays.get(actor, {}).values()),
            }

    def delete(self, actor: str) -> None:
        with self._lock:
            self._events.pop(actor, None)
            self._mastery.pop(actor, None)
            self._daily_attempts.pop(actor, None)
            self._finished_replays.pop(actor, None)

    def reset(self) -> None:
        """Test helper; production adapters should not expose a bulk reset."""
        with self._lock:
            self._events.clear()
            self._mastery.clear()
            self._daily_attempts.clear()
            self._finished_replays.clear()
            self._guest_claims.clear()
            self._analytics_events.clear()
