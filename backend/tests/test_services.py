"""Tests for Soham's part: street graph, simulated data, and the services."""

import re
import shutil
import socket
from datetime import datetime, timedelta

import osmnx as ox
import pytest

from app.schemas import LatLng
from app.services import hazards, routing
from data import places, store
from data.extract_incidents import parse_with_rules
from data.generate import generate
from data.graph import intersection, load_graph, meters

# ---------------------------------------------------------------- street graph


def test_graph_loads_without_network(monkeypatch):
    def no_network(*args, **kwargs):
        raise RuntimeError("network access attempted")

    monkeypatch.setattr(socket, "socket", no_network)
    load_graph.cache_clear()
    assert len(load_graph().nodes) > 1000


def test_graph_covers_demo_places():
    g = load_graph()
    for label, (lat, lng) in {**places.CAMPUS, **places.DESTINATIONS}.items():
        _, dist_m = ox.distance.nearest_nodes(g, lng, lat, return_dist=True)
        assert dist_m < 100, f"no street corner within 100 m of {label}"


def test_graph_has_named_streets():
    g = load_graph()
    hoover_30th = intersection(g, "South Hoover Street", "West 30th Street")
    assert meters(hoover_30th, places.DESTINATIONS["Hoover St & 30th St"]) < 50


# ---------------------------------------------------------------- simulated data


@pytest.fixture(scope="module")
def generated(tmp_path_factory):
    folder = tmp_path_factory.mktemp("generated")
    generate(folder, use_llm=False)
    return folder


def test_generation_is_repeatable(generated, tmp_path):
    generate(tmp_path, use_llm=False)
    for path in generated.iterdir():
        assert path.read_bytes() == (tmp_path / path.name).read_bytes(), f"{path.name} changed between runs"


def test_story_broken_lights_on_ellendale(generated):
    g = load_graph()
    lights = store.load("streetlights", generated)
    story = [
        light
        for light in lights
        if places.BROKEN_LIGHT_STREET in str(g.edges[light["u"], light["v"], 0].get("name"))
        and light["lat"] < places.BROKEN_LIGHT_MAX_LAT
    ]
    assert story and not any(light["working"] for light in story)
    reports = [r for r in store.load("hazard_reports", generated) if r["type"] == "light_out"]
    near_ellendale = [r for r in reports if meters((r["lat"], r["lng"]), (34.0289, -118.2889)) < 30]
    assert len(near_ellendale) == 4


def test_story_leavey_closes_at_midnight_tonight(generated):
    tonight = [e for e in store.load("campus_schedule", generated) if e["ends_at"] == "2026-11-14T00:00"]
    assert [e["label"] for e in tonight] == ["Leavey Library closes"]


def test_story_pod_walkers(generated):
    walkers = {w["id"]: w for w in store.load("walkers", generated)}
    for user_id, minutes in (("u_maya", 5), ("u_dev", 7)):
        walker = walkers[user_id]
        assert walker["destination_label"] == places.DEMO_DESTINATION
        assert datetime.fromisoformat(walker["depart_at"]) == places.DEMO_NOW + timedelta(minutes=minutes)


def test_walker_names_are_first_name_and_initial(generated):
    for walker in store.load("walkers", generated):
        assert re.fullmatch(r"[A-Z][a-z]+ [A-Z]\.", walker["display_name"]), walker["display_name"]


def test_every_incident_is_extracted_and_geocoded(generated):
    raw = store.load("incidents_raw", generated)
    incidents = store.load("incidents", generated)
    assert len(incidents) == len(raw)
    for incident in incidents:
        assert meters((incident["location"]["lat"], incident["location"]["lng"]), (34.026, -118.286)) < 1500


def test_rules_parser_reads_a_dps_alert():
    text = (
        "Timely Warning. On Nov 3 at approximately 11:40 PM, a vehicle break-in was reported near "
        "South Hoover Street and West 30th Street. Stay on well-lit streets."
    )
    fields = parse_with_rules(text)
    assert fields == {
        "street_a": "South Hoover Street",
        "street_b": "West 30th Street",
        "month": 11,
        "day": 3,
        "clock": "23:40",
        "category": "vehicle break-in",
    }


# ---------------------------------------------------------------- routes

LEAVEY = LatLng(lat=places.CAMPUS["Leavey Library"][0], lng=places.CAMPUS["Leavey Library"][1])
ELLENDALE = LatLng(
    lat=places.DESTINATIONS["Ellendale Pl & 28th St"][0], lng=places.DESTINATIONS["Ellendale Pl & 28th St"][1]
)


@pytest.fixture
def data_dir(generated, tmp_path, monkeypatch):
    """A private copy of the generated data that the services read; tests may edit it."""
    folder = tmp_path / "data"
    shutil.copytree(generated, folder)
    monkeypatch.setattr(store, "GENERATED_DIR", folder)
    monkeypatch.delenv("GROQ_API_KEY", raising=False)  # fixed-pattern summaries, so tests are exact
    hazards._new_reports.clear()
    hazards._summary.cache_clear()
    yield folder
    hazards._new_reports.clear()


def _edit(folder, name, change):
    rows = store.load(name, folder)
    change(rows)
    store.save(name, rows, folder)


def _min_dist(path, point):
    return min(meters((p.lat, p.lng), point) for p in path)


def test_demo_trip_safest_and_fastest_differ(data_dir):
    result = routing.get_routes(LEAVEY, ELLENDALE)
    safest, fastest = result.safest, result.fastest
    assert safest.path != fastest.path
    assert fastest.distance_m < safest.distance_m
    assert fastest.minutes == round(fastest.distance_m / places.WALK_SPEED_M_PER_MIN)
    assert safest.notes[0] == "Lit the whole way"
    assert "lights out" in fastest.notes[0]
    assert safest.path[0] == LEAVEY and safest.path[-1] == ELLENDALE
    assert any("Ellendale Pl" in h.summary and h.report_count == 4 for h in result.hazards)


def test_route_points_sit_on_streets(data_dir):
    g = load_graph()
    path = routing.get_routes(LEAVEY, ELLENDALE).safest.path
    for point in path[1:-1]:
        _, dist_m = ox.distance.nearest_nodes(g, point.lng, point.lat, return_dist=True)
        assert dist_m < 150


def _middle_point(path):
    middle = path[len(path) // 2]
    return (middle.lat, middle.lng)


def test_breaking_a_light_moves_the_safest_route(data_dir):
    before = routing.get_routes(LEAVEY, ELLENDALE).safest
    spot = _middle_point(before.path)

    def break_nearest(lights):
        light = min((li for li in lights if li["working"]), key=lambda li: meters((li["lat"], li["lng"]), spot))
        light["working"] = False
        spot_holder.append((light["lat"], light["lng"]))

    spot_holder = []
    _edit(data_dir, "streetlights", break_nearest)
    after = routing.get_routes(LEAVEY, ELLENDALE).safest
    assert after.path != before.path
    assert _min_dist(after.path, spot_holder[0]) > routing.LIGHT_REACH_M


def test_adding_an_incident_moves_the_safest_route(data_dir):
    before = routing.get_routes(LEAVEY, ELLENDALE).safest
    lat, lng = _middle_point(before.path)
    incident = {
        "id": "inc_test",
        "text": "test",
        "location": {"lat": lat, "lng": lng},
        "time": (places.DEMO_NOW - timedelta(days=1)).isoformat(timespec="minutes"),
        "category": "robbery",
        "extracted_by": "rules",
    }
    _edit(data_dir, "incidents", lambda rows: rows.append(incident))
    after = routing.get_routes(LEAVEY, ELLENDALE).safest
    assert after.path != before.path


# ---------------------------------------------------------------- hazards


def test_hazards_group_reports_by_spot(data_dir):
    found = hazards.list_hazards()
    ellendale = [h for h in found if h.summary.startswith("Streetlight out on Ellendale Pl")]
    assert len(ellendale) == 1 and ellendale[0].report_count == 4
    assert ellendale[0].summary == "Streetlight out on Ellendale Pl, 4 reports this week."
    assert sum(h.report_count for h in found) == len(store.load("hazard_reports", data_dir))


def test_new_report_raises_count_and_refreshes_summary(data_dir):
    before = next(h for h in hazards.list_hazards() if h.report_count == 4)
    nearby = LatLng(lat=before.location.lat + 0.0001, lng=before.location.lng)  # ~11 m away
    after = hazards.add_report("light_out", nearby)
    assert after.id == before.id
    assert after.report_count == 5
    assert after.summary == "Streetlight out on Ellendale Pl, 5 reports this week."


def test_far_report_makes_a_new_hazard(data_dir):
    count = len(hazards.list_hazards())
    new = hazards.add_report("blocked_path", LEAVEY)
    assert new.report_count == 1
    assert len(hazards.list_hazards()) == count + 1
