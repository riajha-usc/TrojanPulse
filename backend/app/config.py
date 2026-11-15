"""Settings read from environment variables. See .env.example at the repo root."""

import os
from pathlib import Path
from typing import List

try:  # read a .env file at the repo root if there is one (it is gitignored)
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
except ImportError:
    pass


class Settings:
    cors_origins: List[str] = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    simulated_data: bool = os.getenv("SIMULATED_DATA", "true").lower() == "true"
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    groq_whisper_model: str = os.getenv("GROQ_WHISPER_MODEL", "whisper-large-v3-turbo")
    transcribe_timeout_s: float = float(os.getenv("TRANSCRIBE_TIMEOUT_S", "8"))
    llm_api_key: str = os.getenv("LLM_API_KEY", "")
    safe_phrase: str = os.getenv("SAFE_PHRASE", "red umbrella")
    trigger_threshold: float = float(os.getenv("TRIGGER_THRESHOLD", "0.75"))
    # Emergency contacts are simulated for the hackathon: every student has this many.
    demo_contacts: int = int(os.getenv("DEMO_CONTACTS", "2"))


settings = Settings()
