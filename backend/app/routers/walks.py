"""Walk sessions and the audio endpoint. Owner: Ria.

STUB: returns fixtures.

The audio endpoint's chunk length and audio format are NOT decided yet.
Ria and Sharyu agree them before either side builds (see README, Handoffs).
"""

from typing import Optional

from fastapi import APIRouter, File, Form, UploadFile

from app import fixtures
from app.schemas import AudioChunkResponse, Walk, WalkCreateRequest

router = APIRouter(prefix="/walks", tags=["walks"])


@router.post("", response_model=Walk, status_code=201)
def start_walk(body: WalkCreateRequest) -> Walk:
    # TODO(Ria): create the walk session
    return fixtures.WALK


@router.post("/{walk_id}/end", response_model=Walk)
def end_walk(walk_id: str) -> Walk:
    # TODO(Ria): mark the walk ended
    return fixtures.WALK.model_copy(update={"status": "ended", "ended_at": fixtures.NOW})


@router.post("/{walk_id}/audio", response_model=AudioChunkResponse)
async def score_audio_chunk(
    walk_id: str,
    audio: UploadFile = File(..., description="One audio chunk. Format to be agreed."),
    sound_label: Optional[str] = Form(None, description="Top label from the in-browser classifier"),
    sound_score: float = Form(0.0, description="Score for sound_label, 0 to 1"),
    sudden_stop: bool = Form(False, description="Movement signal from the phone"),
) -> AudioChunkResponse:
    # TODO(Ria): call services.trigger.score_chunk(...)
    return fixtures.AUDIO_RESULT
