"""Walking pods. Endpoint owner: Ria. Matching logic owner: Soham.

Finding pods calls services.pods.match_pods. Joining is handled here: the
student is added to the pod and every connected client gets pod.updated.
"""

from fastapi import APIRouter, Depends, HTTPException, Query

from app import fixtures
from app.deps import current_user, service_or_fixture
from app.schemas import LatLng, Pod, PodsResponse, User
from app.services import pods
from app.store import store
from app.ws import hub

router = APIRouter(prefix="/pods", tags=["pods"])

MAX_POD_SIZE = 4


@router.get("", response_model=PodsResponse)
def find_pods(
    to_lat: float = Query(..., ge=-90, le=90),
    to_lng: float = Query(..., ge=-180, le=180),
    depart_in_min: int = Query(5, ge=0),
) -> PodsResponse:
    destination = LatLng(lat=to_lat, lng=to_lng)
    matched = service_or_fixture(lambda: pods.match_pods(destination, depart_in_min), [fixtures.POD])
    return PodsResponse(pods=[store.offer_pod(pod) for pod in matched])


@router.post("/{pod_id}/join", response_model=Pod)
async def join_pod(pod_id: str, user: User = Depends(current_user)) -> Pod:
    """Join a pod that GET /pods returned earlier."""
    if pod_id not in store.pods:
        raise HTTPException(status_code=404, detail="Pod not found. Call GET /pods first.")
    current = store.pod_with_joins(store.pods[pod_id])
    already_in = any(m.user_id == user.id for m in current.members)
    if not already_in and len(current.members) >= MAX_POD_SIZE:
        raise HTTPException(status_code=409, detail="Pod is full")
    pod = store.join_pod(pod_id, user)
    if not already_in:
        await hub.emit("pod.updated", pod)
    return pod
