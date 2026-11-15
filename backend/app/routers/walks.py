"""Walk sessions and the audio endpoint. Owner: Ria.

The audio endpoint's chunk length and audio format are NOT decided yet.
Ria and Sharyu agree them before either side builds (see README, Handoffs).
"""

from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app import fixtures
from app.config import settings
from app.deps import current_user, service_or_fixture
from app.schemas import AudioChunkResponse, RouteOption, User, Walk, WalkCreateRequest
from app.services import routing, transcribe, trigger
from app.store import new_id, now, store

router = APIRouter(prefix="/walks", tags=["walks"])


def get_active_walk(walk_id: str) -> Walk:
    walk = store.walks.get(walk_id)
    if walk is None:
        raise HTTPException(status_code=404, detail="Walk not found")
    if walk.status != "active":
        raise HTTPException(status_code=409, detail="Walk has ended")
    return walk


@router.post("", response_model=Walk, status_code=201)
def start_walk(body: WalkCreateRequest, user: User = Depends(current_user)) -> Walk:
    routes = service_or_fixture(lambda: routing.get_routes(body.origin, body.destination), fixtures.ROUTES)
    route: RouteOption = routes.safest if body.route_kind == "safest" else routes.fastest
    walk = Walk(
        id=new_id("walk"),
        user_id=user.id,
        status="active",
        destination_label=body.destination_label,
        route=route,
        pod_id=body.pod_id,
        safe_phrase=settings.safe_phrase,
        started_at=now(),
    )
    store.locations[walk.id] = body.origin
    return store.add_walk(walk)


@router.get("/{walk_id}", response_model=Walk)
def get_walk(walk_id: str) -> Walk:
    walk = store.walks.get(walk_id)
    if walk is None:
        raise HTTPException(status_code=404, detail="Walk not found")
    return walk


@router.post("/{walk_id}/end", response_model=Walk)
def end_walk(walk_id: str) -> Walk:
    walk = store.end_walk(walk_id)
    if walk is None:
        raise HTTPException(status_code=404, detail="Walk not found")
    return walk


@router.post("/{walk_id}/audio", response_model=AudioChunkResponse)
async def score_audio_chunk(
    walk_id: str,
    audio: UploadFile = File(..., description="One audio chunk. Format to be agreed."),
    sound_label: Optional[str] = Form(None, description="Top label from the in-browser classifier"),
    sound_score: float = Form(0.0, description="Score for sound_label, 0 to 1"),
    sudden_stop: bool = Form(False, description="Movement signal from the phone"),
) -> AudioChunkResponse:
    """Score one chunk. The mic is only ever sent for an active walk."""
    walk = get_active_walk(walk_id)
    audio_bytes = await audio.read()
    text = await transcribe.transcribe(
        audio_bytes,
        filename=audio.filename or "chunk.webm",
        content_type=audio.content_type or "audio/webm",
    )
    # Match against this chunk joined with the previous one, so a phrase cut
    # in half by the chunk boundary is still caught.
    context = store.recent_transcript(walk_id, text)
    result = trigger.fuse(context, walk.safe_phrase, sound_label, sound_score, sudden_stop)
    return result.model_copy(update={"transcript": context})
