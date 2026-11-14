"""Smoke test: every endpoint answers and its response matches the schema.

Run from the backend folder:  pytest
Keep this passing as stubs are replaced with real logic.
"""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

LOC = {"lat": 34.0217, "lng": -118.2828}
ROUTE_QUERY = "from_lat=34.0217&from_lng=-118.2828&to_lat=34.0297&to_lng=-118.2915"


def test_health():
    assert client.get("/health").json()["status"] == "ok"


def test_login_requires_usc_email():
    assert client.post("/auth/login", json={"email": "someone@gmail.com"}).status_code == 403
    assert client.post("/auth/login", json={"email": "demo@usc.edu"}).status_code == 200


def test_get_endpoints():
    for path in [
        f"/routes?{ROUTE_QUERY}",
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


def test_walk_and_alert_flow():
    walk = client.post(
        "/walks",
        json={"origin": LOC, "destination": LOC, "destination_label": "Ellendale Pl & 28th St"},
    )
    assert walk.status_code == 201
    walk_id = walk.json()["id"]

    audio = client.post(f"/walks/{walk_id}/audio", files={"audio": ("chunk.webm", b"\x00", "audio/webm")})
    assert audio.status_code == 200

    alert = client.post("/alerts", json={"walk_id": walk_id, "source": "voice", "location": LOC})
    assert alert.status_code == 201
    assert client.post(f"/alerts/{alert.json()['id']}/resolve").json()["status"] == "resolved"
    assert client.post(f"/walks/{walk_id}/end").json()["status"] == "ended"


def test_hazard_and_pod_writes():
    assert client.post("/hazards", json={"type": "light_out", "location": LOC}).status_code == 201
    assert client.post("/pods/pod_1/join").status_code == 200


def test_websocket_accepts():
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"type": "location.update", "payload": {"walk_id": "walk_1", "location": LOC}})
