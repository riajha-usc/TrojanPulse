// Demo start location. Owner: Ria.
//
// Routes only exist around USC. When the browser gives no location within a
// few seconds, or one far from campus, the app uses Leavey Library, so anyone
// opening the demo can still plan a walk. The screens say so when it happens.
// Set CONFIG.demoLocationFallback to false before real use.

import { CONFIG } from "../config";
import type { LatLng } from "../types";

export const DEMO_START = { label: "Leavey Library", lat: 34.0217, lng: -118.2828 };

const CAMPUS_CENTER = { lat: 34.0235, lng: -118.2855 };
const CAMPUS_RADIUS_M = 3000;
const WAIT_FOR_REAL_FIX_MS = 8000;
const REPEAT_MS = 5000;

type Provider = Pick<Geolocation, "watchPosition" | "clearWatch">;

export function isDemoPosition(position: LatLng | null | undefined): boolean {
  return position?.lat === DEMO_START.lat && position?.lng === DEMO_START.lng;
}

function farFromCampus(lat: number, lng: number): boolean {
  const north = (lat - CAMPUS_CENTER.lat) * 111_320;
  const east = (lng - CAMPUS_CENTER.lng) * 111_320 * Math.cos((lat * Math.PI) / 180);
  return !(Math.hypot(north, east) <= CAMPUS_RADIUS_M);
}

function demoFix(): GeolocationPosition {
  const coords = { latitude: DEMO_START.lat, longitude: DEMO_START.lng, accuracy: 25 };
  return { coords, timestamp: Date.now() } as GeolocationPosition;
}

const stops = new Map<number, () => void>();
let nextId = 1;

function watch(real: Geolocation | null, onFix: PositionCallback, options?: PositionOptions) {
  const id = nextId++;
  let stopped = false;
  let waitTimer: ReturnType<typeof setTimeout> | undefined;
  let demoTimer: ReturnType<typeof setInterval> | undefined;
  let realId: number | undefined;

  const sendDemo = () => {
    if (!stopped) onFix(demoFix());
  };
  const startDemo = () => {
    clearTimeout(waitTimer);
    if (stopped || demoTimer !== undefined) return;
    setTimeout(sendDemo, 0);
    demoTimer = setInterval(sendDemo, REPEAT_MS);
  };
  const stopDemo = () => {
    clearTimeout(waitTimer);
    clearInterval(demoTimer);
    demoTimer = undefined;
  };

  if (!real) {
    startDemo();
  } else {
    waitTimer = setTimeout(startDemo, WAIT_FOR_REAL_FIX_MS);
    try {
      realId = real.watchPosition(
        (value) => {
          if (stopped) return;
          if (farFromCampus(value.coords.latitude, value.coords.longitude)) return startDemo();
          stopDemo();
          onFix(value);
        },
        startDemo,
        options,
      );
    } catch {
      startDemo();
    }
  }

  stops.set(id, () => {
    stopped = true;
    stopDemo();
    if (real && realId !== undefined) real.clearWatch(realId);
  });
  return id;
}

/** The browser's location, replaced by the demo start when it is missing or off campus. */
export function campusGeolocation(real: Geolocation | null): Provider | null {
  if (!CONFIG.demoLocationFallback) return real;
  return {
    watchPosition: (onFix, _onError, options) => watch(real, onFix, options ?? undefined),
    clearWatch: (id) => {
      stops.get(id)?.();
      stops.delete(id);
    },
  };
}
