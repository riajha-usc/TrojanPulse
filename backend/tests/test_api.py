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


