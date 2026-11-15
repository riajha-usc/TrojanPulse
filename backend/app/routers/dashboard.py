"""Campus Pulse dashboard data. Endpoint owner: Ria. Data logic owner: Soham.

Heatmap, forecast, wait times and corridors come from services.forecast.
The summary is assembled here from Soham's data plus the live walks and
alerts. Every endpoint falls back to example data if the data files are missing.
"""

from datetime import datetime, timedelta

from fastapi import APIRouter

from app import fixtures
from app.config import settings
from app.deps import service_or_fixture
from app.schemas import (
    CorridorsResponse,
    DashboardSummary,
    ForecastResponse,
    HeatmapResponse,
    LatLng,
    WaitTimesResponse,
)
from app.services import forecast, hazards, pods
from app.store import store
from data import places
from data import store as data_store

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

WALK_MINUTES = 20  # a simulated walker counts as "walking now" for this long after leaving


def live_summary() -> DashboardSummary:
    """Counts from the simulated data at the demo clock, plus real walks and alerts from this server."""
    now = places.DEMO_NOW
    walking = [
        w
        for w in data_store.load("walkers")
        if timedelta(0) <= now - datetime.fromisoformat(w["depart_at"]) <= timedelta(minutes=WALK_MINUTES)
    ]
    forming = {
        pod.id for lat, lng in places.DESTINATIONS.values() for pod in pods.match_pods(LatLng(lat=lat, lng=lng), 0)
    }
    active_hazards = hazards.list_hazards()  # busiest first
    return DashboardSummary(
        simulated=settings.simulated_data,
        active_walks=len(walking) + len(store.active_walks()),
        pods_in_progress=len(forming),
        active_hazard_reports=sum(h.report_count for h in active_hazards),
        open_alerts=len(store.open_alerts()),
        median_response_s=fixtures.SUMMARY.median_response_s,  # simulated: no responder data exists yet
        top_hazard_summary=active_hazards[0].summary if active_hazards else "No active hazard reports.",
    )


@router.get("/summary", response_model=DashboardSummary)
def summary() -> DashboardSummary:
    example = fixtures.SUMMARY.model_copy(
        update={"simulated": settings.simulated_data, "open_alerts": len(store.open_alerts())}
    )
    return service_or_fixture(live_summary, example)


@router.get("/heatmap", response_model=HeatmapResponse)
def heatmap() -> HeatmapResponse:
    return service_or_fixture(forecast.get_heatmap, fixtures.HEATMAP)


@router.get("/forecast", response_model=ForecastResponse)
def get_forecast() -> ForecastResponse:
    return service_or_fixture(forecast.get_forecast, fixtures.FORECAST)


@router.get("/wait-times", response_model=WaitTimesResponse)
def wait_times() -> WaitTimesResponse:
    return service_or_fixture(forecast.get_wait_times, fixtures.WAIT_TIMES)


@router.get("/corridors", response_model=CorridorsResponse)
def corridors() -> CorridorsResponse:
    return service_or_fixture(forecast.get_corridors, fixtures.CORRIDORS)
