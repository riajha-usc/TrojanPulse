"""Demand forecast and dashboard aggregates. Owner: Soham.

All of this runs on simulated data for the hackathon. The functions must
compute their results from that data, not return hardcoded values.

Heatmap and corridors are counts only; a map square needs at least 3 people before it shows up,
so no individual can be picked out. Never returns anyone's path.

The forecast is a scikit-learn linear regression trained on 3 weeks of ride requests. It learns how
demand depends on the time of night, Thursday-to-Saturday nights, the pickup spot, and crowds let
out nearby (from the campus schedule), then predicts the next 4 half-hour slots. On the generated
data it learns that every 100 people let out add about 12 Fryft requests. Change a closing time in
campus_schedule.json and the predicted surge moves with it.
"""

from collections import Counter
from datetime import datetime, timedelta
from functools import lru_cache
from typing import Dict, List, Tuple

import numpy as np
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LinearRegression

from app.schemas import (
    Corridor,
    CorridorsResponse,
    ForecastBucket,
    ForecastResponse,
    ForecastSeries,
    HeatmapPoint,
    HeatmapResponse,
    LatLng,
    WaitTime,
    WaitTimesResponse,
)
from data import places, store
from data.generate import NIGHT_SLOTS, crowd_released, night_of, night_start

GRID_DEG = 0.0015  # map squares of about 150 m
MIN_PEOPLE_PER_SQUARE = 3
TOP_CORRIDORS = 5
FORECAST_SLOTS = 4
SERVICES = ["fryft", "shuttle"]
SURGE_RATIO = 1.5  # predicted demand at least 1.5x normal...
SURGE_MIN_EXTRA = 4  # ...and at least 4 more requests than normal
SLOT = timedelta(minutes=30)


def get_heatmap(window_min: int = 60) -> HeatmapResponse:
    """Walk and ride demand by location over the last window, anonymized."""
    now = places.DEMO_NOW
    since = now - timedelta(minutes=window_min)
    points: List[Tuple[float, float]] = []
    for walker in store.load("walkers"):
        if since <= datetime.fromisoformat(walker["depart_at"]) <= now:
            points += [(walker["start"]["lat"], walker["start"]["lng"])]
            points += [(walker["destination"]["lat"], walker["destination"]["lng"])]
    for ride in store.load("ride_requests"):
        if since <= datetime.fromisoformat(ride["time"]) <= now:
            points.append(places.CAMPUS[ride["pickup_label"]])

    squares = Counter((int(lat // GRID_DEG), int(lng // GRID_DEG)) for lat, lng in points)
    busy = {square: n for square, n in squares.items() if n >= MIN_PEOPLE_PER_SQUARE}
    top = max(busy.values(), default=1)
    return HeatmapResponse(
        window_min=window_min,
        points=[
            HeatmapPoint(
                location=LatLng(lat=round((row + 0.5) * GRID_DEG, 6), lng=round((col + 0.5) * GRID_DEG, 6)),
                intensity=round(n / top, 2),
            )
            for (row, col), n in sorted(busy.items(), key=lambda item: -item[1])
        ],
    )


def get_corridors() -> CorridorsResponse:
    """Most walked origin to destination pairs tonight."""
    now = places.DEMO_NOW
    tonight_start = night_start(night_of(now))
    pairs = Counter(
        (w["start_label"], w["destination_label"])
        for w in store.load("walkers")
        if tonight_start <= datetime.fromisoformat(w["depart_at"]) <= now
    )
    ranked = sorted(pairs.items(), key=lambda item: (-item[1], item[0]))[:TOP_CORRIDORS]
    return CorridorsResponse(items=[Corridor(from_label=a, to_label=b, walks=n) for (a, b), n in ranked])


def get_forecast() -> ForecastResponse:
    """Requests per 30 minutes for each service, recent history plus forecast."""
    now = places.DEMO_NOW
    tonight = night_of(now)
    current = _current_slot(now)
    counts = _slot_counts()
    predicted = _predict_tonight()

    series = []
    for service in SERVICES:
        buckets = [
            ForecastBucket(
                label=_label(tonight, slot),
                requests=sum(counts.get((service, p, tonight, slot), 0) for p in places.PICKUP_SPOTS),
                is_forecast=False,
            )
            for slot in range(current)
        ]
        buckets += [
            ForecastBucket(
                label=_label(tonight, slot),
                requests=round(sum(predicted[(service, p, slot)][0] for p in places.PICKUP_SPOTS)),
                is_forecast=True,
            )
            for slot in _future_slots(current)
        ]
        series.append(ForecastSeries(service=service, buckets=buckets))
    return ForecastResponse(series=series, surge_note=_surge_note(predicted, tonight, current))


def get_wait_times() -> WaitTimesResponse:
    """Current and predicted wait per pickup location."""
    now = places.DEMO_NOW
    current = _current_slot(now)
    wait_for = _wait_model()
    predicted = _predict_tonight()
    rides = [r for r in store.load("ride_requests") if r["service"] == "fryft"]

    items = []
    for pickup in places.PICKUP_SPOTS:
        recent = [
            r["wait_min"]
            for r in rides
            if r["pickup_label"] == pickup and now - SLOT <= datetime.fromisoformat(r["time"]) < now
        ]
        now_min = np.mean(recent) if recent else wait_for(predicted[("fryft", pickup, current)][0])
        later = predicted.get(("fryft", pickup, current + 1))
        in_30 = wait_for(later[0]) if later else now_min
        items.append(WaitTime(location_label=pickup, now_min=round(now_min), in_30_min=round(in_30)))
    return WaitTimesResponse(items=sorted(items, key=lambda w: (-w.in_30_min, w.location_label)))


# ---------------------------------------------------------------- slots


def _current_slot(now: datetime) -> int:
    return int((now - night_start(night_of(now))) // SLOT)


def _future_slots(current: int) -> range:
    return range(current, min(current + FORECAST_SLOTS, NIGHT_SLOTS))


def _label(evening, slot: int) -> str:
    return (night_start(evening) + slot * SLOT).strftime("%H:%M")


def _slot_counts() -> Dict[tuple, int]:
    """Ride requests per (service, pickup, night, slot)."""
    counts: Counter = Counter()
    for ride in store.load("ride_requests"):
        when = datetime.fromisoformat(ride["time"])
        evening = night_of(when)
        counts[(ride["service"], ride["pickup_label"], evening, int((when - night_start(evening)) // SLOT))] += 1
    return counts


# ---------------------------------------------------------------- forecast model


def _features(evening, slot: int, pickup: str, schedule: List[dict], with_crowds: bool = True) -> List[float]:
    """Time of night, Thursday-to-Saturday, which pickup, and how many people were just let out nearby."""
    slot_start = night_start(evening) + slot * SLOT
    crowd = crowd_released(schedule, pickup, slot_start) if with_crowds else 0.0
    busy_night = float(evening.weekday() in (3, 4, 5))
    time_of_night = [float(slot == s) for s in range(NIGHT_SLOTS)]
    return (
        time_of_night
        + [busy_night]
        + [busy_night * t for t in time_of_night]
        + [float(pickup == p) for p in places.PICKUP_SPOTS]
        + [crowd]
    )


@lru_cache(maxsize=4)
def _train(rides_version: tuple, schedule_version: tuple) -> Dict[str, LinearRegression]:
    """One model per service, trained on every past slot. Retrained only when the data files change."""
    now = places.DEMO_NOW
    schedule = store.load("campus_schedule")
    counts = _slot_counts()
    nights = sorted({key[2] for key in counts})
    models = {}
    for service in SERVICES:
        x, y = [], []
        for evening in nights:
            for slot in range(NIGHT_SLOTS):
                if night_start(evening) + slot * SLOT >= now:
                    break
                for pickup in places.PICKUP_SPOTS:
                    x.append(_features(evening, slot, pickup, schedule))
                    y.append(counts.get((service, pickup, evening, slot), 0))
        models[service] = LinearRegression().fit(np.array(x), np.array(y))
    return models


def _predict_tonight() -> Dict[tuple, Tuple[float, float]]:
    """(service, pickup, slot) -> (predicted requests, normal requests without any crowd let out)."""
    now = places.DEMO_NOW
    tonight = night_of(now)
    models = _train(store.version("ride_requests"), store.version("campus_schedule"))
    schedule = store.load("campus_schedule")
    result = {}
    for service, model in models.items():
        for slot in _future_slots(_current_slot(now)):
            for pickup in places.PICKUP_SPOTS:
                with_crowd = model.predict([_features(tonight, slot, pickup, schedule)])[0]
                normal = model.predict([_features(tonight, slot, pickup, schedule, with_crowds=False)])[0]
                result[(service, pickup, slot)] = (max(0.0, with_crowd), max(0.0, normal))
    return result


def _surge_note(predicted: Dict[tuple, Tuple[float, float]], tonight, current: int) -> str:
    """One sentence naming the biggest predicted Fryft surge, or empty when none is coming."""
    surges = [
        (pred - normal, slot, pickup)  # the biggest jump over normal wins
        for (service, pickup, slot), (pred, normal) in predicted.items()
        if service == "fryft" and pred >= SURGE_RATIO * normal and pred - normal >= SURGE_MIN_EXTRA
    ]
    if not surges:
        return ""
    _, slot, pickup = max(surges)
    when = (night_start(tonight) + slot * SLOT).strftime("%I:%M %p").lstrip("0")
    return f"Fryft surge expected at {when} near {pickup}."


# ---------------------------------------------------------------- wait times


def _wait_model():
    """Learn from history how the wait grows with requests per slot (never shorter with more requests)."""
    return _train_wait(store.version("ride_requests"))


@lru_cache(maxsize=4)
def _train_wait(rides_version: tuple):
    per_slot: Dict[tuple, List[float]] = {}
    for ride in store.load("ride_requests"):
        if ride["service"] != "fryft":
            continue
        when = datetime.fromisoformat(ride["time"])
        evening = night_of(when)
        key = (ride["pickup_label"], evening, int((when - night_start(evening)) // SLOT))
        per_slot.setdefault(key, []).append(ride["wait_min"])
    requests = np.array([len(waits) for waits in per_slot.values()])
    average_wait = np.array([np.mean(waits) for waits in per_slot.values()])
    model = IsotonicRegression(increasing=True, out_of_bounds="clip").fit(requests, average_wait)
    return lambda n: float(model.predict([n])[0])
