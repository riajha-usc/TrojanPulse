"""Shared test setup: a clean in-memory store and no real transcription calls."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import transcribe
from app.store import store


@pytest.fixture(autouse=True)
def clean_store():
    store.reset()
    yield
    store.reset()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def heard(monkeypatch):
    """Make the transcriber return whatever text the test sets in heard["text"]."""
    state = {"text": ""}

    async def fake_transcribe(audio_bytes, filename="chunk.webm", content_type="audio/webm"):
        return state["text"]

    monkeypatch.setattr(transcribe, "transcribe", fake_transcribe)
    return state
