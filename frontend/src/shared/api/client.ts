// Shared API client. Owner: Arin. Sharyu imports from here and asks for changes.
//
// Screens call these functions and never write a web request themselves, so
// if an endpoint changes, only this file changes. Every function returns the
// typed JSON, or throws an ApiError if the request fails.
//
// Types come from the backend contract. With the backend running, regenerate them:
//   npm run gen:api      (writes ./schema.d.ts from http://localhost:8000/openapi.json)

import type { components } from "./schema";

export const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
export const WS_URL: string = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000/ws";

// Types screens will need, re-exported so nobody imports schema.d.ts directly.
type S = components["schemas"];
export type LatLng = S["LatLng"];
export type User = S["User"];
export type LoginResponse = S["LoginResponse"];
export type RoutesResponse = S["RoutesResponse"];
export type RouteOption = S["RouteOption"];
export type Hazard = S["Hazard"];
export type HazardType = S["HazardReportRequest"]["type"];
export type Pod = S["Pod"];
export type PodsResponse = S["PodsResponse"];
export type WalkCreateRequest = S["WalkCreateRequest"];
export type Walk = S["Walk"];
export type AudioChunkResponse = S["AudioChunkResponse"];
export type Alert = S["Alert"];
export type AlertCreateRequest = S["AlertCreateRequest"];
export type AlertsResponse = S["AlertsResponse"];
export type DashboardSummary = S["DashboardSummary"];
export type HeatmapResponse = S["HeatmapResponse"];
export type HeatmapPoint = S["HeatmapPoint"];
export type ForecastResponse = S["ForecastResponse"];
export type WaitTimesResponse = S["WaitTimesResponse"];
export type CorridorsResponse = S["CorridorsResponse"];

/** Thrown when the backend answers with an error, or cannot be reached (status 0). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ---- Login token -----------------------------------------------------------
// The backend does not check the token yet. We send it anyway so nothing has
// to change when it does. It is kept for the browser tab only.

const TOKEN_KEY = "tp_token";
let token: string | null = readStoredToken();

function readStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return token;
}

export function setToken(value: string | null): void {
  token = value;
  try {
    if (value) sessionStorage.setItem(TOKEN_KEY, value);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage can be blocked (private window); the in-memory token still works.
  }
}

// ---- Request helper --------------------------------------------------------

type Query = Record<string, string | number | boolean | undefined>;

async function request<T>(
  method: "GET" | "POST",
  path: string,
  options: { query?: Query; json?: unknown; form?: FormData } = {},
): Promise<T> {
  const url = new URL(path, API_URL);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (options.form) {
    body = options.form; // the browser sets the multipart Content-Type
  } else if (options.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.json);
  }

  let res: Response;
  try {
    res = await fetch(url, { method, headers, body });
  } catch {
    throw new ApiError(0, `Cannot reach the TrojanPulse API at ${API_URL}`);
  }

  if (!res.ok) throw new ApiError(res.status, await errorMessage(res));
  return (await res.json()) as T;
}

/** Turns FastAPI's error body into one readable sentence. */
async function errorMessage(res: Response): Promise<string> {
  try {
    const data: unknown = await res.json();
    const detail = (data as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((d: { loc?: unknown[]; msg?: string }) => `${d.loc?.slice(1).join(".")}: ${d.msg}`)
        .join("; ");
    }
  } catch {
    // Not JSON; fall through.
  }
  return `Request failed with status ${res.status}`;
}

const id = (value: string) => encodeURIComponent(value);

// ---- Auth ------------------------------------------------------------------

/** Logs in with a @usc.edu email and remembers the token for later requests. */
export async function login(email: string): Promise<LoginResponse> {
  const res = await request<LoginResponse>("POST", "/auth/login", { json: { email } });
  setToken(res.token);
  return res;
}

export function logout(): void {
  setToken(null);
}

// ---- Routes and hazards ----------------------------------------------------

/** Safest route, fastest route and the hazards near them. */
export function getRoutes(from: LatLng, to: LatLng): Promise<RoutesResponse> {
  return request("GET", "/routes", {
    query: { from_lat: from.lat, from_lng: from.lng, to_lat: to.lat, to_lng: to.lng },
  });
}

export function getHazards(): Promise<Hazard[]> {
  return request("GET", "/hazards");
}

/** One-tap hazard report. */
export function reportHazard(type: HazardType, location: LatLng): Promise<Hazard> {
  return request("POST", "/hazards", { json: { type, location } });
}

// ---- Pods ------------------------------------------------------------------

/** Walking pods heading to `to`. The backend defaults `departInMin` when left out. */
export function getPods(to: LatLng, departInMin?: number): Promise<PodsResponse> {
  return request("GET", "/pods", {
    query: { to_lat: to.lat, to_lng: to.lng, depart_in_min: departInMin },
  });
}

export function joinPod(podId: string): Promise<Pod> {
  return request("POST", `/pods/${id(podId)}/join`);
}

// ---- Walks -----------------------------------------------------------------

export function startWalk(body: WalkCreateRequest): Promise<Walk> {
  return request("POST", "/walks", { json: body });
}

export function endWalk(walkId: string): Promise<Walk> {
  return request("POST", `/walks/${id(walkId)}/end`);
}

/**
 * Sends one audio chunk for scoring. The form needs an `audio` file and may
 * carry `sound_label`, `sound_score` and `sudden_stop`. The chunk length and
 * audio format are still being agreed with Ria.
 */
export function sendAudio(walkId: string, form: FormData): Promise<AudioChunkResponse> {
  return request("POST", `/walks/${id(walkId)}/audio`, { form });
}

// ---- Alerts ----------------------------------------------------------------

export function getAlerts(): Promise<AlertsResponse> {
  return request("GET", "/alerts");
}

export function createAlert(body: AlertCreateRequest): Promise<Alert> {
  return request("POST", "/alerts", { json: body });
}

export function resolveAlert(alertId: string): Promise<Alert> {
  return request("POST", `/alerts/${id(alertId)}/resolve`);
}

// ---- Dashboard -------------------------------------------------------------

export function getSummary(): Promise<DashboardSummary> {
  return request("GET", "/dashboard/summary");
}

export function getHeatmap(): Promise<HeatmapResponse> {
  return request("GET", "/dashboard/heatmap");
}

export function getForecast(): Promise<ForecastResponse> {
  return request("GET", "/dashboard/forecast");
}

export function getWaitTimes(): Promise<WaitTimesResponse> {
  return request("GET", "/dashboard/wait-times");
}

export function getCorridors(): Promise<CorridorsResponse> {
  return request("GET", "/dashboard/corridors");
}
