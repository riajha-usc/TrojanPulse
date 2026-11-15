"""The API server can also serve the built web app (used on Replit)."""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.web import serve_web_app


def make_app(dist):
    app = FastAPI()

    @app.get("/alerts")
    def alerts():
        return {"alerts": []}

    return app, serve_web_app(app, dist)


def test_nothing_is_added_without_a_build(tmp_path):
    app, added = make_app(tmp_path)
    assert added is False
    assert TestClient(app).get("/dashboard").status_code == 404


def test_pages_files_and_api_routes(tmp_path, monkeypatch):
    monkeypatch.setenv("VITE_CARTO_KEY", "map-key")
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "app.js").write_text("console.log(1)")
    (tmp_path / "index.html").write_text("<html><head></head><body>app</body></html>")
    (tmp_path.parent / "secret.txt").write_text("private")
    app, added = make_app(tmp_path)
    client = TestClient(app)

    assert added is True
    assert client.get("/alerts").json() == {"alerts": []}  # API routes still win
    assert client.get("/assets/app.js").text == "console.log(1)"
    for path in ("/", "/dashboard", "/alert/sent"):
        page = client.get(path)
        assert page.status_code == 200 and "app" in page.text
        assert '"cartoKey": "map-key"' in page.text
    assert "private" not in client.get("/%2e%2e/secret.txt").text
