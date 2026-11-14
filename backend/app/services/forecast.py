"""Demand forecast and dashboard aggregates. Owner: Soham.

All of this runs on simulated data for the hackathon. The functions must
compute their results from that data, not return hardcoded values.
"""

from app.schemas import CorridorsResponse, ForecastResponse, HeatmapResponse, WaitTimesResponse


def get_heatmap(window_min: int = 60) -> HeatmapResponse:
    """Walk and ride demand by location over the last window, anonymized."""
    raise NotImplementedError("TODO(Soham)")


def get_forecast() -> ForecastResponse:
    """Requests per 30 minutes for each service, recent history plus forecast."""
    raise NotImplementedError("TODO(Soham)")


def get_wait_times() -> WaitTimesResponse:
    """Current and predicted wait per pickup location."""
    raise NotImplementedError("TODO(Soham)")


def get_corridors() -> CorridorsResponse:
    """Most walked origin to destination pairs tonight."""
    raise NotImplementedError("TODO(Soham)")
