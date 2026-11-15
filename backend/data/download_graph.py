"""Download the walking street graph around USC once and save it to data/cache/.

Run from the backend folder:  python data/download_graph.py
After this, routing loads the graph from the file, so the demo needs no network.
"""

from pathlib import Path

import osmnx as ox

CACHE_DIR = Path(__file__).parent / "cache"
GRAPH_FILE = CACHE_DIR / "usc_walk.graphml"

# Vermont Ave to Figueroa St, Exposition Blvd to Adams Blvd, with a small margin.
WEST, SOUTH, EAST, NORTH = -118.2960, 34.0165, -118.2760, 34.0350

# Walkable ways. OSMnx's built-in "walk" filter drops streets tagged sidewalk=separate, which in LA
# removes almost every named street and leaves only unnamed sidewalks. We need the street names for
# hazard summaries and route notes, so we keep both.
WALK_FILTER = (
    '["highway"]["area"!~"yes"]["access"!~"private"]'
    '["highway"!~"abandoned|bus_guideway|construction|cycleway|motor|no|planned|platform|proposed|raceway|razed"]'
    '["foot"!~"no"]["service"!~"private"]'
)


def main() -> None:
    ox.settings.use_cache = False  # we keep our own saved file; don't leave OSMnx's cache/ folder behind
    ox.settings.useful_tags_way = list(ox.settings.useful_tags_way) + ["footway"]  # marks sidewalks
    CACHE_DIR.mkdir(exist_ok=True)
    # network_type="walk" keeps one-way streets walkable in both directions.
    graph = ox.graph_from_bbox(bbox=(WEST, SOUTH, EAST, NORTH), network_type="walk", custom_filter=WALK_FILTER)
    ox.save_graphml(graph, GRAPH_FILE)
    print(f"Saved {len(graph.nodes)} corners and {len(graph.edges)} street segments to {GRAPH_FILE}")


if __name__ == "__main__":
    main()
