"""Settings read from environment variables. See .env.example at the repo root."""

import os
from typing import List


class Settings:
    cors_origins: List[str] = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    simulated_data: bool = os.getenv("SIMULATED_DATA", "true").lower() == "true"
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    llm_api_key: str = os.getenv("LLM_API_KEY", "")


settings = Settings()
