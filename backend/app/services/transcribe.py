"""Speech to text through Groq's hosted Whisper. Owner: Ria.

Returns an empty string when no API key is configured or the call fails, so
the trigger still works from the sound and movement signals alone.
"""

import logging

import httpx

from app.config import settings

log = logging.getLogger(__name__)

GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions"


async def transcribe(audio_bytes: bytes, filename: str = "chunk.webm", content_type: str = "audio/webm") -> str:
    if not settings.groq_api_key or not audio_bytes:
        return ""
    try:
        async with httpx.AsyncClient(timeout=settings.transcribe_timeout_s) as client:
            response = await client.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                files={"file": (filename, audio_bytes, content_type)},
                data={"model": settings.groq_whisper_model, "language": "en", "response_format": "json"},
            )
            response.raise_for_status()
            return str(response.json().get("text", "")).strip()
    except Exception as exc:  # network, auth, bad audio: never crash a walk over it
        log.warning("Transcription failed: %s", exc)
        return ""
