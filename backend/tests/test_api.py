"""End to end checks for every endpoint.

Run from the backend folder:  pytest
"""

from datetime import timedelta

from app import fixtures
from app.schemas import LatLng, Pod, PodMember
from app.services import hazards as hazards_service
from app.services import pods as pods_service
from app.services import routing
from data import places
from data import store as data_store

LOC = {"lat": 34.0221, "lng": -118.2829}
WALK_BODY = {"origin": LOC, "destination": LOC, "destination_label": "Ellendale Pl & 28th St", "pod_id": "pod_1"}
AUDIO = {"audio": ("chunk.webm", b"\x00", "audio/webm")}


def start_walk(client, headers=None):
    response = client.post("/walks", json=WALK_BODY, headers=headers or {})
    assert response.status_code == 201
    return response.json()


def test_health(client):
    assert client.get("/health").json()["status"] == "ok"


def test_login_and_token(client):
    assert client.post("/auth/login", json={"email": "someone@gmail.com"}).status_code == 403
    login = client.post("/auth/login", json={"email": "Maya.Rao@usc.edu"}).json()
    assert login["user"]["display_name"] == "Maya R."

    walk = start_walk(client, {"Authorization": f"Bearer {login['token']}"})
    assert walk["user_id"] == login["user"]["id"]
    assert client.post("/walks", json=WALK_BODY, headers={"Authorization": "Bearer nope"}).status_code == 401


def test_read_endpoints_answer(client):
    for path in [
        "/routes?from_lat=34.0217&from_lng=-118.2828&to_lat=34.0297&to_lng=-118.2915",
        "/hazards",
        "/pods?to_lat=34.0297&to_lng=-118.2915",
        "/alerts",
        "/dashboard/summary",
        "/dashboard/heatmap",
        "/dashboard/forecast",
        "/dashboard/wait-times",
        "/dashboard/corridors",
    ]:
        assert client.get(path).status_code == 200, path
    assert client.get("/routes?from_lat=999&from_lng=0&to_lat=0&to_lng=0").status_code == 422


def test_hazard_report(client):
    assert client.post("/hazards", json={"type": "light_out", "location": LOC}).status_code == 201


def test_missing_data_files_fall_back_to_example_data(client, monkeypatch):
    def no_files(*args, **kwargs):
        raise FileNotFoundError("usc_walk.graphml is missing")

    monkeypatch.setattr(routing, "get_routes", no_files)
    monkeypatch.setattr(pods_service, "match_pods", no_files)
    routes = client.get("/routes?from_lat=34.0221&from_lng=-118.2829&to_lat=34.0294&to_lng=-118.2888")
    assert routes.status_code == 200 and routes.json()["safest"]["minutes"] == 14
    assert client.get("/pods?to_lat=34.0294&to_lng=-118.2888").json()["pods"][0]["id"] == "pod_1"
    assert start_walk(client)["route"]["kind"] == "safest"


def test_join_pod(client, monkeypatch):
    pod = Pod(
        id="pod_7",
        members=[PodMember(user_id="u_maya", display_name="Maya R.", initials="MR")],
        destination_label="Ellendale Pl & 28th St",
        meeting_point_label="Leavey Library north exit",
        meeting_point=LatLng(**LOC),
        leaves_in_min=5,
    )
    monkeypatch.setattr(pods_service, "match_pods", lambda destination, depart_in_min: [pod])
    assert client.post("/pods/pod_7/join").status_code == 404  # not offered yet

    def login(email):
        token = client.post("/auth/login", json={"email": email}).json()["token"]
        return {"Authorization": f"Bearer {token}"}

    assert client.get("/pods?to_lat=34.0294&to_lng=-118.2888").json()["pods"][0]["id"] == "pod_7"
    with client.websocket_connect("/ws") as other_phone:
        joined = client.post("/pods/pod_7/join", headers=login("dev.kumar@usc.edu")).json()
        assert [m["initials"] for m in joined["members"]] == ["MR", "DK"]
        assert other_phone.receive_json()["type"] == "pod.updated"

    again = client.post("/pods/pod_7/join", headers=login("dev.kumar@usc.edu")).json()
    assert len(again["members"]) == 2  # joining twice changes nothing
    listed = client.get("/pods?to_lat=34.0294&to_lng=-118.2888").json()["pods"][0]
    assert len(listed["members"]) == 2  # the join shows up for the next student

    for email in ("ava.b@usc.edu", "leo.c@usc.edu"):
        assert client.post("/pods/pod_7/join", headers=login(email)).status_code == 200
    assert client.post("/pods/pod_7/join", headers=login("zoe.d@usc.edu")).status_code == 409  # full at 4


def test_summary_is_built_from_data_and_live_state(client, monkeypatch):
    now = places.DEMO_NOW
    walkers = [
        {"depart_at": (now - timedelta(minutes=5)).isoformat()},
        {"depart_at": (now - timedelta(minutes=90)).isoformat()},  # home already
        {"depart_at": (now + timedelta(minutes=5)).isoformat()},  # not left yet
    ]
    hazard = fixtures.HAZARD.model_copy(update={"report_count": 4, "summary": "Streetlight out on Ellendale Pl."})
    other = fixtures.HAZARD.model_copy(update={"id": "hz_2", "report_count": 1})
    real_load = data_store.load  # only the walkers file is replaced; routing still reads its own files
    monkeypatch.setattr(data_store, "load", lambda name: walkers if name == "walkers" else real_load(name))
    monkeypatch.setattr(hazards_service, "list_hazards", lambda: [hazard, other])
    monkeypatch.setattr(pods_service, "match_pods", lambda destination, depart_in_min: [fixtures.POD])
    monkeypatch.setattr(routing, "get_routes", lambda origin, destination: fixtures.ROUTES)

    start_walk(client)
    body = client.get("/dashboard/summary").json()
    assert body["active_walks"] == 2  # one simulated walker out now, one real walk
    assert body["pods_in_progress"] == 1 and body["active_hazard_reports"] == 5
    assert body["top_hazard_summary"] == "Streetlight out on Ellendale Pl."


