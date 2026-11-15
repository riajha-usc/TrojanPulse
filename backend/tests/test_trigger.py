"""Trigger fusion rules. These are the cases the pitch makes claims about."""

from app.services.trigger import fuse, heard_safe_phrase
from app.store import store

PHRASE = "red umbrella"


def test_safe_phrase_alone_triggers():
    result = fuse("I think it might rain, red umbrella", PHRASE, None, 0.0, False)
    assert result.triggered and result.alert_score == 1.0
    assert "Safe phrase heard" in result.reasons


def test_safe_phrase_ignores_case_punctuation_and_small_slips():
    assert heard_safe_phrase("RED, Umbrella!", PHRASE)
    assert heard_safe_phrase("red umbrela", PHRASE)
    assert not heard_safe_phrase("a red car and a blue umbrella", PHRASE)
    assert not heard_safe_phrase("my blue umbrella", PHRASE)
    assert not heard_safe_phrase("red", PHRASE)
    assert not heard_safe_phrase("", PHRASE)


def test_shout_alone_does_not_trigger():
    assert not fuse("", PHRASE, "Shouting", 0.95, False).triggered


def test_shout_and_sudden_stop_do_not_trigger():
    assert not fuse("", PHRASE, "Shouting", 0.95, True).triggered


def test_one_distress_phrase_alone_does_not_trigger():
    assert not fuse("leave me alone", PHRASE, None, 0.0, False).triggered
    assert not fuse("can you help me find the library", PHRASE, None, 0.0, False).triggered


def test_three_signals_together_trigger():
    result = fuse("Stop following me. Leave me alone!", PHRASE, "Shouting", 0.91, True)
    assert result.triggered
    assert result.reasons == ['Said "stop following me"', "Shouting 0.91", "Sudden stop"]


def test_party_noise_does_not_trigger():
    assert not fuse("this party is so loud", PHRASE, "Music", 0.99, True).triggered
    assert not fuse("ha ha stop it", PHRASE, "Laughter", 0.97, False).triggered


def test_sound_score_is_clamped():
    assert fuse("", PHRASE, "Screaming", 7.0, False).sound_score == 1.0


def test_phrase_split_across_two_chunks_is_joined():
    first = store.recent_transcript("walk_x", "it is fine. Red")
    assert not heard_safe_phrase(first, PHRASE)
    second = store.recent_transcript("walk_x", "umbrella. I said stop")
    assert heard_safe_phrase(second, PHRASE)
