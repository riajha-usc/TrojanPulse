"""Generate all simulated data with one command and a fixed seed.

Run from the backend folder:  python -m data.generate
Writes JSON files to data/generated/ (ignored by git). Same seed, same files, every run.

Demo stories built in:
  1. Streetlights out on Ellendale Pl's south block, with 4 hazard reports there.
  2. Leavey Library closes at midnight tonight (Friday), which drives a Fryft surge.
  3. Maya R. and Dev K. leave Leavey for Ellendale Pl & 28th St in 5 and 7 minutes.
"""

import random
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np

from data import places, store
from data.extract_incidents import extract_all
from data.graph import edge_names, load_graph, node_point

SEED = 42
HISTORY_NIGHTS = 21  # past nights of ride requests, for the forecast model
NIGHT_START_HOUR = 20  # nights run 8 PM to 3 AM
NIGHT_SLOTS = 14  # 30-minute slots
LIGHT_SPACING_M = 35

FIRST_NAMES = ["Ava", "Leo", "Priya", "Sam", "Nina", "Omar", "Chloe", "Ethan", "Zoe", "Ravi"]
FIRST_NAMES += ["Lily", "Marco", "Hana", "Jon", "Sofia", "Ken", "Aria", "Ben", "Isha", "Noah"]
LAST_INITIALS = "ABCDEFGHJKLMNPRSTW"


# ---------------------------------------------------------------- helpers


def night_of(moment: datetime) -> date:
    """The evening a moment belongs to: 1 AM Saturday is part of Friday night."""
    return (moment - timedelta(hours=12)).date()


def night_start(evening: date) -> datetime:
    return datetime(evening.year, evening.month, evening.day, NIGHT_START_HOUR)


def at_clock(evening: date, clock: str) -> datetime:
    """'00:30' on Friday's evening means 12:30 AM Saturday."""
    hour, minute = map(int, clock.split(":"))
    moment = datetime(evening.year, evening.month, evening.day, hour, minute)
    return moment + timedelta(days=1) if hour < 12 else moment


def jitter(rng: random.Random, point: Tuple[float, float], max_m: float) -> Tuple[float, float]:
    deg = max_m / 111_320
    return (point[0] + rng.uniform(-deg, deg), point[1] + rng.uniform(-deg, deg))


def with_article(word: str) -> str:
    return ("an " if word[0] in "aeiou" else "a ") + word


def latlng(point: Tuple[float, float]) -> Dict[str, float]:
    return {"lat": round(point[0], 6), "lng": round(point[1], 6)}


# ---------------------------------------------------------------- datasets


def make_streetlights(rng: random.Random, g) -> List[dict]:
    """One light every ~35 m along streets and campus walkways. About 1% are out, plus the story block.

    Sidewalks and crossings get no lights of their own: the street's lights cover them, so a broken
    light darkens the sidewalk next to it too (routing looks for broken lights within 25 m).
    """
    lights, seen = [], set()
    for u, v, key, data in g.edges(keys=True, data=True):
        if (v, u, key) in seen:  # both directions share the same lights
            continue
        if any(tag in str(data.get("footway")) for tag in ("sidewalk", "crossing")):
            continue
        seen.add((u, v, key))
        pu, pv = node_point(g, u), node_point(g, v)
        count = max(1, int(data["length"] // LIGHT_SPACING_M))
        for i in range(count):
            t = (i + 0.5) / count
            point = (pu[0] + (pv[0] - pu[0]) * t, pu[1] + (pv[1] - pu[1]) * t)
            story_block = places.BROKEN_LIGHT_STREET in edge_names(data) and point[0] < places.BROKEN_LIGHT_MAX_LAT
            working = not story_block and rng.random() > 0.01
            lights.append({"id": f"light_{len(lights) + 1}", **latlng(point), "u": u, "v": v, "working": working})
    return lights


def make_hazard_reports(rng: random.Random, g) -> List[dict]:
    """One-tap reports from the past week. Places only, never people."""
    now = places.DEMO_NOW
    reports = []

    def add(kind: str, point: Tuple[float, float], days_ago: float) -> None:
        when = now - timedelta(days=days_ago)
        reports.append({"id": f"rep_{len(reports) + 1}", "type": kind, **latlng(point), "time": when.isoformat()})

    for _ in range(4):  # story: the light out on Ellendale Pl
        add("light_out", jitter(rng, (34.0289, -118.2889), 10), rng.uniform(0.2, 6))
    for _ in range(2):  # a blocked sidewalk on Hoover St
        add("blocked_path", jitter(rng, (34.0279, -118.2840), 6), rng.uniform(0.5, 4))
    nodes = list(g.nodes)
    for _ in range(8):  # scattered single reports
        add(rng.choice(["light_out", "blocked_path", "other"]), node_point(g, rng.choice(nodes)), rng.uniform(0, 7))
    return reports


def make_businesses() -> List[dict]:
    return [{**b, "location": latlng(b["location"])} for b in places.BUSINESSES]


def make_walkers(rng: random.Random) -> List[dict]:
    """Students walking home tonight, from 8 PM to an hour after the demo clock."""
    now = places.DEMO_NOW
    start = night_start(night_of(now))
    window_min = (now - start).total_seconds() / 60 + 60

    def walker(user_id: str, name: str, start_label: str, dest_label: str, depart: datetime) -> dict:
        return {
            "id": user_id,
            "display_name": name,
            "start_label": start_label,
            "start": latlng(jitter(rng, places.CAMPUS[start_label], 20)),
            "destination_label": dest_label,
            "destination": latlng(jitter(rng, places.DESTINATIONS[dest_label], 40)),
            "depart_at": depart.isoformat(timespec="minutes"),
        }

    origin, dest = places.DEMO_ORIGIN, places.DEMO_DESTINATION
    walkers = [  # story: the pod in the mockup
        walker("u_maya", "Maya R.", origin, dest, now + timedelta(minutes=5)),
        walker("u_dev", "Dev K.", origin, dest, now + timedelta(minutes=7)),
    ]
    starts, dests = list(places.CAMPUS), list(places.DESTINATIONS)
    for i in range(240):
        start_label = rng.choices(starts, weights=[5, 2, 3, 2])[0]  # Leavey is busiest
        dest_label = rng.choices(dests, weights=[5, 2, 2, 1, 2, 1])[0]  # Ellendale is busiest
        name = f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_INITIALS)}."
        depart = start + timedelta(minutes=rng.uniform(0, window_min))
        walkers.append(walker(f"u_{i + 1}", name, start_label, dest_label, depart))
    return walkers


def make_schedule(rng: random.Random) -> List[dict]:
    """Things that end and release a crowd: Leavey closing (real hours) and evening events."""
    tonight = night_of(places.DEMO_NOW)
    events = []

    def add(label: str, pickup: str, ends: datetime, crowd: int) -> None:
        events.append(
            {
                "id": f"ev_{len(events) + 1}",
                "label": label,
                "pickup_label": pickup,
                "location": latlng(places.CAMPUS[pickup]),
                "ends_at": ends.isoformat(timespec="minutes"),
                "crowd": crowd,
            }
        )

    venues = [("Bovard Auditorium show", "Doheny Library"), ("Galen Center game", "USC Village")]
    venues.append(("Ginsburg Hall hackathon", "Ginsburg Hall"))
    for days_back in range(HISTORY_NIGHTS, -1, -1):
        evening = tonight - timedelta(days=days_back)
        closes = places.LEAVEY_CLOSES[evening.weekday()]
        if closes:
            add("Leavey Library closes", "Leavey Library", at_clock(evening, closes), rng.randint(110, 160))
        if days_back > 0 and rng.random() < 0.4:  # keep tonight's story clean
            label, pickup = rng.choice(venues)
            ends = night_start(evening) + timedelta(minutes=30 * rng.randint(2, 10))
            add(label, pickup, ends, rng.randint(60, 200))
    return events


# Requests per pickup per 30-minute slot on a quiet night, 8 PM to 3 AM.
BASE_DEMAND = {
    "fryft": [3, 4, 5, 6, 7, 8, 9, 9, 8, 7, 5, 4, 3, 2],
    "shuttle": [6, 6, 6, 5, 5, 4, 4, 3, 2, 1, 0, 0, 0, 0],
}
PICKUP_WEIGHT = {"Leavey Library": 1.3, "USC Village": 1.0, "Ginsburg Hall": 0.7, "Doheny Library": 0.6}
CROWD_SHARE = {"fryft": 0.12, "shuttle": 0.06}  # share of a released crowd that requests a ride
CAPACITY = {"fryft": 8, "shuttle": 12}  # rides per pickup per slot before people start waiting


def make_ride_requests(nprng: np.random.Generator, schedule: List[dict]) -> List[dict]:
    """Ride requests for past nights and tonight up to the demo clock, shaped by the schedule."""
    now = places.DEMO_NOW
    tonight = night_of(now)
    rows = []
    for days_back in range(HISTORY_NIGHTS, -1, -1):
        evening = tonight - timedelta(days=days_back)
        busy_night = 1.4 if evening.weekday() in (3, 4, 5) else 1.0  # Thursday to Saturday
        for slot in range(NIGHT_SLOTS):
            slot_start = night_start(evening) + timedelta(minutes=30 * slot)
            if slot_start >= now:
                break
            for pickup, weight in PICKUP_WEIGHT.items():
                released = crowd_released(schedule, pickup, slot_start)
                for service, base in BASE_DEMAND.items():
                    expected = base[slot] * weight * busy_night + released * CROWD_SHARE[service]
                    if service == "shuttle" and base[slot] == 0:
                        continue  # shuttle not running
                    count = int(nprng.poisson(expected))
                    wait = 4 + 1.5 * max(0, count - CAPACITY[service])
                    for _ in range(count):
                        offset = timedelta(minutes=float(nprng.uniform(0, 30)))
                        rows.append(
                            {
                                "id": f"ride_{len(rows) + 1}",
                                "service": service,
                                "pickup_label": pickup,
                                "time": (slot_start + offset).isoformat(timespec="minutes"),
                                "wait_min": round(max(1.0, wait + float(nprng.normal(0, 1.5))), 1),
                            }
                        )
    return rows


def crowd_released(schedule: List[dict], pickup: str, slot_start: datetime) -> float:
    """People let out near a pickup in this slot, plus half of the previous slot's crowd still waiting."""
    total = 0.0
    for event in schedule:
        if event["pickup_label"] != pickup:
            continue
        minutes_after = (slot_start - datetime.fromisoformat(event["ends_at"])).total_seconds() / 60
        if -30 < minutes_after <= 0:
            total += event["crowd"]
        elif 0 < minutes_after <= 30:
            total += event["crowd"] / 2
    return total


INCIDENT_SPOTS = [  # kept off Hoover St so the demo's safest route (via Hoover) stays clear
    ("South Vermont Avenue", "West 28th Street"),
    ("Ellendale Place", "West Adams Boulevard"),
    ("Menlo Avenue", "West 30th Street"),
    ("South Figueroa Street", "West 30th Street"),
    ("Portland Street", "West 28th Street"),
    ("South Vermont Avenue", "West Jefferson Boulevard"),
]
INCIDENT_KINDS = ["theft", "robbery", "vandalism incident", "vehicle break-in", "assault"]
ALERT_TEMPLATES = [
    "USC DPS Crime Alert\n\nOn {when} at approximately {clock}, {kind} was reported near {a} and {b}. "
    "DPS officers responded and the area was checked. Please walk with others at night and contact DPS "
    "if you need help.",
    "DPS Safety Notice: On {when} at approximately {clock}, {kind} was reported near {a} and {b}. "
    "LAPD and DPS are investigating. Use Fryft or the campus shuttle after dark when you can.",
    "Timely Warning from the Department of Public Safety. On {when} at approximately {clock}, {kind} "
    "was reported near {a} and {b}. Stay on well-lit streets and keep your phone charged.",
]


def make_incidents_raw(rng: random.Random) -> List[dict]:
    """Past safety alerts as raw text, the way a DPS email reads. Describes events and places, never people."""
    now = places.DEMO_NOW
    spots = [rng.choice(INCIDENT_SPOTS) for _ in range(16)]
    spots += [("Orchard Avenue", "West 30th Street")] * 2  # story: two recent alerts on the fastest route
    rows = []
    for i, (a, b) in enumerate(spots):
        days_ago = rng.randint(1, 6) if i >= 16 else rng.randint(1, 30)
        when = night_start(night_of(now) - timedelta(days=days_ago)) + timedelta(minutes=rng.randint(0, 7 * 60))
        text = rng.choice(ALERT_TEMPLATES).format(
            when=when.strftime("%b %d").replace(" 0", " "),
            clock=when.strftime("%I:%M %p").lstrip("0"),
            kind=with_article(rng.choice(INCIDENT_KINDS)),
            a=a,
            b=b,
        )
        rows.append({"id": f"inc_{i + 1}", "text": text, "received_at": when.isoformat(timespec="minutes")})
    return rows


# ---------------------------------------------------------------- main


def generate(out_dir: Path = store.GENERATED_DIR, use_llm: bool = True) -> None:
    rng = random.Random(SEED)
    nprng = np.random.default_rng(SEED)
    g = load_graph()
    schedule = make_schedule(rng)
    datasets = {
        "streetlights": make_streetlights(rng, g),
        "hazard_reports": make_hazard_reports(rng, g),
        "businesses": make_businesses(),
        "walkers": make_walkers(rng),
        "campus_schedule": schedule,
        "ride_requests": make_ride_requests(nprng, schedule),
        "incidents_raw": make_incidents_raw(rng),
    }
    for name, rows in datasets.items():
        store.save(name, rows, out_dir)
    store.save("incidents", extract_all(datasets["incidents_raw"], use_llm=use_llm), out_dir)
    for name, rows in datasets.items():
        print(f"{name}: {len(rows)} rows")


if __name__ == "__main__":
    generate()
