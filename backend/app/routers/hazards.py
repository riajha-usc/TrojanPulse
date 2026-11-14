"""One-tap hazard reports. Endpoint owner: Ria. Logic owner: Soham.

STUB: returns fixtures. Replace with services.hazards.
"""

from typing import List

from fastapi import APIRouter

from app import fixtures
from app.schemas import Hazard, HazardReportRequest

router = APIRouter(prefix="/hazards", tags=["hazards"])


@router.get("", response_model=List[Hazard])
def list_hazards() -> List[Hazard]:
    # TODO(Ria): call services.hazards.list_hazards()
    return [fixtures.HAZARD]


@router.post("", response_model=Hazard, status_code=201)
def report_hazard(body: HazardReportRequest) -> Hazard:
    # TODO(Ria): call services.hazards.add_report(body.type, body.location)
    return fixtures.HAZARD
