import { useEffect, useRef, useState } from "react";
import { getToken, WS_URL } from "../../shared/api/client";
import type { LatLng } from "../types";

type PositionFix = { position: LatLng; timestamp: number } | null;

/** Mobile sender while Arin's shared WebSocket hook remains a placeholder. */
export function useLocationSharing(walkId: string, fix: PositionFix, enabled: boolean) {
  const latest = useRef(fix);
  useEffect(() => { latest.current = fix; }, [fix]);
  const [status, setStatus] = useState<"connecting" | "connected" | "offline">("offline");

  useEffect(() => {
    if (!enabled || typeof WebSocket === "undefined") { setStatus("offline"); return; }
    let disposed = false;
    let socket: WebSocket | null = null;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    let interval: ReturnType<typeof setInterval> | undefined;
    let failures = 0;
    const send = () => {
      const current = latest.current;
      if (!disposed && current && Date.now() - current.timestamp <= 15_000 &&
          socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: "location.update",
          payload: { walk_id: walkId, location: current.position },
        }));
      }
    };
    const connect = () => {
      if (disposed) return;
      setStatus("connecting");
      try {
        const url = new URL(WS_URL);
        const token = getToken();
        if (token) url.searchParams.set("token", token);
        socket = new WebSocket(url);
        socket.onopen = () => {
          if (disposed) return;
          failures = 0;
          setStatus("connected");
          send();
          interval = setInterval(send, 5_000);
        };
        socket.onerror = () => { if (!disposed) setStatus("offline"); };
        socket.onclose = () => {
          clearInterval(interval);
          if (disposed) return;
          setStatus("offline");
          reconnect = setTimeout(connect, Math.min(1_000 * 2 ** failures++, 10_000));
        };
      } catch {
        setStatus("offline");
        reconnect = setTimeout(connect, 5_000);
      }
    };
    connect();
    return () => {
      disposed = true;
      clearTimeout(reconnect);
      clearInterval(interval);
      if (socket) {
        socket.onopen = null;
        socket.onclose = null;
        socket.onerror = null;
        socket.close();
      }
    };
  }, [walkId, enabled]);
  return status;
}
