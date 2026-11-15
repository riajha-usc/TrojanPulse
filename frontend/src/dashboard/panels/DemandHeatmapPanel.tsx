import { getHeatmap, type Alert } from "../../shared/api/client";
import Map from "../../shared/components/Map";
import { useApi } from "../useApi";
import { Panel, PanelStatus } from "./Panel";

const CAMPUS_CENTER = { lat: 34.0235, lng: -118.2855 };
const REFRESH_MS = 60_000;

export function DemandHeatmapPanel({ alerts }: { alerts: Alert[] }) {
  const { data, error } = useApi(getHeatmap, REFRESH_MS);
  const alertPins = alerts.map((a) => ({ ...a.location, label: "Live alert" }));

  return (
    <Panel
      className="dash-heatmap"
      title="Fryft wait-time surges and walk demand"
      aside={data ? `Predicted for the next ${data.window_min} minutes, anonymized` : undefined}
    >
      {data ? (
        <div className="dash-heatmap__map">
          <Map
            variant="dashboard"
            center={CAMPUS_CENTER}
            zoom={15}
            height="100%"
            heatmapPoints={data.points}
            alertPins={alertPins}
          />
        </div>
      ) : (
        <PanelStatus error={error} />
      )}
      <ul className="dash-legend" aria-label="Map legend">
        <li>
          <span className="dash-legend__dot dash-legend__dot--demand" /> High demand
        </li>
        <li>
          <span className="dash-legend__dot dash-legend__dot--peak" /> Predicted surge peak
        </li>
        <li>
          <span className="dash-legend__dot dash-legend__dot--alert" /> Open alert
        </li>
      </ul>
    </Panel>
  );
}
