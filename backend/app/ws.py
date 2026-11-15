"""WebSocket connection hub. Owner: Ria.

Every connected browser gets every event. The clients filter by event type.
TODO(Ria): target events to one pod or to dashboards only.
"""

import logging
from typing import List, Optional

from fastapi import WebSocket
from pydantic import BaseModel

from app.schemas import WsEvent, WsEventType

log = logging.getLogger(__name__)


class Hub:
    def __init__(self) -> None:
        self.connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.connections:
            self.connections.remove(websocket)

    async def broadcast(self, event: WsEvent, skip: Optional[WebSocket] = None) -> None:
        message = event.model_dump(mode="json")
        for connection in list(self.connections):
            if connection is skip:
                continue
            try:
                await connection.send_json(message)
            except Exception as exc:  # a closed tab must not break delivery to the others
                log.info("Dropping dead WebSocket: %s", exc)
                self.disconnect(connection)

    async def emit(self, event_type: WsEventType, payload: BaseModel, skip: Optional[WebSocket] = None) -> None:
        await self.broadcast(WsEvent(type=event_type, payload=payload.model_dump(mode="json")), skip=skip)


hub = Hub()
