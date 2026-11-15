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
        """Other active walkers who share this pod."""
        if not pod_id:
            return 0
        return sum(1 for w in self.active_walks() if w.pod_id == pod_id and w.id != excluding_walk_id)

    def recent_transcript(self, walk_id: str, latest: str) -> str:
        """Join the previous chunk's text with the latest, so a phrase split across chunks still matches."""
        history = self.transcripts.setdefault(walk_id, deque(maxlen=2))
        joined = " ".join([*history, latest]).strip()
        if latest:
            history.append(latest)
        return joined

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



store = Store()
