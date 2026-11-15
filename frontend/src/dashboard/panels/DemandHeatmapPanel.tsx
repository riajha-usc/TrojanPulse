import { useState } from "react";

import { getHazards, getHeatmap, type Alert, type LatLng } from "../../shared/api/client";
import Map from "../../shared/components/Map";
import { useApi } from "../useApi";
import { Panel, PanelStatus, Tabs } from "./Panel";

const CAMPUS_CENTER = { lat: 34.0235, lng: -118.2855 };
const REFRESH_MS = 60_000;

type Layer = "demand" | "alerts" | "hazards";

const LAYERS: { value: Layer; label: string }[] = [
  { value: "demand", label: "Demand" },
  { value: "alerts", label: "Alerts" },
  { value: "hazards", label: "Hazards" },
];

interface DemandHeatmapPanelProps {
  alerts: Alert[];
  /** Set by "View on map" on an alert: the map pans there. */
  focus: LatLng | null;
}

export function DemandHeatmapPanel({ alerts, focus }: DemandHeatmapPanelProps) {
  const [layer, setLayer] = useState<Layer>("demand");
  const heatmap = useApi(getHeatmap, REFRESH_MS);
  const hazards = useApi(getHazards, REFRESH_MS);
  const alertPins = alerts.map((a) => ({ ...a.location, label: "Live alert" }));

  const subtitle =
    layer === "demand"
      ? heatmap.data
        ? `Last ${heatmap.data.window_min} minutes, anonymized`
        : "Anonymized"
      : layer === "alerts"
        ? `${alerts.length} open ${alerts.length === 1 ? "alert" : "alerts"}`
        : `${hazards.data?.length ?? 0} reported hazards`;

  const ready = layer === "hazards" ? hazards.data : heatmap.data;
  const error = layer === "hazards" ? hazards.error : heatmap.error;

  return (
    <Panel
      className="dash-map-card"
      title={layer === "hazards" ? "Reported hazards" : "Walk and ride demand"}
      subtitle={subtitle}
      actions={<Tabs label="Map layer" options={LAYERS} value={layer} onChange={setLayer} />}
    >
      {ready ? (
        <div className="dash-map">
          <Map
            variant="dashboard"
            center={focus ?? CAMPUS_CENTER}
            zoom={15}
            height="100%"
            heatmapPoints={layer === "demand" ? heatmap.data?.points : undefined}
            alertPins={layer !== "hazards" ? alertPins : undefined}
            hazards={layer === "hazards" ? (hazards.data ?? undefined) : undefined}
          />
        </div>
      ) : (
        <PanelStatus error={error} />
      )}
      <ul className="dash-legend" aria-label="Map legend">
        {layer === "demand" && (
          <>
            <li style={{ "--c": "var(--tp-heat-mid)" } as React.CSSProperties}>Demand</li>
            <li style={{ "--c": "var(--tp-heat-peak)" } as React.CSSProperties}>Peak demand</li>
          </>
        )}
        {layer !== "hazards" && (
          <li style={{ "--c": "var(--tp-alert)" } as React.CSSProperties}>Open alert</li>
        )}
        {layer === "hazards" && (
          <li style={{ "--c": "var(--tp-alert)" } as React.CSSProperties}>
            Hazard, with report count
          </li>
        )}
      </ul>
    </Panel>
  );
}
