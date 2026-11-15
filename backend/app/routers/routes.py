"""Safest and fastest walking routes. Endpoint owner: Ria. Logic owner: Soham.

Returns example data until services.routing.get_routes is implemented.
"""

from fastapi import APIRouter, Query

from app import fixtures
from app.deps import service_or_fixture
from app.schemas import LatLng, RoutesResponse
from app.services import routing

router = APIRouter(prefix="/routes", tags=["routes"])


@router.get("", response_model=RoutesResponse)
def get_routes(
    from_lat: float = Query(..., ge=-90, le=90),
    from_lng: float = Query(..., ge=-180, le=180),
    to_lat: float = Query(..., ge=-90, le=90),
    to_lng: float = Query(..., ge=-180, le=180),
) -> RoutesResponse:
    origin = LatLng(lat=from_lat, lng=from_lng)
    destination = LatLng(lat=to_lat, lng=to_lng)
    return service_or_fixture(lambda: routing.get_routes(origin, destination), fixtures.ROUTES)
