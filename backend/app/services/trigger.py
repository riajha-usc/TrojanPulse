"""Trigger fusion: speech, sound and movement into one alert decision. Owner: Ria.

Three signals arrive for each audio chunk:
  1. the transcript (did the student say the safe phrase, or distress words?)
  2. the in-browser sound classifier (a label such as "Shouting" and a score)
  3. movement (did the phone suddenly stop?)

Rules:
  - The safe phrase alone always triggers. It is the student's explicit signal.
  - Otherwise the three signals are combined as a noisy-OR: each one is an
    independent chance that something is wrong, and the alert score is the
    chance that at least one of them is right. No single weak signal can
    cross the threshold alone, so a shout at a party does not fire.
"""

import re
from difflib import SequenceMatcher
from typing import List, Optional

from app.config import settings
from app.schemas import AudioChunkResponse

# Spoken phrases that suggest distress, with how much each counts (0 to 1).
DISTRESS_PHRASES = {
    "stop following me": 0.6,
    "leave me alone": 0.6,
    "get away from me": 0.6,
    "let go of me": 0.6,
    "dont touch me": 0.6,
    "call the police": 0.55,
    "somebody help": 0.55,
    "help me": 0.5,
    "help": 0.35,
}

# Sound classifier labels that count as distress. Matched as lowercase substrings.
DISTRESS_SOUNDS = ("scream", "shout", "yell", "crying", "glass", "shatter", "gunshot")

SOUND_WEIGHT = 0.7  # a perfect distress sound alone reaches 0.7, below the threshold
STOP_WEIGHT = 0.2
WORD_MATCH_RATIO = 0.8  # per-word tolerance for small transcription errors in the safe phrase


def normalize(text: str) -> str:
    """Lowercase, drop punctuation, collapse spaces."""
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", "", text.lower())).strip()


def heard_safe_phrase(transcript: str, safe_phrase: str) -> bool:
    """True when the safe phrase appears in the transcript, allowing small transcription slips.

    Every word of the phrase has to match its own counterpart. Comparing the
    phrase as one string is too loose: "blue umbrella" is 80% similar to
    "red umbrella" and would fire a false alarm.
    """
    words = normalize(transcript).split()
    phrase = normalize(safe_phrase).split()
    if not phrase or len(words) < len(phrase):
        return False

    def same(heard: str, expected: str) -> bool:
        return heard == expected or SequenceMatcher(None, heard, expected).ratio() >= WORD_MATCH_RATIO

    return any(
        all(same(words[start + i], expected) for i, expected in enumerate(phrase))
        for start in range(len(words) - len(phrase) + 1)
    )


def speech_score(transcript: str) -> "tuple[float, Optional[str]]":
    """Strongest distress phrase found in the transcript, and its weight."""
    text = normalize(transcript)
    best, best_phrase = 0.0, None
    for phrase, weight in DISTRESS_PHRASES.items():
        if re.search(rf"\b{re.escape(phrase)}\b", text) and weight > best:
            best, best_phrase = weight, phrase
    return best, best_phrase


def is_distress_sound(sound_label: Optional[str]) -> bool:
    label = (sound_label or "").lower()
    return any(key in label for key in DISTRESS_SOUNDS)

