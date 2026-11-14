"""API contract for TrojanPulse.

Single source of truth for every request and response shape.
Owner: Ria. Ask before changing; announce every change in the team chat.

The live, browsable version of this contract is at /docs when the server runs.
Frontend types are generated from it (see frontend/package.json, script "gen:api").
"""

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

# ---------------------------------------------------------------- shared

RouteKind = Literal["safest", "fastest"]
HazardType = Literal["light_out", "blocked_path", "other"]
AlertSource = Literal["voice", "manual"]
AlertStatus = Literal["open", "resolved"]
WalkStatus = Literal["active", "ended"]
TransitService = Literal["fryft", "shuttle"]


class LatLng(BaseModel):
    lat: float
    lng: float


# ---------------------------------------------------------------- auth


class User(BaseModel):
    id: str
    email: str
    display_name: str


class LoginRequest(BaseModel):
    email: str = Field(description="Must end with @usc.edu")


class LoginResponse(BaseModel):
    token: str
    user: User


# ---------------------------------------------------------------- routes and hazards


class RouteOption(BaseModel):
    kind: RouteKind
    path: List[LatLng] = Field(description="Ordered points along real streets")
    minutes: int
    distance_m: int
    notes: List[str] = Field(default_factory=list, description="Short reasons shown under the route")


class Hazard(BaseModel):
    id: str
    type: HazardType
    location: LatLng
    report_count: int
    summary: str = Field(description="AI summary of the one-tap reports at this spot")
    updated_at: datetime


class RoutesResponse(BaseModel):
    origin: LatLng
    destination: LatLng
    safest: RouteOption
    fastest: RouteOption
    hazards: List[Hazard]


class HazardReportRequest(BaseModel):
    type: HazardType
    location: LatLng


# ---------------------------------------------------------------- pods


class PodMember(BaseModel):
    user_id: str
    display_name: str
    initials: str


class Pod(BaseModel):
    id: str
    members: List[PodMember]
    destination_label: str
    meeting_point_label: str
    meeting_point: LatLng
    leaves_in_min: int


class PodsResponse(BaseModel):
    pods: List[Pod]


# ---------------------------------------------------------------- walks


class WalkCreateRequest(BaseModel):
    origin: LatLng
    destination: LatLng
    destination_label: str
    route_kind: RouteKind = "safest"
    pod_id: Optional[str] = None


class Walk(BaseModel):
    id: str
    user_id: str
    status: WalkStatus
    destination_label: str
    route: RouteOption
    pod_id: Optional[str] = None
    safe_phrase: str
    started_at: datetime
    ended_at: Optional[datetime] = None


class AudioChunkResponse(BaseModel):
    """Result of scoring one audio chunk sent during a walk."""

    transcript: str
    sound_label: Optional[str] = None
    sound_score: float = Field(ge=0, le=1)
    alert_score: float = Field(ge=0, le=1, description="Fused score from speech, sound and movement")
    triggered: bool
    reasons: List[str] = Field(default_factory=list, description="Shown on the countdown screen")


# ---------------------------------------------------------------- alerts


class AlertCreateRequest(BaseModel):
    walk_id: str
    source: AlertSource
    location: LatLng
    location_label: Optional[str] = None
    transcript: Optional[str] = None
    reasons: List[str] = Field(default_factory=list)


class Alert(BaseModel):
    id: str
    walk_id: str
    user_display_name: str
    status: AlertStatus
    source: AlertSource
    location: LatLng
    location_label: Optional[str] = None
    transcript: Optional[str] = None
    reasons: List[str] = Field(default_factory=list)
    pod_notified: int
    contacts_notified: int
    created_at: datetime
    resolved_at: Optional[datetime] = None


class AlertsResponse(BaseModel):
    alerts: List[Alert]


# ---------------------------------------------------------------- dashboard


class DashboardSummary(BaseModel):
    simulated: bool = Field(description="True while the data layer is simulated; drives the badge")
    active_walks: int
    pods_in_progress: int
    active_hazard_reports: int
    open_alerts: int
    median_response_s: int
    top_hazard_summary: str


class HeatmapPoint(BaseModel):
    location: LatLng
    intensity: float = Field(ge=0, le=1)


class HeatmapResponse(BaseModel):
    window_min: int
    points: List[HeatmapPoint]


class ForecastBucket(BaseModel):
    label: str = Field(description="Bucket start as shown on the axis, for example 00:30")
    requests: int
    is_forecast: bool


class ForecastSeries(BaseModel):
    service: TransitService
    buckets: List[ForecastBucket]


class ForecastResponse(BaseModel):
    series: List[ForecastSeries]
    surge_note: Optional[str] = None


class WaitTime(BaseModel):
    location_label: str
    now_min: int
    in_30_min: int


class WaitTimesResponse(BaseModel):
    items: List[WaitTime]


class Corridor(BaseModel):
    from_label: str
    to_label: str
    walks: int


class CorridorsResponse(BaseModel):
    items: List[Corridor]


# ---------------------------------------------------------------- websocket

WsEventType = Literal["location.update", "alert.created", "alert.resolved", "pod.updated"]


class LocationUpdate(BaseModel):
    """Payload of location.update (client to server)."""

    walk_id: str
    location: LatLng


class WsEvent(BaseModel):
    """Envelope for every WebSocket message, both directions.

    payload by type:
      location.update -> LocationUpdate
      alert.created   -> Alert
      alert.resolved  -> Alert
      pod.updated     -> Pod
    """

    type: WsEventType
    payload: dict
