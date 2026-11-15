"""Serves the built web app from the API server. Owner: Ria.

Used when one server hosts everything (Replit): after `npm run build`, the
student app and dashboard are served from the same address as the API. In
local development the folder does not exist and nothing is added.
"""

import json
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


def page(dist: Path) -> str:
    """index.html, with settings the browser needs that are only known when the server starts."""
    runtime = {"cartoKey": os.getenv("VITE_CARTO_KEY", "")}
    script = f"<script>window.TP_RUNTIME = {json.dumps(runtime)};</script>"
    return (dist / "index.html").read_text().replace("</head>", script + "</head>", 1)


def serve_web_app(app: FastAPI, dist: Path = DIST) -> bool:
    """Add the web app to `app`. Call it after the API routes, so they are matched first."""
    if not (dist / "index.html").is_file():
        return False
    if (dist / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")
    html = page(dist)

    @app.get("/{path:path}", include_in_schema=False)
    def web_app(path: str):
        file = (dist / path).resolve()
        if path and file.is_file() and dist.resolve() in file.parents:
            return FileResponse(file)
        return HTMLResponse(html)  # the browser router handles /walk, /dashboard and the rest

    return True
