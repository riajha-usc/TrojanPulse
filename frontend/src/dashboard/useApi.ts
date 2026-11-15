// Data hooks for the dashboard. Owner: Arin.

import { useCallback, useEffect, useRef, useState } from "react";

import { getAlerts, resolveAlert, type Alert } from "../shared/api/client";
import { useWebSocket } from "../shared/hooks/useWebSocket";

export interface ApiState<T> {
  data: T | null;
  error: string | null;
}

/**
 * Loads data once when the panel opens and, if `refreshMs` is set, again on
 * that interval. Keeps showing the last good data if a refresh fails.
 */
export function useApi<T>(fetcher: () => Promise<T>, refreshMs?: number): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({ data: null, error: null });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;
    let loaded = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const data = await fetcherRef.current();
        loaded = true;
        if (!cancelled) setState({ data, error: null });
      } catch (err) {
        if (!cancelled) setState((s) => ({ data: s.data, error: (err as Error).message }));
      }
      // Refresh on the interval. Until the first load works, retry every 5 s
      // so a backend started late still shows up.
      if (cancelled) return;
      if (refreshMs) timer = setTimeout(load, refreshMs);
      else if (!loaded) timer = setTimeout(load, 5000);
    };
    void load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [refreshMs]);

  return state;
}

/**
 * Open alerts: loaded once, then kept live by alert.created and alert.resolved
 * messages. `resolve` marks one resolved on the backend and removes its card.
 */
export function useLiveAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [error, setError] = useState<string | null>(null);

  const upsert = useCallback((alert: Alert) => {
    if (alert.status !== "open") return;
    setAlerts((list) => [alert, ...list.filter((a) => a.id !== alert.id)]);
  }, []);
  const remove = useCallback((alertId: string) => {
    setAlerts((list) => list.filter((a) => a.id !== alertId));
  }, []);

  useEffect(() => {
    let cancelled = false;
    getAlerts()
      .then((res) => {
        if (cancelled) return;
        // Keep any alert that arrived over the WebSocket while this loaded.
        setAlerts((live) => {
          const open = res.alerts.filter((a) => a.status === "open");
          const ids = new Set(open.map((a) => a.id));
          return [...live.filter((a) => !ids.has(a.id)), ...open];
        });
        setError(null);
      })
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  const { status } = useWebSocket({
    "alert.created": upsert,
    "alert.resolved": (alert) => remove(alert.id),
  });

  const resolve = useCallback(
    async (alertId: string) => {
      await resolveAlert(alertId);
      remove(alertId);
    },
    [remove],
  );

  return { alerts, error, resolve, liveStatus: status };
}
