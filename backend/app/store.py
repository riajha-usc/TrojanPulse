"""In-memory state for the hackathon build. Owner: Ria.

Everything lives in process memory and resets when the server restarts.
That is enough for the demo; swap for a database after a pilot.
"""

import uuid
from collections import deque
from datetime import datetime, timezone
from typing import Deque, Dict, List, Optional

from app.schemas import Alert, LatLng, Pod, PodMember, User, Walk


def now() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


class Store:
    def __init__(self) -> None:
        self.users_by_email: Dict[str, User] = {}
        self.users_by_token: Dict[str, User] = {}
        self.walks: Dict[str, Walk] = {}
        self.alerts: Dict[str, Alert] = {}
        self.locations: Dict[str, LatLng] = {}
        self.transcripts: Dict[str, Deque[str]] = {}
        self.pods: Dict[str, Pod] = {}  # pods last offered to students, by id
        self.pod_joins: Dict[str, List[PodMember]] = {}  # students who joined each pod

    def reset(self) -> None:
        self.__init__()

    # ------------------------------------------------------------ users

    def login(self, email: str) -> "tuple[str, User]":
        email = email.strip().lower()
        user = self.users_by_email.get(email)
        if user is None:
            user = User(id=new_id("u"), email=email, display_name=display_name_from_email(email))
            self.users_by_email[email] = user
        token = uuid.uuid4().hex
        self.users_by_token[token] = user
        return token, user

    # ------------------------------------------------------------ walks

    def add_walk(self, walk: Walk) -> Walk:
        self.walks[walk.id] = walk
        self.transcripts[walk.id] = deque(maxlen=2)
        return walk

    def end_walk(self, walk_id: str) -> Optional[Walk]:
        walk = self.walks.get(walk_id)
        if walk is None:
            return None
        ended = walk.model_copy(update={"status": "ended", "ended_at": now()})
        self.walks[walk_id] = ended
        self.transcripts.pop(walk_id, None)
        self.locations.pop(walk_id, None)
        return ended

    def active_walks(self) -> List[Walk]:
        return [w for w in self.walks.values() if w.status == "active"]

    def pod_size(self, pod_id: Optional[str], excluding_walk_id: str) -> int:
        """Other people in this pod: its members, plus anyone else walking with it now."""
        if not pod_id:
            return 0
        walk = self.walks.get(excluding_walk_id)
        pod = self.pods.get(pod_id)
        members = {m.user_id for m in self.pod_with_joins(pod).members} if pod else set()
        walking = [w for w in self.active_walks() if w.pod_id == pod_id and w.id != excluding_walk_id]
        others = members - ({walk.user_id} if walk else set())
        return len(others) + sum(1 for w in walking if w.user_id not in members)

    def recent_transcript(self, walk_id: str, latest: str) -> str:
        """Join the previous chunk's text with the latest, so a phrase split across chunks still matches."""
        history = self.transcripts.setdefault(walk_id, deque(maxlen=2))
        joined = " ".join([*history, latest]).strip()
        if latest:
            history.append(latest)
        return joined

    # ------------------------------------------------------------ pods

    def offer_pod(self, pod: Pod) -> Pod:
        """Remember a pod the matcher returned and add the students who already joined it."""
        self.pods[pod.id] = pod
        return self.pod_with_joins(pod)

    def pod_with_joins(self, pod: Pod) -> Pod:
        known = {m.user_id for m in pod.members}
        joined = [m for m in self.pod_joins.get(pod.id, []) if m.user_id not in known]
        return pod.model_copy(update={"members": [*pod.members, *joined]})

    def join_pod(self, pod_id: str, user: User) -> Pod:
        """Add a student to a pod. Joining twice changes nothing."""
        pod = self.pod_with_joins(self.pods[pod_id])
        if any(m.user_id == user.id for m in pod.members):
            return pod
        self.pod_joins.setdefault(pod_id, []).append(
            PodMember(user_id=user.id, display_name=user.display_name, initials=initials(user.display_name))
        )
        return self.pod_with_joins(self.pods[pod_id])

    # ------------------------------------------------------------ alerts

    def add_alert(self, alert: Alert) -> Alert:
        self.alerts[alert.id] = alert
        return alert

    def resolve_alert(self, alert_id: str) -> Optional[Alert]:
        alert = self.alerts.get(alert_id)
        if alert is None:
            return None
        resolved = alert.model_copy(update={"status": "resolved", "resolved_at": now()})
        self.alerts[alert_id] = resolved
        return resolved

    def open_alerts(self) -> List[Alert]:
        alerts = [a for a in self.alerts.values() if a.status == "open"]
        return sorted(alerts, key=lambda a: a.created_at, reverse=True)


def display_name_from_email(email: str) -> str:
    """ "maya.rao@usc.edu" becomes "Maya R." so full names never reach other students."""
    local = email.split("@")[0]
    parts = [p for p in local.replace("_", ".").replace("-", ".").split(".") if p]
    if not parts:
        return "Trojan"
    first = parts[0].capitalize()
    if len(parts) > 1:
        return f"{first} {parts[-1][0].upper()}."
    return first


def initials(display_name: str) -> str:
    return "".join(part[0] for part in display_name.replace(".", " ").split()).upper()[:2]


store = Store()
