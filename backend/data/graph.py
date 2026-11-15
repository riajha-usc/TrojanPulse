"""The real street graph (OpenStreetMap), loaded from the saved file, plus small helpers."""

import math
from functools import lru_cache
from pathlib import Path
from typing import List, Tuple

import networkx as nx
import osmnx as ox

GRAPH_FILE = Path(__file__).parent / "cache" / "usc_walk.graphml"


@lru_cache(maxsize=1)
def load_graph() -> nx.MultiDiGraph:
    """Load the walking street graph from the saved file. No network needed."""
    if not GRAPH_FILE.exists():
        raise FileNotFoundError(f"{GRAPH_FILE} is missing. Run: python data/download_graph.py")
    return ox.load_graphml(GRAPH_FILE)


def edge_names(data: dict) -> List[str]:
    """Street names on one edge (OSM sometimes stores a list)."""
    name = data.get("name")
    if not name:
        return []
    return name if isinstance(name, list) else [name]


def meters(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    """Distance in meters between two (lat, lng) points. Accurate enough at campus scale."""
    dlat = (a[0] - b[0]) * 111_320
    dlng = (a[1] - b[1]) * 111_320 * math.cos(math.radians(a[0]))
    return math.hypot(dlat, dlng)


def nearest_street(lat: float, lng: float) -> str:
    """Name of the closest named street to a point, for example 'Ellendale Place'."""
    g = load_graph()
    best_name, best_m = "", float("inf")
    for u, v, data in g.edges(data=True):
        names = edge_names(data)
        if not names:
            continue
        mid = ((g.nodes[u]["y"] + g.nodes[v]["y"]) / 2, (g.nodes[u]["x"] + g.nodes[v]["x"]) / 2)
        dist = min(meters((lat, lng), node_point(g, u)), meters((lat, lng), node_point(g, v)), meters((lat, lng), mid))
        if dist < best_m:
            best_name, best_m = names[0], dist
    return best_name


def short_street(name: str) -> str:
    """'West 28th Street' -> '28th St', 'Ellendale Place' -> 'Ellendale Pl'."""
    for prefix in ("North ", "South ", "East ", "West "):
        name = name.removeprefix(prefix)
    for long, short in ((" Street", " St"), (" Place", " Pl"), (" Avenue", " Ave"), (" Boulevard", " Blvd")):
        if name.endswith(long):
            return name[: -len(long)] + short
    return name


def node_point(g: nx.MultiDiGraph, node) -> Tuple[float, float]:
    return (g.nodes[node]["y"], g.nodes[node]["x"])


def street_nodes(g: nx.MultiDiGraph, street: str) -> set:
    nodes = set()
    for u, v, data in g.edges(data=True):
        if street in edge_names(data):
            nodes.update((u, v))
    return nodes


def intersection(g: nx.MultiDiGraph, street_a: str, street_b: str) -> Tuple[float, float]:
    """Where two named streets meet: the closest pair of their corners, averaged.

    Raises ValueError when a street is not in the graph.
    """
    a_nodes, b_nodes = street_nodes(g, street_a), street_nodes(g, street_b)
    if not a_nodes or not b_nodes:
        raise ValueError(f"street not found: {street_a if not a_nodes else street_b}")
    a, b = min(
        ((a, b) for a in a_nodes for b in b_nodes),
        key=lambda pair: meters(node_point(g, pair[0]), node_point(g, pair[1])),
    )
    pa, pb = node_point(g, a), node_point(g, b)
    return ((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2)
