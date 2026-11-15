"""Tests for Soham's part: street graph, simulated data, and the services."""

import re
import shutil
import socket
from datetime import datetime, timedelta

import osmnx as ox
import pytest

from app.schemas import LatLng
from app.services import forecast, hazards, routing
from app.services import pods as pods_service
from data import places, store
from data.extract_incidents import parse_with_rules
from data.generate import generate
from data.graph import GRAPH_FILE, intersection, load_graph, meters

if not GRAPH_FILE.exists():
    pytest.skip(
        f"Street graph not found at {GRAPH_FILE}. Run from backend: python data/download_graph.py",
        allow_module_level=True,
    )

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


# ---------------------------------------------------------------- pods


def test_maya_and_dev_are_matched_into_one_pod(data_dir):
    pods = pods_service.match_pods(ELLENDALE, depart_in_min=5)
    pod = next(p for p in pods if "u_maya" in [m.user_id for m in p.members])
    assert "u_dev" in [m.user_id for m in pod.members]
    assert pod.meeting_point_label == "Leavey Library north exit"
    assert pod.destination_label == "Ellendale Pl & 28th St"
    assert pod.leaves_in_min == 5
    assert {m.display_name: m.initials for m in pod.members}["Maya R."] == "MR"


def test_pods_follow_the_matching_rules(data_dir):
    walkers = {w["id"]: w for w in store.load("walkers", data_dir)}
    pods = pods_service.match_pods(ELLENDALE, depart_in_min=5)
    assert pods
    for pod in pods:
        assert 1 <= len(pod.members) <= pods_service.MAX_MEMBERS
        departs = [datetime.fromisoformat(walkers[m.user_id]["depart_at"]) for m in pod.members]
        assert max(departs) - min(departs) <= timedelta(minutes=pods_service.DEPARTURE_WINDOW_MIN)
        for member in pod.members:
            dest = walkers[member.user_id]["destination"]
            assert meters((dest["lat"], dest["lng"]), (ELLENDALE.lat, ELLENDALE.lng)) <= 300
            assert re.fullmatch(r"[A-Z][a-z]+ [A-Z]\.", member.display_name)


def test_no_pods_when_nobody_matches(data_dir):
    assert pods_service.match_pods(LatLng(lat=34.0180, lng=-118.2950), depart_in_min=5) == []
    assert pods_service.match_pods(ELLENDALE, depart_in_min=600) == []


def test_new_walker_changes_the_pods(data_dir):
    def add_walker(rows):
        rows.append(
            {
                "id": "u_test",
                "display_name": "Test W.",
                "start_label": "Leavey Library",
                "start": {"lat": 34.0221, "lng": -118.2829},
                "destination_label": "Ellendale Pl & 28th St",
                "destination": {"lat": 34.0294, "lng": -118.2888},
                "depart_at": (places.DEMO_NOW + timedelta(minutes=2)).isoformat(timespec="minutes"),
            }
        )

    _edit(data_dir, "walkers", add_walker)
    pods = pods_service.match_pods(ELLENDALE, depart_in_min=5)
    assert any("u_test" in [m.user_id for m in p.members] for p in pods)


# ---------------------------------------------------------------- dashboard


def test_heatmap_is_scaled_and_follows_the_window(data_dir):
    hour = forecast.get_heatmap()
    assert hour.window_min == 60 and hour.points
    assert max(p.intensity for p in hour.points) == 1.0
    assert all(0 <= p.intensity <= 1 for p in hour.points)
    assert forecast.get_heatmap(window_min=10).points != hour.points


def test_heatmap_hides_a_lone_person(data_dir):
    lonely = (34.0175, -118.2950)

    def add_walker(rows):
        rows.append(
            {
                "id": "u_alone",
                "display_name": "Alone A.",
                "start_label": "Ginsburg Hall",
                "start": {"lat": lonely[0], "lng": lonely[1]},
                "destination_label": "Vermont Ave & 28th St",
                "destination": {"lat": lonely[0], "lng": lonely[1] + 0.0002},
                "depart_at": (places.DEMO_NOW - timedelta(minutes=10)).isoformat(timespec="minutes"),
            }
        )

    _edit(data_dir, "walkers", add_walker)
    points = forecast.get_heatmap().points
    assert all(meters((p.location.lat, p.location.lng), lonely) > 200 for p in points)


def test_corridors_busiest_first(data_dir):
    items = forecast.get_corridors().items
    assert 0 < len(items) <= forecast.TOP_CORRIDORS
    assert (items[0].from_label, items[0].to_label) == ("Leavey Library", "Ellendale Pl & 28th St")
    assert [c.walks for c in items] == sorted((c.walks for c in items), reverse=True)


def test_forecast_shape_and_leavey_surge(data_dir):
    result = forecast.get_forecast()
    assert [s.service for s in result.series] == ["fryft", "shuttle"]
    fryft = result.series[0].buckets
    past = [b for b in fryft if not b.is_forecast]
    future = [b for b in fryft if b.is_forecast]
    assert [b.label for b in past][0] == "20:00" and past[-1].label == "23:00"
    assert [b.label for b in future] == ["23:30", "00:00", "00:30", "01:00"]
    assert max(future, key=lambda b: b.requests).label == "00:00"
    assert result.surge_note == "Fryft surge expected at 12:00 AM near Leavey Library."


def _set_leavey_close_tonight(folder, ends_at):
    def change(rows):
        tonight = [e for e in rows if e["label"] == "Leavey Library closes" and e["ends_at"] == "2026-11-14T00:00"]
        for event in tonight:
            if ends_at is None:
                rows.remove(event)
            else:
                event["ends_at"] = ends_at

    _edit(folder, "campus_schedule", change)


def test_changing_closing_time_moves_the_surge(data_dir):
    _set_leavey_close_tonight(data_dir, "2026-11-14T01:00")
    result = forecast.get_forecast()
    assert result.surge_note == "Fryft surge expected at 1:00 AM near Leavey Library."


def test_no_surge_note_without_a_crowd(data_dir):
    _set_leavey_close_tonight(data_dir, None)
    assert forecast.get_forecast().surge_note == ""


def test_wait_times_grow_before_the_surge(data_dir):
    items = {w.location_label: w for w in forecast.get_wait_times().items}
    assert set(items) == set(places.PICKUP_SPOTS)
    assert items["Leavey Library"].in_30_min > items["Leavey Library"].now_min
    assert all(w.now_min >= 1 and w.in_30_min >= 1 for w in items.values())


def test_corridors_never_show_a_single_walk(data_dir):
    assert all(c.walks >= forecast.MIN_PEOPLE_PER_SQUARE for c in forecast.get_corridors().items)
