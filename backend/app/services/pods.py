"""Pod matching. Owner: Soham.

A student going to `destination` in `depart_in_min` minutes can join walkers who are heading
within 300 m of the same place and leaving within 10 minutes of the same time. Walkers meet at the
well-lit landmark nearest where they start, so a pod only holds walkers sharing a meeting point.
A pod holds up to 3 walkers, so with the student joining it is at most 4.
Only first names and last initials are returned, never anyone's path.
"""

from datetime import datetime, timedelta
from typing import Dict, List

from app.schemas import LatLng, Pod, PodMember
from data import places, store
from data.graph import meters

DESTINATION_RADIUS_M = 300
DEPARTURE_WINDOW_MIN = 10
MAX_MEMBERS = 3  # plus the student who joins


def match_pods(destination: LatLng, depart_in_min: int) -> List[Pod]:
    """Return pods heading near the destination within the departure window.

    Meeting points are lit landmarks such as library exits.
    """
    now = places.DEMO_NOW
    wanted_time = now + timedelta(minutes=depart_in_min)
    target = (destination.lat, destination.lng)

    candidates = []
    for walker in store.load("walkers"):
        depart = datetime.fromisoformat(walker["depart_at"])
        close_in_time = abs(depart - wanted_time) <= timedelta(minutes=DEPARTURE_WINDOW_MIN)
        close_in_place = meters(_point(walker["destination"]), target) <= DESTINATION_RADIUS_M
        if depart >= now and close_in_time and close_in_place:
            candidates.append({**walker, "depart": depart, "meet": _nearest_meeting_point(walker["start"])})

    by_meeting_point: Dict[str, List[dict]] = {}
    for walker in sorted(candidates, key=lambda w: (w["depart"], w["id"])):
        by_meeting_point.setdefault(walker["meet"], []).append(walker)

    pods = []
    for meet, walkers in by_meeting_point.items():
        group: List[dict] = []
        for walker in walkers:  # in departure order
            too_late = group and walker["depart"] - group[0]["depart"] > timedelta(minutes=DEPARTURE_WINDOW_MIN)
            if group and (len(group) == MAX_MEMBERS or too_late):
                pods.append(_to_pod(group, meet, now, target))
                group = []
            group.append(walker)
        if group:
            pods.append(_to_pod(group, meet, now, target))
    return sorted(pods, key=lambda p: (p.leaves_in_min, p.id))


def _to_pod(members: List[dict], meet: str, now: datetime, target) -> Pod:
    labels = [m["destination_label"] for m in members]
    # Most common destination; a tie goes to the one closest to where the student is going.
    label = min(set(labels), key=lambda lb: (-labels.count(lb), meters(places.DESTINATIONS[lb], target)))
    leaves = min(m["depart"] for m in members)
    lat, lng = places.MEETING_POINTS[meet]
    return Pod(
        id="pod_" + members[0]["id"].removeprefix("u_"),
        members=[PodMember(user_id=m["id"], display_name=m["display_name"], initials=_initials(m)) for m in members],
        destination_label=label,
        meeting_point_label=meet,
        meeting_point=LatLng(lat=lat, lng=lng),
        leaves_in_min=max(0, round((leaves - now).total_seconds() / 60)),
    )


def _nearest_meeting_point(start: dict) -> str:
    return min(places.MEETING_POINTS, key=lambda label: meters(places.MEETING_POINTS[label], _point(start)))


def _initials(member: dict) -> str:
    return "".join(part[0] for part in member["display_name"].split()).upper()


def _point(latlng: dict):
    return (latlng["lat"], latlng["lng"])
