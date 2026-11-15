// Campus Pulse dashboard for USG and GSG. Owner: Arin.
// Layout: sidebar, top bar, four stat cards, the demand map beside the live
// alert and transit forecast, then wait times and busiest corridors.
// API: GET /dashboard/summary, /heatmap, /forecast, /wait-times, /corridors,
//      GET /hazards, GET /alerts, POST /alerts/{id}/resolve,
//      WebSocket alert.created / alert.resolved

import { useCallback, useState } from "react";

import { getCorridors, getSummary, type Alert, type LatLng } from "../shared/api/client";
import "./dashboard.css";
import { exportSummary } from "./exportSummary";
import { CorridorsPanel } from "./panels/CorridorsPanel";
import { DemandHeatmapPanel } from "./panels/DemandHeatmapPanel";
import { KpiCards } from "./panels/KpiCards";
import { LiveAlertPanel } from "./panels/LiveAlertPanel";
import { Sidebar } from "./panels/Sidebar";
import { TopBar } from "./panels/TopBar";
import { TransitForecastPanel } from "./panels/TransitForecastPanel";
import { WaitTimesPanel } from "./panels/WaitTimesPanel";
import { useApi, useLiveAlerts } from "./useApi";

const SUMMARY_REFRESH_MS = 30_000;
const CORRIDORS_REFRESH_MS = 60_000;

export default function DashboardApp() {
  // The summary and corridors feed several cards, so they are loaded once here.
  const summary = useApi(getSummary, SUMMARY_REFRESH_MS);
  const corridors = useApi(getCorridors, CORRIDORS_REFRESH_MS);
  const { alerts, error: alertsError, resolve, liveStatus } = useLiveAlerts();
  const [mapFocus, setMapFocus] = useState<LatLng | null>(null);

  const busiest =
    corridors.data?.items.reduce<(typeof corridors.data.items)[number] | null>(
      (best, c) => (best && best.walks >= c.walks ? best : c),
      null,
    ) ?? null;

  const viewOnMap = useCallback((alert: Alert) => {
    setMapFocus({ ...alert.location });
    document
      .getElementById("overview-map")
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  return (
    <div className="dash">
      <Sidebar openAlerts={alerts.length} />
      <div className="dash-main">
        <TopBar
          simulated={summary.data?.simulated ?? false}
          liveStatus={liveStatus}
          onExport={() => exportSummary(summary.data, alerts, busiest)}
        />
        <main id="overview" className="dash-content">
          <h1 className="dash-title">Campus Pulse</h1>
          <p className="dash-lede">
            Late-night walking, rides and safety around University Park, tonight.
          </p>

          <KpiCards summary={summary.data} summaryError={summary.error} busiest={busiest} />

          <div className="dash-grid">
            <div id="overview-map" className="dash-grid__map">
              <DemandHeatmapPanel alerts={alerts} focus={mapFocus} />
            </div>
            <div id="alerts" className="dash-grid__alert">
              <LiveAlertPanel
                alerts={alerts}
                error={alertsError}
                onResolve={resolve}
                onViewOnMap={viewOnMap}
              />
            </div>
            <div className="dash-grid__forecast">
              <TransitForecastPanel />
            </div>
          </div>

          <div className="dash-lower">
            <WaitTimesPanel />
            <CorridorsPanel data={corridors.data} error={corridors.error} />
          </div>
        </main>
      </div>
    </div>
  );
}
