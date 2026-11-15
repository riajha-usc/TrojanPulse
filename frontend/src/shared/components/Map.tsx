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
  /** The highlighted route is drawn as a glowing green line, others as dashed grey. */
  highlighted?: boolean;
}

export interface AlertPin extends LatLng {
  label: string;
}

export interface MapProps {
  /** Where the map is centered. The map pans when this changes. */
  center: LatLng;
  routes?: MapRoute[];
  hazards?: Hazard[];
  /** The student's live location. */
  position?: LatLng;
  /** Pod members near the student. */
  podPositions?: LatLng[];
  /** Demand blobs, straight from GET /dashboard/heatmap `points`. */
  heatmapPoints?: HeatmapPoint[];
  /** Open alerts on the dashboard. */
  alertPins?: AlertPin[];
  /** Height in pixels. Width always fills the container. */
  height?: number;
  /** Leaflet zoom level. Higher is closer. */
  zoom?: number;
}

const TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
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

function cssToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Orange demand blobs. Low demand is a dim red, high demand a bright gold. */
function HeatLayer({ points }: { points: HeatmapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    const layer = L.heatLayer(
      points.map((p) => [p.location.lat, p.location.lng, p.intensity]),
      {
        // A lone point never reaches full strength once blurred, so the
        // gradient tops out early: red at the edges, orange, then gold.
        radius: 34,
        blur: 22,
        max: 0.8,
        minOpacity: 0.45,
        gradient: {
          0.1: cssToken("--tp-chart-red"),
          0.55: cssToken("--tp-chart-gold"),
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
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

export default function Map({
  center,
  routes,
  hazards,
  position,
  podPositions,
  heatmapPoints,
  alertPins,
  height = 290,
  zoom = 15,
}: MapProps) {
  // Draw the highlighted route last so it sits on top.
  const orderedRoutes = useMemo(
    () =>
      routes ? [...routes].sort((a, b) => Number(!!a.highlighted) - Number(!!b.highlighted)) : [],
    [routes],
  );

  return (
    <div className="tp-map" style={{ height }}>
      <MapContainer
        center={toTuple(center)}
        zoom={zoom}
        zoomControl={height >= 200}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} subdomains="abcd" maxZoom={20} />
        <Recenter center={center} />

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
            <Tooltip permanent direction="right" offset={[10, 0]} className="tp-map-label">
              {hazardLabel(h)}
            </Tooltip>
          </CircleMarker>
        ))}

        {podPositions?.map((p, i) => (
          <CircleMarker
            key={`pod-${i}`}
            center={toTuple(p)}
            radius={5}
            pathOptions={{ className: "tp-map-pod" }}
          />
        ))}

        {position && (
          <CircleMarker
            center={toTuple(position)}
            radius={8}
            pathOptions={{ className: "tp-map-you" }}
          />
        )}

        {alertPins?.map((a, i) => (
          <Marker key={`alert-${i}`} position={toTuple(a)} icon={alertIcon}>
            <Tooltip direction="top" offset={[0, -14]} className="tp-map-label">
              {a.label}
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
