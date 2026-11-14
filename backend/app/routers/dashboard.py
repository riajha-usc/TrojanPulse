"""Campus Pulse dashboard data. Endpoint owner: Ria. Logic owner: Soham.

STUB: returns fixtures. Replace with services.forecast.
"""

from fastapi import APIRouter

from app import fixtures
from app.schemas import CorridorsResponse, DashboardSummary, ForecastResponse, HeatmapResponse, WaitTimesResponse

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def summary() -> DashboardSummary:
    # TODO(Ria): assemble from walks, pods, hazards and alerts
    return fixtures.SUMMARY


@router.get("/heatmap", response_model=HeatmapResponse)
def heatmap() -> HeatmapResponse:
    # TODO(Ria): call services.forecast.get_heatmap()
    return fixtures.HEATMAP


@router.get("/forecast", response_model=ForecastResponse)
def forecast() -> ForecastResponse:
    # TODO(Ria): call services.forecast.get_forecast()
    return fixtures.FORECAST


@router.get("/wait-times", response_model=WaitTimesResponse)
def wait_times() -> WaitTimesResponse:
    # TODO(Ria): call services.forecast.get_wait_times()
    return fixtures.WAIT_TIMES


@router.get("/corridors", response_model=CorridorsResponse)
def corridors() -> CorridorsResponse:
    # TODO(Ria): call services.forecast.get_corridors()
    return fixtures.CORRIDORS
