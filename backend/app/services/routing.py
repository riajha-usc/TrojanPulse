"""Safe routing on the street graph. Owner: Soham.

Signature agreed with Ria. Keep the name, arguments and return type; the implementation is yours.

Fastest = shortest walking distance on the real OpenStreetMap graph.
Safest  = same search, but each meter of street costs more when it is dark (a broken light within
          25 m), near a recent incident, far from any open business, or has low foot traffic.
          Costs are per meter walked, so one broken light or incident is never counted twice.
          The data files are re-read on every call, so breaking a light or adding an incident changes
          the next answer.
"""

from datetime import datetime, timedelta
from typing import Dict, List, Tuple

import networkx as nx
import numpy as np
import osmnx as ox

from app.schemas import Hazard, LatLng, RouteOption, RoutesResponse
from app.services import hazards as hazard_service
from data import places, store
from data.generate import at_clock, night_of
from data.graph import load_graph

# Each meter costs 1, plus these extras. "Dark 4.0" means a dark meter counts as 5 meters.
DARK_EXTRA = 4.0  # a broken light within LIGHT_REACH_M of the segment
LIGHT_REACH_M = 25
INCIDENT_EXTRA = 1.0  # per incident in the last 30 days within INCIDENT_REACH_M (last 7 days: double)
INCIDENT_REACH_M = 40
INCIDENT_DAYS = 30
NO_BUSINESS_EXTRA = 0.25  # no open business within BUSINESS_REACH_M
BUSINESS_REACH_M = 80
LOW_TRAFFIC_EXTRA = 0.25  # fewer than 2 walkers starting or ending within TRAFFIC_REACH_M tonight
TRAFFIC_REACH_M = 120
HAZARD_NEAR_ROUTE_M = 40

EdgeKey = Tuple[int, int, int]


def get_routes(origin: LatLng, destination: LatLng) -> RoutesResponse:
    """Return the safest and fastest walking routes plus hazards near them.

    Safest weighs lighting, recent incidents and foot traffic. Fastest is the
    shortest walking time. Paths follow real streets from the OpenStreetMap graph.
    """
    g = load_graph()
    edges = list(g.edges(keys=True))
    features = _edge_features(g, edges)
    lengths = {e: g.edges[e]["length"] for e in edges}
    safety = {
        e: lengths[e]
        * (
            1
            + DARK_EXTRA * bool(f["broken_lights"])
            + INCIDENT_EXTRA * f["incident_weight"]
            + NO_BUSINESS_EXTRA * f["no_business"]
            + LOW_TRAFFIC_EXTRA * f["low_traffic"]
        )
        for e, f in features.items()
    }

    start = ox.distance.nearest_nodes(g, origin.lng, origin.lat)
    end = ox.distance.nearest_nodes(g, destination.lng, destination.lat)
    fastest = _route(g, "fastest", start, end, lengths, features, origin, destination)
    safest = _route(g, "safest", start, end, safety, features, origin, destination)

    return RoutesResponse(
        origin=origin,
        destination=destination,
        safest=safest,
        fastest=fastest,
        hazards=_hazards_near(safest.path + fastest.path),
    )


# ---------------------------------------------------------------- path search


def _route(g, kind, start, end, cost: Dict[EdgeKey, float], features, origin, destination) -> RouteOption:
    def weight(u, v, keyed):
        return min(cost[(u, v, k)] for k in keyed)

    nodes = nx.shortest_path(g, start, end, weight=weight)
    used = [min(g[u][v], key=lambda k: cost[(u, v, k)]) for u, v in zip(nodes, nodes[1:])]
    route_edges = [(u, v, k) for (u, v), k in zip(zip(nodes, nodes[1:]), used)]

    distance = sum(g.edges[e]["length"] for e in route_edges)
    return RouteOption(
        kind=kind,
        path=[origin, *_path_points(g, nodes, route_edges), destination],
        minutes=max(1, round(distance / places.WALK_SPEED_M_PER_MIN)),
        distance_m=round(distance),
        notes=_notes([features[e] for e in route_edges], [g.edges[e]["length"] for e in route_edges]),
    )


def _path_points(g, nodes, route_edges) -> List[LatLng]:
    """Follow each segment's real shape where OSM has one, so the line sits on the street."""
    points: List[Tuple[float, float]] = []
    for u, v, k in route_edges:
        start, end = (g.nodes[u]["x"], g.nodes[u]["y"]), (g.nodes[v]["x"], g.nodes[v]["y"])
        geometry = g.edges[u, v, k].get("geometry")
        coords = list(geometry.coords) if geometry is not None else [start, end]
        if np.hypot(*np.subtract(coords[-1], start)) < np.hypot(*np.subtract(coords[0], start)):
            coords.reverse()
        points.extend((y, x) for x, y in coords[:-1])
    last = nodes[-1]
    points.append((g.nodes[last]["y"], g.nodes[last]["x"]))
    return [LatLng(lat=round(lat, 6), lng=round(lng, 6)) for lat, lng in points]


def _notes(route_features: List[dict], lengths: List[float]) -> List[str]:
    """One or two short reasons, counted from what the route actually passes."""
    broken = set().union(*(f["broken_lights"] for f in route_features)) if route_features else set()
    incidents = set().union(*(f["incidents"] for f in route_features)) if route_features else set()
    shops = set().union(*(f["businesses"] for f in route_features)) if route_features else set()
    low_traffic_m = sum(length for f, length in zip(route_features, lengths) if f["low_traffic"])

    notes = ["Lit the whole way" if not broken else _plural(len(broken), "light out", "lights out")]
    if incidents:
        notes.append(_plural(len(incidents), "recent incident nearby", "recent incidents nearby"))
    elif shops:
        notes.append(_plural(len(shops), "open business", "open businesses"))
    elif lengths and low_traffic_m > sum(lengths) / 2:
        notes.append("Low foot traffic")
    return notes


def _plural(count: int, one: str, many: str) -> str:
    return f"{count} {one if count == 1 else many}"


# ---------------------------------------------------------------- segment features


def _edge_features(g, edges: List[EdgeKey]) -> Dict[EdgeKey, dict]:
    """For every segment: which broken lights, incidents and open businesses are near, and foot traffic."""
    now = places.DEMO_NOW
    a = _xy(np.array([[g.nodes[u]["y"], g.nodes[u]["x"]] for u, _, _ in edges]))
    b = _xy(np.array([[g.nodes[v]["y"], g.nodes[v]["x"]] for _, v, _ in edges]))

    lights = [light for light in store.load("streetlights") if not light["working"]]
    near_light = _near(lights, a, b, LIGHT_REACH_M, lambda r: (r["lat"], r["lng"]))

    incidents = [
        i for i in store.load("incidents") if now - datetime.fromisoformat(i["time"]) <= timedelta(days=INCIDENT_DAYS)
    ]
    near_incident = _near(incidents, a, b, INCIDENT_REACH_M, lambda r: (r["location"]["lat"], r["location"]["lng"]))
    incident_weight = [2.0 if now - datetime.fromisoformat(i["time"]) <= timedelta(days=7) else 1.0 for i in incidents]

    shops = [s for s in store.load("businesses") if now < at_clock(night_of(now), s["closes"])]
    near_shop = _near(shops, a, b, BUSINESS_REACH_M, lambda r: (r["location"]["lat"], r["location"]["lng"]))

    walker_points = [p for w in store.load("walkers") for p in (w["start"], w["destination"])]
    near_walkers = _near(walker_points, a, b, TRAFFIC_REACH_M, lambda r: (r["lat"], r["lng"]))

    return {
        e: {
            "broken_lights": {lights[j]["id"] for j in near_light[i]},
            "incidents": {incidents[j]["id"] for j in near_incident[i]},
            "incident_weight": sum(incident_weight[j] for j in near_incident[i]),
            "businesses": {shops[j]["id"] for j in near_shop[i]},
            "no_business": not near_shop[i],
            "low_traffic": len(near_walkers[i]) < 2,
        }
        for i, e in enumerate(edges)
    }


REF_LAT, REF_LNG = 34.026, -118.286


def _xy(latlng: np.ndarray) -> np.ndarray:
    """(lat, lng) rows to local meters. Accurate enough at campus scale."""
    latlng = latlng.reshape(-1, 2)
    return np.column_stack(
        [(latlng[:, 1] - REF_LNG) * 111_320 * np.cos(np.radians(REF_LAT)), (latlng[:, 0] - REF_LAT) * 111_320]
    )


def _near(rows, a: np.ndarray, b: np.ndarray, reach_m: float, point_of) -> List[List[int]]:
    """For each segment a->b, the indexes of rows whose point is within reach_m of it."""
    result: List[List[int]] = [[] for _ in range(len(a))]
    if not rows:
        return result
    points = _xy(np.array([point_of(r) for r in rows]))
    ab = b - a
    denom = np.maximum((ab**2).sum(axis=1), 1e-9)
    for first in range(0, len(points), 50):  # batches keep memory small
        p = points[first : first + 50]
        t = np.clip(((p[:, None, :] - a[None]) * ab[None]).sum(axis=2) / denom[None], 0, 1)
        closest = a[None] + t[..., None] * ab[None]
        rows_idx, seg_idx = np.nonzero(np.linalg.norm(p[:, None, :] - closest, axis=2) <= reach_m)
        for r, s in zip(rows_idx, seg_idx):
            result[s].append(first + int(r))
    return result


def _hazards_near(path: List[LatLng]) -> List[Hazard]:
    points = _xy(np.array([[p.lat, p.lng] for p in path]))
    result = []
    for hazard in hazard_service.list_hazards():
        spot = _xy(np.array([hazard.location.lat, hazard.location.lng]))
        if np.min(np.linalg.norm(points - spot, axis=1)) <= HAZARD_NEAR_ROUTE_M:
            result.append(hazard)
    return result
