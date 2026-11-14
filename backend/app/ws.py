"""WebSocket connection hub. Owner: Ria.

Skeleton only: it tracks connections and can broadcast an event to all of them.
TODO(Ria): target events to a pod or to dashboards instead of everyone.
"""

from typing import List

from fastapi import WebSocket

from app.schemas import WsEvent


class Hub:
    def __init__(self) -> None:
        self.connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.connections:
            self.connections.remove(websocket)

    async def broadcast(self, event: WsEvent) -> None:
        for connection in list(self.connections):
            await connection.send_json(event.model_dump(mode="json"))


hub = Hub()
