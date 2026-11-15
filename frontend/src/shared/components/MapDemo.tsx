// Dev-only preview of the shared map, at /dev/map. Owner: Arin.
// Shows the map as each screen uses it, with the same example data the stub
// backend returns (backend/app/fixtures.py). Not included in production builds.

import Map, {
  type AlertPin,
  type Hazard,
  type HeatmapPoint,
  type LatLng,
  type MapPlace,
  type MapRoute,
} from "./Map";

const LEAVEY: LatLng = { lat: 34.0217, lng: -118.2828 };
const ELLENDALE_28TH: LatLng = { lat: 34.0297, lng: -118.2915 };
const HOOVER_30TH: LatLng = { lat: 34.0262, lng: -118.2841 };

const SAFEST: MapRoute = {
  kind: "safest",
  highlighted: true,
  path: [
    LEAVEY,
    { lat: 34.0235, lng: -118.2841 },
    HOOVER_30TH,
    { lat: 34.0297, lng: -118.2841 },
    ELLENDALE_28TH,
  ],
};

const FASTEST: MapRoute = {
  kind: "fastest",
  path: [LEAVEY, { lat: 34.0235, lng: -118.2915 }, ELLENDALE_28TH],
};

const HAZARDS: Hazard[] = [
  {
    id: "hz_1",
    type: "light_out",
    location: { lat: 34.027, lng: -118.2915 },
    report_count: 4,
    summary: "Streetlight out on Ellendale Pl, 4 reports this week.",
    updated_at: "2026-11-14T08:41:07Z",
  },
];

// Simulated: the API has no live pod member positions yet.
const POD_POSITIONS: LatLng[] = [
  { lat: 34.0245, lng: -118.2838 },
  { lat: 34.0243, lng: -118.2845 },
];

// The three stub points, plus a few more so the blobs read like the wireframe.
const HEATMAP: HeatmapPoint[] = [
  { location: HOOVER_30TH, intensity: 0.9 },
  { location: ELLENDALE_28TH, intensity: 0.6 },
  { location: LEAVEY, intensity: 0.7 },
  { location: { lat: 34.0285, lng: -118.2878 }, intensity: 0.5 },
  { location: { lat: 34.0252, lng: -118.2839 }, intensity: 0.8 },
  { location: { lat: 34.0205, lng: -118.2862 }, intensity: 0.45 },
];

const START: MapPlace = { ...LEAVEY, label: "Leavey Library" };
const DESTINATION: MapPlace = { ...ELLENDALE_28TH, label: "Ellendale & 28th" };

const DASHBOARD_ALERTS: AlertPin[] = [{ ...HOOVER_30TH, label: "Live alert" }];
const MINI_PIN: AlertPin[] = [HOOVER_30TH];

const MIDPOINT: LatLng = { lat: 34.0257, lng: -118.2871 };

const examples = [
  {
    title: "Screen 1: plan a walk",
    note: "routes (safest highlighted), hazards, start, destination",
    map: (
      <Map
        center={MIDPOINT}
        routes={[SAFEST, FASTEST]}
        hazards={HAZARDS}
        start={START}
        destination={DESTINATION}
      />
    ),
  },
  {
    title: "Screen 2: Walk Mode",
    note: "one route, destination, position, podPositions",
    map: (
      <Map
        center={{ lat: 34.0244, lng: -118.2841 }}
        zoom={16}
        routes={[SAFEST]}
        destination={DESTINATION}
        position={{ lat: 34.0244, lng: -118.2841 }}
        podPositions={POD_POSITIONS}
      />
    ),
  },
  {
    title: "Screens 3 and 4: mini map",
    note: "one alert pin without a label, height 140",
    map: <Map center={HOOVER_30TH} zoom={16} height={140} alertPins={MINI_PIN} />,
  },
  {
    title: "Dashboard: demand heatmap",
    note: 'heatmapPoints, alertPins, variant="dashboard"',
    map: (
      <Map
        variant="dashboard"
        center={{ lat: 34.0245, lng: -118.2865 }}
        height={360}
        heatmapPoints={HEATMAP}
        alertPins={DASHBOARD_ALERTS}
      />
    ),
  },
];

export default function MapDemo() {
  return (
    <main style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "var(--tp-font-display)" }}>Shared map preview</h1>
      <p style={{ color: "var(--tp-text-muted)" }}>
        Dev only. Simulated data from the stub backend.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
          gap: 24,
        }}
      >
        {examples.map((e) => (
          <section key={e.title} data-testid="map-example">
            <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>{e.title}</h2>
            <p style={{ margin: "0 0 8px", color: "var(--tp-text-muted)", fontSize: 13 }}>
              <code>{e.note}</code>
            </p>
            {e.map}
          </section>
        ))}
      </div>
    </main>
  );
}
