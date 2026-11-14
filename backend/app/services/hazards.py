"""Hazard reports and their AI summaries. Owner: Soham.

Hazards describe infrastructure only (light out, blocked path), never people.
"""

from typing import List

from app.schemas import Hazard, HazardType, LatLng


def list_hazards() -> List[Hazard]:
    """Return active hazards, one per spot, each with a report count and summary."""
    raise NotImplementedError("TODO(Soham)")


def add_report(hazard_type: HazardType, location: LatLng) -> Hazard:
    """Record a one-tap report, merge it with nearby reports, refresh the summary."""
    raise NotImplementedError("TODO(Soham)")
