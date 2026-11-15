"""TrojanPulse API entry point.

Owner: Ria. Router registration lives here; ask before editing.
Run from the backend folder:  python -m uvicorn app.main:app --reload
"""

import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from app.config import settings
from app.routers import alerts, auth, dashboard, hazards, pods, routes, walks
from app.schemas import LocationUpdate, WsEvent
from app.store import store
from app.web import serve_web_app
from app.ws import hub
from data import store as data_store
from data.graph import GRAPH_FILE, load_graph



def warm_up() -> None:
    """Load the street graph before the first student asks for a route."""
    try:
        load_graph()
    except Exception:
        pass  # endpoints fall back to example data


@asynccontextmanager
async def lifespan(_: FastAPI):
    threading.Thread(target=warm_up, daemon=True).start()
    yield


app = FastAPI(title="TrojanPulse API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (auth.router, routes.router, hazards.router, pods.router, walks.router, alerts.router, dashboard.router):
    app.include_router(router)


@app.get("/health", tags=["meta"])
def health() -> dict:
    return {
        "status": "ok",
        "simulated_data": settings.simulated_data,
        "transcription": "groq" if settings.groq_api_key else "off",
        # "missing" means endpoints serve example data: run the data setup steps in the README
        "data": "ready" if GRAPH_FILE.exists() and (data_store.GENERATED_DIR / "walkers.json").exists() else "missing",
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """One connection per client. Messages use the schemas.WsEvent envelope.

    The only message a client sends is location.update. It is stored against
    the walk and passed on to the other clients, so pod members and the
    dashboard see the walker move.
    """
    await hub.connect(websocket)
    try:
        while True:
            message = await websocket.receive_json()
            try:
                event = WsEvent.model_validate(message)
                if event.type != "location.update":
                    continue
                update = LocationUpdate.model_validate(event.payload)
            except ValidationError:
                continue  # ignore malformed messages instead of dropping the connection
            if update.walk_id in store.walks:
                store.locations[update.walk_id] = update.location
                await hub.emit("location.update", update, skip=websocket)
    except WebSocketDisconnect:
        hub.disconnect(websocket)


# Last, so every API route above is matched first.
serve_web_app(app)
