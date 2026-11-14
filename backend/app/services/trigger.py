"""Trigger fusion: speech, sound and movement into one alert decision. Owner: Ria."""

from typing import Optional

from app.schemas import AudioChunkResponse


def score_chunk(
    audio_bytes: bytes,
    safe_phrase: str,
    sound_label: Optional[str],
    sound_score: float,
    sudden_stop: bool,
) -> AudioChunkResponse:
    """Transcribe one chunk, check the safe phrase, fuse the signals, decide."""
    raise NotImplementedError("TODO(Ria)")
