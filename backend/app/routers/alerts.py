"""Alerts. Owner: Ria.

The 10 second cancel countdown lives in the browser. The server only hears
about an alert after the countdown expires or the student taps Send now.
Creating or resolving an alert is pushed to every connected client.
"""

from fastapi import APIRouter, HTTPException

from app.config import settings
from app.schemas import Alert, AlertCreateRequest, AlertsResponse
from app.store import new_id, now, store
from app.ws import hub

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=AlertsResponse)
def list_open_alerts() -> AlertsResponse:
    return AlertsResponse(alerts=store.open_alerts())


@router.post("", response_model=Alert, status_code=201)
async def create_alert(body: AlertCreateRequest) -> Alert:
    walk = store.walks.get(body.walk_id)
    if walk is None:
        raise HTTPException(status_code=404, detail="Walk not found")
    user = next((u for u in store.users_by_email.values() if u.id == walk.user_id), None)
    alert = Alert(
        id=new_id("alert"),
        walk_id=walk.id,
        user_display_name=user.display_name if user else "Demo Trojan",
        status="open",
        source=body.source,
        location=body.location,
        location_label=body.location_label,
        transcript=body.transcript,
        reasons=body.reasons,
        pod_notified=store.pod_size(walk.pod_id, excluding_walk_id=walk.id),
        contacts_notified=settings.demo_contacts,
        created_at=now(),
    )
    store.add_alert(alert)
    await hub.emit("alert.created", alert)
    return alert


@router.post("/{alert_id}/resolve", response_model=Alert)
async def resolve_alert(alert_id: str) -> Alert:
    alert = store.resolve_alert(alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    await hub.emit("alert.resolved", alert)
    return alert
