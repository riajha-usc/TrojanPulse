import { useEffect, useState } from "react";

import { CONFIG } from "../config";
import type { LatLng } from "../types";

export type GeoStatus = "idle" | "waiting" | "live" | "stale" | "denied" | "unavailable";

export type GeoFix = {
  position: LatLng;
  timestamp: number;
  accuracy: number;
};

export type GeoOptions = PositionOptions & {
  /** Maximum age for a fix to be described as live, in milliseconds. */
  freshForMs?: number;
};

type GeoState = {
  status: GeoStatus;
  fix: GeoFix | null;
  error: string | null;
};

type LocationErrorCode = "denied" | "timeout" | "unavailable";

export class LocationError extends Error {
  readonly code: LocationErrorCode;

  constructor(code: LocationErrorCode, message: string) {
    super(message);
    this.name = "LocationError";
    this.code = code;
  }
}

// A freshness policy, not a location. Callers can override it through GeoOptions.
const DEFAULT_FRESH_FOR_MS = 15_000;

function positiveMs(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
}

function settings(options: GeoOptions) {
  return {
    enableHighAccuracy: options.enableHighAccuracy ?? true,
    maximumAge:
      options.maximumAge !== undefined && Number.isFinite(options.maximumAge) && options.maximumAge >= 0
        ? options.maximumAge
        : 0,
    timeout: positiveMs(options.timeout, CONFIG.requestTimeoutMs),
    freshForMs: positiveMs(options.freshForMs, DEFAULT_FRESH_FOR_MS),
  };
}

function browserGeolocation(): Geolocation | null {
  return typeof navigator !== "undefined" ? navigator.geolocation ?? null : null;
}

function readFix(value: GeolocationPosition): GeoFix | null {
  const { latitude, longitude, accuracy } = value.coords;

  if (
    !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
    !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
    !Number.isFinite(accuracy) || accuracy < 0 ||
    !Number.isFinite(value.timestamp) || value.timestamp <= 0
  ) return null;

  return {
    position: { lat: latitude, lng: longitude },
    timestamp: value.timestamp,
    accuracy,
  };
}

function locationError(error: GeolocationPositionError): LocationError {
  if (error.code === 1) {
    return new LocationError("denied", "Location permission was denied. Allow location access to continue.");
  }
  if (error.code === 3) {
    return new LocationError("timeout", "Timed out waiting for your location.");
  }
  return new LocationError("unavailable", "Your location is unavailable. Please try again.");
}

/** Subscribe only while enabled. A stale or failed fix is never returned as a live position. */
export function useGeolocation(enabled: boolean, options: GeoOptions = {}) {
  const { enableHighAccuracy, maximumAge, timeout, freshForMs } = settings(options);
  const [state, setState] = useState<GeoState>({ status: "idle", fix: null, error: null });

  useEffect(() => {
    if (!enabled) {
      setState((previous) => ({ ...previous, status: "idle", error: null }));
      return;
    }

    const geolocation = browserGeolocation();
    if (!geolocation) {
      setState((previous) => ({
        ...previous,
        status: "unavailable",
        error: "This browser cannot provide your location.",
      }));
      return;
    }

    let active = true;
    let watchId: number | undefined;
    let staleTimer: ReturnType<typeof setTimeout> | undefined;

    setState((previous) => ({ ...previous, status: "waiting", error: null }));

    const fail = (error: LocationError) => {
      if (!active) return;
      clearTimeout(staleTimer);
      setState((previous) => ({
        ...previous,
        status: error.code === "denied" ? "denied" : "unavailable",
        error: error.message,
      }));
    };

    const checkFreshness = () => {
      if (!active) return;
      const now = Date.now();
      setState((previous) =>
        previous.status === "live" && previous.fix && now - previous.fix.timestamp >= freshForMs
          ? { ...previous, status: "stale", error: "Your last location is out of date." }
          : previous,
      );
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", checkFreshness);
    }

    try {
      watchId = geolocation.watchPosition(
        (value) => {
          if (!active) return;
          const fix = readFix(value);
          if (!fix) {
            fail(new LocationError("unavailable", "The browser returned an invalid location."));
            return;
          }

          clearTimeout(staleTimer);
          const remaining = freshForMs - Math.max(0, Date.now() - fix.timestamp);
          setState({
            fix,
            status: remaining > 0 ? "live" : "stale",
            error: remaining > 0 ? null : "Your last location is out of date.",
          });

          if (remaining > 0) {
            staleTimer = setTimeout(() => {
              if (active) {
                setState((previous) => ({
                  ...previous,
                  status: "stale",
                  error: "Your last location is out of date.",
                }));
              }
            }, remaining);
          }
        },
        (error) => fail(locationError(error)),
        { enableHighAccuracy, maximumAge, timeout },
      );
    } catch {
      fail(new LocationError("unavailable", "Could not start location tracking."));
    }

    return () => {
      active = false;
      clearTimeout(staleTimer);
      if (watchId !== undefined) geolocation.clearWatch(watchId);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", checkFreshness);
      }
    };
  }, [enabled, enableHighAccuracy, maximumAge, timeout, freshForMs]);

  const status: GeoStatus = enabled ? state.status : "idle";

  return {
    status,
    position: status === "live" ? state.fix?.position ?? null : null,
    lastKnownPosition: state.fix?.position ?? null,
    updatedAt: state.fix?.timestamp ?? null,
    accuracy: state.fix?.accuracy ?? null,
    error: status === "idle" ? null : status === "stale" ? "Your last location is out of date." : state.error,
  };
}

/** Obtain one fresh GPS fix. Cancelling also releases the browser's location watch. */
export function getCurrentFix(signal?: AbortSignal, options: GeoOptions = {}): Promise<GeoFix> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Location request cancelled.", "AbortError"));
      return;
    }

    const geolocation = browserGeolocation();
    if (!geolocation) {
      reject(new LocationError("unavailable", "This browser cannot provide your location."));
      return;
    }

    const { enableHighAccuracy, maximumAge, timeout, freshForMs } = settings(options);
    let settled = false;
    let watchId: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      if (watchId !== undefined) {
        geolocation.clearWatch(watchId);
        watchId = undefined;
      }
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const cancel = () => fail(new DOMException("Location request cancelled.", "AbortError"));
    signal?.addEventListener("abort", cancel, { once: true });
    timer = setTimeout(() => fail(new LocationError("timeout", "Timed out waiting for your location.")), timeout);

    try {
      watchId = geolocation.watchPosition(
        (value) => {
          if (settled) return;
          const fix = readFix(value);
          if (!fix) {
            fail(new LocationError("unavailable", "The browser returned an invalid location."));
            return;
          }
          if (Date.now() - fix.timestamp >= freshForMs) return;

          settled = true;
          cleanup();
          resolve(fix);
        },
        (error) => fail(locationError(error)),
        { enableHighAccuracy, maximumAge, timeout },
      );

      // Also handles a browser/mock that invokes its callback synchronously.
      if (settled) cleanup();
    } catch {
      fail(new LocationError("unavailable", "Could not request your location."));
    }
  });
}

/** Compatibility helper. No GPS fix means null; cancellation remains an AbortError. */
export async function getCurrentPosition(signal?: AbortSignal, options?: GeoOptions): Promise<LatLng | null> {
  try {
    return (await getCurrentFix(signal, options)).position;
  } catch (error: unknown) {
    if (error instanceof LocationError) return null;
    throw error;
  }
}
