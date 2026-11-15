import type { components } from "../shared/api/schema";

export type Schema = components["schemas"];
export type LatLng = Schema["LatLng"];
export type RouteKind = Schema["RouteOption"]["kind"];
export type Walk = Schema["Walk"];
export type Pod = Schema["Pod"];
export type Alert = Schema["Alert"];
export type AlertSource = Schema["AlertCreateRequest"]["source"];

export type Destination = {
  label: string;
  location: LatLng;
};

/** Route choices returned by the API, plus the student's selected destination and pod. */
export type WalkPlan = {
  origin: LatLng;
  destination: Destination;
  routes: Schema["RoutesResponse"];
  pod: Pod | null;
};

/** Compatibility with the existing screens while the revised files are installed. */
export type DemoPlan = Pick<WalkPlan, "destination" | "pod"> & {
  routeKind: RouteKind;
};

export type PositionSource = "gps" | "last-known" | "demo";

/**
 * State passed between the mobile routes.
 * Destination pages must validate their required fields before rendering.
 */
export type MobileNavigationState = {
  walk?: Walk;
  plan?: WalkPlan;

  position?: LatLng;
  positionSource?: PositionSource;
  /** Timestamp of the GPS fix, in milliseconds since the Unix epoch. */
  positionUpdatedAt?: number;
  /** Retained for compatibility; positionSource provides more detail. */
  positionIsSimulated?: boolean;

  source?: AlertSource;
  transcript?: string;
  reasons?: string[];
  alert?: Alert;

  /** @deprecated Remove once all pages use plan. */
  demoPlan?: DemoPlan;
  /** @deprecated Remove once all pages use alert. */
  demoAlert?: Alert;
  /** @deprecated Fresh voice triggers must not be silently suppressed. */
  suppressTriggersUntil?: number;
};
