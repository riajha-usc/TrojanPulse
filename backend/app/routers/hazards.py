"""One-tap hazard reports. Endpoint owner: Ria. Logic owner: Soham.

Returns example data until the functions in services.hazards are implemented.
"""

from typing import List

from fastapi import APIRouter

from app import fixtures
from app.deps import service_or_fixture
from app.schemas import Hazard, HazardReportRequest
from app.services import hazards

router = APIRouter(prefix="/hazards", tags=["hazards"])


@router.get("", response_model=List[Hazard])
def list_hazards() -> List[Hazard]:
    return service_or_fixture(hazards.list_hazards, [fixtures.HAZARD])


@router.post("", response_model=Hazard, status_code=201)
def report_hazard(body: HazardReportRequest) -> Hazard:
    return service_or_fixture(lambda: hazards.add_report(body.type, body.location), fixtures.HAZARD)
