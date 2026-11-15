// Shared map component. Owner: Arin. Used by the mobile screens and the dashboard.
//
// One map serves every screen. Each screen passes in only what it wants drawn;
// every prop except `center` is optional, and a layer is drawn only when its
// prop is passed. See /dev/map (dev server only) for an example of each screen.
//
// Colors come from tokens.css through the classes in Map.css. The heatmap is
// drawn on a canvas, which cannot read CSS variables, so its colors are read
// from the tokens at runtime.

import { Fragment, useEffect, useMemo } from "react";
import L from "leaflet";
import "leaflet.heat";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

import type { components } from "../api/schema";
import "./Map.css";

type Schemas = components["schemas"];
export type LatLng = Schemas["LatLng"];
export type Hazard = Schemas["Hazard"];
export type HeatmapPoint = Schemas["HeatmapPoint"];

export interface MapRoute {
  kind: Schemas["RouteOption"]["kind"];
  path: LatLng[];
  /** The highlighted route is drawn as a glowing green line, others as dotted grey. */
  highlighted?: boolean;
}

/** A point with an optional label, such as "Leavey Library" or "Live alert". */
export interface MapPlace extends LatLng {
  label?: string;
}

/** An open alert. The label, if given, is always shown next to the pin. */
export type AlertPin = MapPlace;

export interface MapProps {
  /** Where the map is centered. The map pans when this changes. */
  center: LatLng;
  routes?: MapRoute[];
  hazards?: Hazard[];
  /** Where the walk starts: a white dot. */
  start?: MapPlace;
  /** Where the walk ends: a green dot. */
  destination?: MapPlace;
  /** The student's live location: a white dot with a blue ring. */
  position?: LatLng;
  /** Pod members near the student: small gold dots. */
  podPositions?: LatLng[];
  /** Demand blobs, straight from GET /dashboard/heatmap `points`. */
  heatmapPoints?: HeatmapPoint[];
  /** Open alerts: red pins with a pulsing ring. */
  alertPins?: AlertPin[];
  /** Height in pixels, or any CSS height such as "100%". Width always fills the container. */
  height?: number | string;
  /** Leaflet zoom level. Higher is closer. */
  zoom?: number;
  /** "mobile" is navy like the student app, "dashboard" is dark grey. */
  variant?: "mobile" | "dashboard";
}

const CARTO_KEY = import.meta.env.VITE_CARTO_KEY?.trim();

const TILE_URL =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" +
  (CARTO_KEY ? `?key=${encodeURIComponent(CARTO_KEY)}` : "");

if (!CARTO_KEY && import.meta.env.DEV) {
  console.warn(
    "[map] VITE_CARTO_KEY is not set, so map tiles show an API KEY REQUIRED watermark. " +
      "Add your CARTO basemaps key to frontend/.env.local and restart npm run dev.",
  );
}

const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const HAZARD_LABELS: Record<Hazard["type"], string> = {
  light_out: "Light out",
  blocked_path: "Blocked path",
  other: "Hazard",
};

const toTuple = (p: LatLng): [number, number] => [p.lat, p.lng];

function hazardLabel(h: Hazard): string {
  const reports = h.report_count === 1 ? "1 report" : `${h.report_count} reports`;
  return `${HAZARD_LABELS[h.type]}, ${reports}`;
}

/** Keeps the map centered on `center` after the first render. */
function Recenter({ center }: { center: LatLng }) {
  const map = useMap();
  useEffect(() => {
    map.panTo([center.lat, center.lng]);
  }, [map, center.lat, center.lng]);
  return null;
}

/** Redraws the map when its box changes size, for example when a panel stretches. */
function FitToContainer() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

/** Orange demand blobs: dim red at the edges, orange, then a cream peak. */
function HeatLayer({ points }: { points: HeatmapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    const styles = getComputedStyle(map.getContainer());
    const token = (name: string) => styles.getPropertyValue(name).trim();
    const layer = L.heatLayer(
      points.map((p) => [p.location.lat, p.location.lng, p.intensity]),
      {
        radius: 42,
        blur: 30,
        // A lone point never reaches full strength once blurred, so `max` is
        // below 1 and the gradient peaks early.
        max: 0.6,
        minOpacity: 0.55,
        gradient: {
          0.1: token("--tp-heat-low"),
          0.35: token("--tp-heat-mid"),
          0.65: token("--tp-heat-high"),
          0.9: token("--tp-heat-peak"),
        },
      },
    ).addTo(map);
    return () => {
      layer.remove();
    };
  }, [map, points]);
  return null;
}

const alertIcon = L.divIcon({
  className: "tp-map-alert",
  html: '<span class="tp-map-alert__ring"></span><span class="tp-map-alert__dot"></span>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

function PlaceLabel({ text, direction }: { text?: string; direction: "left" | "right" }) {
  if (!text) return null;
  return (
    <Tooltip
      permanent
      direction={direction}
      offset={[direction === "left" ? -10 : 10, 0]}
      className="tp-map-label"
    >
      {text}
    </Tooltip>
  );
}

export default function Map({
  center,
  routes,
  hazards,
  start,
  destination,
  position,
  podPositions,
  heatmapPoints,
  alertPins,
  height = 290,
  zoom = 15,
  variant = "mobile",
}: MapProps) {
  // Draw the highlighted route last so it sits on top.
  const orderedRoutes = useMemo(
    () =>
      routes ? [...routes].sort((a, b) => Number(!!a.highlighted) - Number(!!b.highlighted)) : [],
    [routes],
  );
  // Place labels point toward the other end of the walk, so the map edge does not cut them off.
  const destinationIsWest = !!start && !!destination && destination.lng < start.lng;
  return (
    <div className={`tp-map tp-map--${variant}`} style={{ height }}>
      <MapContainer
        center={toTuple(center)}
        zoom={zoom}
        zoomControl={variant === "dashboard"}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} subdomains="abcd" maxZoom={20} />
        <Recenter center={center} />
        <FitToContainer />

        {heatmapPoints && heatmapPoints.length > 0 && <HeatLayer points={heatmapPoints} />}

        {orderedRoutes.map((r, i) => {
          const positions = r.path.map(toTuple);
          return r.highlighted ? (
            <Fragment key={`${r.kind}-${i}`}>
              <Polyline positions={positions} pathOptions={{ className: "tp-route-glow" }} />
              <Polyline positions={positions} pathOptions={{ className: "tp-route-main" }} />
            </Fragment>
          ) : (
            <Polyline
              key={`${r.kind}-${i}`}
              positions={positions}
              pathOptions={{ className: "tp-route-alt" }}
            />
          );
        })}

        {hazards?.map((h) => (
          <CircleMarker
            key={h.id}
            center={toTuple(h.location)}
            radius={7}
            pathOptions={{ className: "tp-map-hazard" }}
          >
            <Tooltip
              permanent
              direction="left"
              offset={[-10, 0]}
              className="tp-map-label tp-map-label--danger"
            >
              {hazardLabel(h)}
            </Tooltip>
          </CircleMarker>
        ))}

        {start && (
          <CircleMarker
            center={toTuple(start)}
            radius={7}
            pathOptions={{ className: "tp-map-start" }}
          >
            <PlaceLabel text={start.label} direction={destinationIsWest ? "left" : "right"} />
          </CircleMarker>
        )}

        {destination && (
          <CircleMarker
            center={toTuple(destination)}
            radius={9}
            pathOptions={{ className: "tp-map-destination" }}
          >
            <PlaceLabel text={destination.label} direction={destinationIsWest ? "right" : "left"} />
          </CircleMarker>
        )}

        {podPositions?.map((p, i) => (
          <CircleMarker
            key={`pod-${i}`}
            center={toTuple(p)}
            radius={6}
            pathOptions={{ className: "tp-map-pod" }}
          />
        ))}

        {position && (
          <>
            <CircleMarker
              center={toTuple(position)}
              radius={18}
              interactive={false}
              pathOptions={{ className: "tp-map-you-halo" }}
            />
            <CircleMarker
              center={toTuple(position)}
              radius={8}
              pathOptions={{ className: "tp-map-you" }}
            />
          </>
        )}

        {alertPins?.map((a, i) => (
          <Marker key={`alert-${i}`} position={toTuple(a)} icon={alertIcon}>
            {a.label && (
              <Tooltip
                permanent
                direction="right"
                offset={[14, 0]}
                className="tp-map-label tp-map-label--alert"
              >
                {a.label}
              </Tooltip>
            )}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
