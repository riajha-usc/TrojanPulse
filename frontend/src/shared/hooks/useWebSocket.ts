// Shared WebSocket hook. Owner: Arin.
//
// Every message uses the WsEvent envelope from backend/app/schemas.py:
//   { type: "location.update" | "alert.created" | "alert.resolved" | "pod.updated", payload }
//
// The browser keeps ONE connection to WS_URL, shared by every screen that uses
// the hook. It opens when the first screen mounts, reconnects with backoff if
// it drops, and closes when the last screen unmounts.
//
// Usage:
//   const { status, send } = useWebSocket({
//     "alert.created": (alert) => addAlert(alert),
//     "alert.resolved": (alert) => removeAlert(alert.id),
//   });
//   send("location.update", { walk_id, location });
//
// Testing before the backend broadcasts: simulateWsEvent("alert.created", alert)
// delivers a fake message to every handler. In dev it is also on window.tpWs.

import { useEffect, useRef, useState } from "react";

import { WS_URL, type Alert, type LatLng, type Pod } from "../api/client";

/** Payload of location.update. Mirrors LocationUpdate in backend/app/schemas.py. */
export interface LocationUpdate {
  walk_id: string;
  location: LatLng;
}

/** Payload type for each event type. Mirrors WsEvent in backend/app/schemas.py. */
export interface WsEventMap {
  "location.update": LocationUpdate;
  "alert.created": Alert;
  "alert.resolved": Alert;
  "pod.updated": Pod;
}

export type WsEventType = keyof WsEventMap;
export type WsEvent<T extends WsEventType = WsEventType> = { type: T; payload: WsEventMap[T] };
export type WsHandlers = { [T in WsEventType]?: (payload: WsEventMap[T]) => void };
export type WsStatus = "connecting" | "open" | "closed";

// ---- The shared connection -------------------------------------------------

const RETRY_MIN_MS = 1000;
const RETRY_MAX_MS = 10000;

const listeners = new Set<(event: WsEvent) => void>();
const statusListeners = new Set<(status: WsStatus) => void>();
let socket: WebSocket | null = null;
let status: WsStatus = "closed";
let users = 0;
let retryMs = RETRY_MIN_MS;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let closeTimer: ReturnType<typeof setTimeout> | undefined;

function setStatus(next: WsStatus) {
  status = next;
  statusListeners.forEach((fn) => fn(next));
}

function deliver(event: WsEvent) {
  listeners.forEach((fn) => {
    try {
      fn(event);
    } catch (err) {
      console.error(`[ws] handler for ${event.type} failed`, err);
    }
  });
}

function connect() {
  clearTimeout(retryTimer);
  setStatus("connecting");
  const ws = new WebSocket(WS_URL);
  socket = ws;

  ws.onopen = () => {
    retryMs = RETRY_MIN_MS;
    setStatus("open");
  };

  ws.onmessage = (msg) => {
    let event: unknown;
    try {
      event = JSON.parse(String(msg.data));
    } catch {
      console.warn("[ws] ignored a message that is not JSON", msg.data);
      return;
    }
    if (isWsEvent(event)) deliver(event);
    else console.warn("[ws] ignored a message without type and payload", event);
  };

  ws.onclose = () => {
    if (socket !== ws) return; // an old socket closing after a reconnect
    socket = null;
    setStatus("closed");
    if (users > 0) {
      // Back off 1 s, 2 s, 4 s ... up to 10 s, with jitter so tabs don't sync up.
      const delay = retryMs * (0.75 + Math.random() * 0.5);
      retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
      retryTimer = setTimeout(connect, delay);
    }
  };

  // onerror is always followed by onclose, which handles the retry.
  ws.onerror = () => {};
}

function disconnect() {
  clearTimeout(retryTimer);
  const ws = socket;
  socket = null;
  ws?.close();
  setStatus("closed");
}

function isWsEvent(value: unknown): value is WsEvent {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string" &&
    "payload" in value
  );
}

/** Sends one message. Returns false if the connection is not open, so nothing was sent. */
export function sendWsEvent<T extends WsEventType>(type: T, payload: WsEventMap[T]): boolean {
  if (socket?.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify({ type, payload }));
  return true;
}

/** Delivers a fake message to every handler, as if the backend had sent it. For testing. */
export function simulateWsEvent<T extends WsEventType>(type: T, payload: WsEventMap[T]): void {
  deliver({ type, payload } as WsEvent);
}

if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as { tpWs: object }).tpWs = { simulate: simulateWsEvent, send: sendWsEvent };
}

// ---- The hook --------------------------------------------------------------

/**
 * Connects while the calling screen is mounted and calls `handlers[type]`
 * when a message of that type arrives. Handlers may change on every render.
 */
export function useWebSocket(handlers: WsHandlers = {}) {
  const [current, setCurrent] = useState<WsStatus>(status);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const onEvent = (event: WsEvent) => {
      const handler = handlersRef.current[event.type] as ((p: unknown) => void) | undefined;
      handler?.(event.payload);
    };
    listeners.add(onEvent);
    statusListeners.add(setCurrent);
    setCurrent(status);

    users += 1;
    clearTimeout(closeTimer);
    if (!socket) connect();

    return () => {
      listeners.delete(onEvent);
      statusListeners.delete(setCurrent);
      users -= 1;
      // Wait a moment before closing, so moving between two screens that both
      // use the hook (or React's dev double-mount) keeps the same connection.
      if (users === 0) closeTimer = setTimeout(disconnect, 1000);
    };
  }, []);

  return { status: current, send: sendWsEvent };
}
