"""Versioned public API contracts for Academy, coach, challenges and matches."""

from __future__ import annotations

import os
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request, Response
from pydantic import BaseModel, ConfigDict, Field, model_validator

from .academy_service import AcademyRepository
from .auth import AuthenticationError, token_verifier
from .match_service import MatchRepository, MatchServiceError

RulesetId = Literal["classic", "quantum-standard", "quantum-coherence"]
CourseId = Literal["classic", "quantum"]


def _to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


class APIModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=_to_camel, extra="forbid")


class AttemptEventModel(APIModel):
    id: UUID
    guest_id: Annotated[str, Field(min_length=8, max_length=160)]
    lesson_id: Annotated[str, Field(min_length=1, max_length=120)]
    content_version: Annotated[str, Field(min_length=1, max_length=40)]
    started_at: datetime
    completed_at: datetime
    answer_index: Annotated[int, Field(ge=0, le=10)]
    correct: bool
    hints_used: Annotated[int, Field(ge=0, le=4)]
    actions_taken: Annotated[int, Field(ge=1, le=1000)]
    score: int = Field(ge=0, le=100)
    validated_online: bool = False

    @model_validator(mode="after")
    def completion_follows_start(self) -> AttemptEventModel:
        if self.completed_at < self.started_at:
            raise ValueError("completedAt must not precede startedAt")
        return self


class ProgressSyncRequest(APIModel):
    course: CourseId = "classic"
    events: list[AttemptEventModel] = Field(max_length=250)
    source_guest_id: Annotated[str | None, Field(min_length=8, max_length=160)] = None


class DailyAttemptRequest(APIModel):
    attempt_id: UUID
    lesson_id: Annotated[str, Field(min_length=1, max_length=120)]
    answer_index: Annotated[int, Field(ge=0, le=3)]
    hints_used: Annotated[int, Field(ge=0, le=4)]
    actions_taken: Annotated[int, Field(ge=1, le=1000)]
    duration_ms: Annotated[int, Field(ge=0, le=86_400_000)]


class FinishedReplayModel(APIModel):
    schema_version: Literal[1]
    id: Annotated[str, Field(min_length=8, max_length=160)]
    created_at: datetime
    ruleset_id: RulesetId
    opponent_mode: Literal["ai", "local", "online"]
    result: dict[str, Any] | None = None
    actions: Annotated[list[dict[str, Any]], Field(max_length=2000)]
    initial_state: dict[str, Any] | None = None
    final_hash: Annotated[str | None, Field(max_length=160)] = None
    options: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_replay_shape(self) -> FinishedReplayModel:
        if self.ruleset_id == "classic" and self.initial_state is not None:
            raise ValueError("Classic replays must not include an initialState")
        if self.ruleset_id != "classic" and (self.initial_state is None or self.final_hash is None):
            raise ValueError("Quantum replays require initialState and finalHash")
        for entry in self.actions:
            if self.ruleset_id == "classic":
                if entry.get("kind") != "classic" or "description" in entry:
                    raise ValueError("Classic replay actions must be neutral")
            else:
                action = entry.get("action")
                if not isinstance(action, dict) or action.get("kind") not in {
                    "classical", "quantum", "merge", "quantumCastle",
                } or "description" in entry or "description" in action:
                    raise ValueError("Quantum replay actions must be neutral")
        return self


class ReplaySyncRequest(APIModel):
    replays: Annotated[list[FinishedReplayModel], Field(max_length=50)]


class AnalyticsEventModel(APIModel):
    id: Annotated[str, Field(min_length=8, max_length=160)]
    consent: Literal[True]
    anonymous_session_id: Annotated[str, Field(min_length=8, max_length=160)]
    route: Annotated[str, Field(min_length=1, max_length=80)]
    lesson_id: Annotated[str | None, Field(max_length=120)] = None
    concept: Annotated[str | None, Field(max_length=120)] = None
    duration_ms: Annotated[int | None, Field(ge=0, le=86_400_000)] = None
    score: Annotated[int | None, Field(ge=0, le=100)] = None
    hint_level: Annotated[int | None, Field(ge=0, le=4)] = None


class TimeControlModel(APIModel):
    initial_seconds: Annotated[int, Field(ge=30, le=86_400)]
    increment_seconds: Annotated[int, Field(ge=0, le=120)]


class CreateMatchRequest(APIModel):
    ruleset_id: RulesetId
    mode: Literal["casual", "competitive"] = "casual"
    color: Literal["w", "b", "random"] = "random"
    time_control: TimeControlModel = TimeControlModel(
        initialSeconds=600,
        incrementSeconds=0,
    )
    options: dict[str, Any] = Field(default_factory=dict)
    join_code: Annotated[str | None, Field(min_length=6, max_length=6)] = None


class SubmitActionRequest(APIModel):
    action_id: UUID
    expected_version: Annotated[int, Field(ge=0)]
    action: dict[str, Any]
    client_timestamp: datetime


class CoachEvaluateRequest(APIModel):
    ruleset_id: RulesetId
    fen: str | None = Field(default=None, max_length=160)
    action: str | dict[str, Any] | None = None
    legal_actions: Annotated[list[dict[str, Any]], Field(max_length=256)] = Field(default_factory=list)
    seed: str = Field(default="coach-v1", max_length=120)
    depth: int = Field(default=12, ge=1, le=18)


@dataclass(frozen=True)
class Actor:
    key: str
    linked_account: bool


CoachEvaluator = Callable[[CoachEvaluateRequest], dict[str, Any]]


def _actor_from_request(request: Request) -> Actor:
    authorization = request.headers.get("authorization", "")
    if authorization.lower().startswith("bearer "):
        try:
            identity = token_verifier.verify(authorization[7:].strip())
        except AuthenticationError as exc:
            raise HTTPException(
                status_code=401,
                detail={"error": str(exc), "code": "INVALID_ACCESS_TOKEN"},
            ) from exc
        return Actor(
            key=f"profile:{identity.user_id}",
            linked_account=not identity.is_anonymous,
        )

    # A trusted reverse proxy may provide a verified identity. It is disabled by
    # default so a browser cannot promote itself by sending this header.
    profile_id = request.headers.get("x-profile-id")
    if profile_id and os.getenv("TRUST_AUTH_PROXY", "0") == "1":
        return Actor(key=f"profile:{profile_id[:160]}", linked_account=True)
    guest_id = request.headers.get("x-guest-id")
    if guest_id and 8 <= len(guest_id) <= 160:
        return Actor(key=f"guest:{guest_id}", linked_account=False)
    raise HTTPException(
        status_code=401,
        detail={"error": "X-Guest-Id or authenticated profile is required", "code": "IDENTITY_REQUIRED"},
    )


def create_api_v1_router(
    *,
    academy: AcademyRepository,
    matches: MatchRepository,
    coach_evaluator: CoachEvaluator,
) -> APIRouter:
    router = APIRouter(prefix="/api/v1", tags=["v1"])

    @router.post("/progress/sync")
    def sync_progress(payload: ProgressSyncRequest, request: Request) -> dict[str, Any]:
        actor = _actor_from_request(request)
        if actor.linked_account and payload.source_guest_id:
            try:
                academy.claim_guest(actor.key, payload.source_guest_id)
            except PermissionError as exc:
                raise HTTPException(
                    status_code=409,
                    detail={"error": str(exc), "code": "GUEST_ALREADY_CLAIMED"},
                ) from exc
        events = [event.model_dump(mode="json", by_alias=True) for event in payload.events]
        if not actor.linked_account:
            mismatched = [event["id"] for event in events if event["guestId"] != actor.key.removeprefix("guest:")]
            if mismatched:
                raise HTTPException(
                    status_code=403,
                    detail={"error": "Guest event ownership mismatch", "code": "EVENT_OWNERSHIP_MISMATCH"},
                )
        return academy.sync(actor.key, events, payload.course)

    @router.get("/academy/recommendation")
    def academy_recommendation(
        request: Request,
        course: CourseId = Query(default="classic"),
    ) -> dict[str, Any]:
        actor = _actor_from_request(request)
        return academy.recommendation(actor.key, course)

    @router.post("/coach/evaluate")
    def evaluate_with_coach(payload: CoachEvaluateRequest, request: Request) -> dict[str, Any]:
        _actor_from_request(request)
        return coach_evaluator(payload)

    @router.get("/daily/{challenge_date}")
    def get_daily_challenge(
        challenge_date: date,
        course: CourseId = Query(default="classic"),
    ) -> dict[str, Any]:
        return academy.daily(challenge_date, course)

    @router.post("/daily/{challenge_date}/attempts")
    def submit_daily_attempt(
        challenge_date: date,
        payload: DailyAttemptRequest,
        request: Request,
    ) -> dict[str, Any]:
        actor = _actor_from_request(request)
        attempt = payload.model_dump(mode="json", by_alias=True)
        course: CourseId = "quantum" if attempt["lessonId"].startswith("quantum-") else "classic"
        expected = academy.daily(challenge_date, course)
        if attempt["lessonId"] != expected["lessonId"]:
            raise HTTPException(
                status_code=422,
                detail={"error": "Attempt does not match the daily challenge", "code": "CHALLENGE_MISMATCH"},
            )
        return academy.add_daily_attempt(actor.key, challenge_date, attempt)

    @router.post("/replays/sync")
    def sync_finished_replays(payload: ReplaySyncRequest, request: Request) -> dict[str, Any]:
        actor = _actor_from_request(request)
        if not actor.linked_account:
            raise HTTPException(
                status_code=403,
                detail={"error": "A linked account is required", "code": "ACCOUNT_REQUIRED"},
            )
        try:
            replays = [replay.model_dump(mode="json", by_alias=True) for replay in payload.replays]
            return academy.sync_finished_replays(actor.key, replays)
        except PermissionError as exc:
            raise HTTPException(
                status_code=403,
                detail={"error": str(exc), "code": "ACCOUNT_REQUIRED"},
            ) from exc

    @router.post("/analytics/events", status_code=202)
    def record_analytics_event(payload: AnalyticsEventModel) -> dict[str, Any]:
        event = payload.model_dump(mode="json", by_alias=True)
        event.pop("consent", None)
        accepted = academy.record_analytics(event)
        return {"accepted": accepted}

    @router.post("/matches")
    def create_match(payload: CreateMatchRequest, request: Request) -> dict[str, Any]:
        actor = _actor_from_request(request)
        try:
            return matches.create_or_join(
                actor.key,
                actor.linked_account,
                payload.model_dump(mode="json", by_alias=True),
            )
        except MatchServiceError as exc:
            raise HTTPException(
                status_code=exc.status_code,
                detail={"error": exc.message, "code": exc.code},
            ) from exc

    @router.post("/matches/{match_id}/actions")
    def submit_match_action(
        match_id: UUID,
        payload: SubmitActionRequest,
        request: Request,
    ) -> dict[str, Any]:
        actor = _actor_from_request(request)
        try:
            return matches.apply_action(
                str(match_id),
                actor.key,
                payload.model_dump(mode="json", by_alias=True),
            )
        except MatchServiceError as exc:
            raise HTTPException(
                status_code=exc.status_code,
                detail={"error": exc.message, "code": exc.code},
            ) from exc

    @router.get("/matches/{match_id}/events")
    def get_match_events(
        match_id: UUID,
        request: Request,
        after_version: int = Query(alias="afterVersion", default=0, ge=0),
    ) -> dict[str, Any]:
        actor = _actor_from_request(request)
        try:
            return matches.events_after(str(match_id), actor.key, after_version)
        except MatchServiceError as exc:
            raise HTTPException(
                status_code=exc.status_code,
                detail={"error": exc.message, "code": exc.code},
            ) from exc

    @router.get("/profile/export")
    def export_profile(request: Request) -> dict[str, Any]:
        actor = _actor_from_request(request)
        return academy.export(actor.key)

    @router.delete("/profile", status_code=204)
    def delete_profile(request: Request) -> Response:
        actor = _actor_from_request(request)
        academy.delete(actor.key)
        return Response(status_code=204)

    return router


academy_repository = AcademyRepository()
match_repository = MatchRepository(
    quantum_actions_enabled=os.getenv("FEATURE_AUTHORITATIVE_QUANTUM", "0") == "1",
)
