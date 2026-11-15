"""Hazard reports and their AI summaries. Owner: Soham.

Hazards describe infrastructure only (light out, blocked path), never people.

Reports of the same type within 30 m of each other are one hazard; report_count is the group size.
Only reports from the past 7 days are active. The summary is one neutral sentence written by an LLM
when GROQ_API_KEY is set, or a fixed sentence pattern otherwise.
Reports added with add_report live in memory, so they reset when the server restarts.
"""

import os
from datetime import datetime as dt
from datetime import timedelta
from functools import lru_cache
from typing import List

from app.schemas import Hazard, HazardType, LatLng
from data import places, store
from data.extract_incidents import GROQ_MODEL
from data.graph import meters, nearest_street, short_street

GROUP_RADIUS_M = 30
ACTIVE_DAYS = 7

_new_reports: List[dict] = []


def list_hazards() -> List[Hazard]:
    """Return active hazards, one per spot, each with a report count and summary."""
    return [_to_hazard(group) for group in _groups(_active_reports())]


def add_report(hazard_type: HazardType, location: LatLng) -> Hazard:
    """Record a one-tap report, merge it with nearby reports, refresh the summary."""
    report = {
        "id": f"rep_new_{len(_new_reports) + 1}",
        "type": hazard_type,
        "lat": location.lat,
        "lng": location.lng,
        "time": places.DEMO_NOW.isoformat(),
    }
    _new_reports.append(report)
    group = next(g for g in _groups(_active_reports()) if any(r["id"] == report["id"] for r in g))
    return _to_hazard(group)


# ---------------------------------------------------------------- grouping


def _active_reports() -> List[dict]:
    now = places.DEMO_NOW
    reports = store.load("hazard_reports") + _new_reports
    return [r for r in reports if timedelta(0) <= now - dt.fromisoformat(r["time"]) <= timedelta(days=ACTIVE_DAYS)]


def _groups(reports: List[dict]) -> List[List[dict]]:
    """Same-type reports chained within GROUP_RADIUS_M become one group. Busiest groups first."""
    parent = list(range(len(reports)))

    def root(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i, a in enumerate(reports):
        for j in range(i + 1, len(reports)):
            b = reports[j]
            if a["type"] == b["type"] and meters((a["lat"], a["lng"]), (b["lat"], b["lng"])) <= GROUP_RADIUS_M:
                parent[root(j)] = root(i)

    groups: dict = {}
    for i, report in enumerate(reports):
        groups.setdefault(root(i), []).append(report)
    return sorted(groups.values(), key=lambda g: (-len(g), _first(g)["id"]))


def _first(group: List[dict]) -> dict:
    return min(group, key=lambda r: (r["time"], r["id"]))


def _to_hazard(group: List[dict]) -> Hazard:
    lat = sum(r["lat"] for r in group) / len(group)
    lng = sum(r["lng"] for r in group) / len(group)
    kind = group[0]["type"]
    street = short_street(nearest_street(lat, lng))
    latest = max(dt.fromisoformat(r["time"]) for r in group)
    return Hazard(
        id="hz_" + _first(group)["id"].removeprefix("rep_"),
        type=kind,
        location=LatLng(lat=round(lat, 6), lng=round(lng, 6)),
        report_count=len(group),
        summary=_summary(kind, street, len(group)),
        updated_at=latest.replace(tzinfo=places.LA_TZ),
    )


# ---------------------------------------------------------------- summary


PATTERNS = {
    "light_out": "Streetlight out on {street}",
    "blocked_path": "Path blocked on {street}",
    "other": "Issue reported on {street}",
}


def _pattern_summary(kind: str, street: str, count: int) -> str:
    return PATTERNS[kind].format(street=street) + f", {count} report{'s' if count != 1 else ''} this week."


@lru_cache(maxsize=256)
def _summary(kind: str, street: str, count: int) -> str:
    """One neutral sentence for the map pin. Cached, so each combination asks the LLM only once."""
    fallback = _pattern_summary(kind, street, count)
    if not os.getenv("GROQ_API_KEY"):
        return fallback
    try:
        from groq import Groq

        response = Groq().chat.completions.create(
            model=GROQ_MODEL,
            temperature=0,
            reasoning_effort="low",
            max_completion_tokens=300,  # room for the model's reasoning before the sentence
            messages=[
                {
                    "role": "system",
                    "content": "Write one short, neutral sentence for a campus safety map pin. Describe only the "
                    "place and the infrastructure problem, never any person or neighborhood. Mention the street "
                    "and the number of reports this week. No emojis.",
                },
                {"role": "user", "content": f"Problem: {kind.replace('_', ' ')}. Street: {street}. Reports: {count}."},
            ],
        )
        sentence = response.choices[0].message.content.strip().strip('"')
        return sentence if 0 < len(sentence) <= 140 else fallback
    except Exception:
        return fallback
