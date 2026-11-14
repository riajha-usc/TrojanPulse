"""Safest and fastest walking routes. Endpoint owner: Ria. Logic owner: Soham.

STUB: returns a fixture. Replace the body with services.routing.get_routes().
"""

from fastapi import APIRouter, Query

from app import fixtures
from app.schemas import RoutesResponse

router = APIRouter(prefix="/routes", tags=["routes"])


@router.get("", response_model=RoutesResponse)
def get_routes(
    from_lat: float = Query(...),
    from_lng: float = Query(...),
    to_lat: float = Query(...),
    to_lng: float = Query(...),
) -> RoutesResponse:
    # TODO(Ria): call services.routing.get_routes(origin, destination)
    return fixtures.ROUTES
