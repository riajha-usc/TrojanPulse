// Shared WebSocket hook. Owner: Arin.
//
// Every message uses the WsEvent envelope from backend/app/schemas.py:
//   { type: "location.update" | "alert.created" | "alert.resolved" | "pod.updated", payload }
//
// TODO(Arin): implement the hook (connect to WS_URL, reconnect, subscribe by event type).

export {};
