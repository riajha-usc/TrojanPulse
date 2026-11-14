"""Walking pods. Endpoint owner: Ria. Logic owner: Soham.

STUB: returns fixtures. Replace with services.pods.
"""

from fastapi import APIRouter, Query

from app import fixtures
from app.schemas import Pod, PodsResponse

router = APIRouter(prefix="/pods", tags=["pods"])


@router.get("", response_model=PodsResponse)
def find_pods(
    to_lat: float = Query(...),
    to_lng: float = Query(...),
    depart_in_min: int = Query(5, ge=0),
) -> PodsResponse:
    # TODO(Ria): call services.pods.match_pods(destination, depart_in_min)
    return PodsResponse(pods=[fixtures.POD])


@router.post("/{pod_id}/join", response_model=Pod)
def join_pod(pod_id: str) -> Pod:
    # TODO(Ria): add the signed-in user to the pod and broadcast pod.updated
    return fixtures.POD
