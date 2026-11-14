"""TrojanPulse API entry point.

Owner: Ria. Router registration lives here; ask before editing.
Run from the backend folder:  uvicorn app.main:app --reload
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import alerts, auth, dashboard, hazards, pods, routes, walks
from app.ws import hub

app = FastAPI(title="TrojanPulse API", version="0.1.0")

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
    return {"status": "ok", "simulated_data": settings.simulated_data}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """One connection per client. Messages use the schemas.WsEvent envelope."""
    await hub.connect(websocket)
    try:
        while True:
            message = await websocket.receive_json()
            # TODO(Ria): validate as WsEvent and handle location.update
            _ = message
    except WebSocketDisconnect:
        hub.disconnect(websocket)
