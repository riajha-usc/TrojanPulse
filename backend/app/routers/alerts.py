"""Alerts. Owner: Ria. STUB: returns fixtures and broadcasts nothing yet.

The 10 second cancel countdown lives in the browser. The server only hears
about an alert after the countdown expires or the student taps Send now.
"""

from fastapi import APIRouter

from app import fixtures
from app.schemas import Alert, AlertCreateRequest, AlertsResponse

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=AlertsResponse)
def list_open_alerts() -> AlertsResponse:
    # TODO(Ria): return open alerts for the dashboard
    return AlertsResponse(alerts=[fixtures.ALERT])


@router.post("", response_model=Alert, status_code=201)
def create_alert(body: AlertCreateRequest) -> Alert:
    # TODO(Ria): store the alert, notify pod and contacts, broadcast alert.created
    return fixtures.ALERT


@router.post("/{alert_id}/resolve", response_model=Alert)
def resolve_alert(alert_id: str) -> Alert:
    # TODO(Ria): mark resolved and broadcast alert.resolved
    return fixtures.ALERT.model_copy(update={"status": "resolved", "resolved_at": fixtures.NOW})
