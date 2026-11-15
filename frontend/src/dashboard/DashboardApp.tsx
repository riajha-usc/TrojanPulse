// Campus Pulse dashboard for USG and GSG. Owner: Arin.
// Wireframe panels: wait-time and walk-demand heatmap, transit forecast charts,
// wait times by pickup location, safety reports, pods in progress,
// alert response time, live alert, "Simulated data" badge.
// API: GET /dashboard/summary, /heatmap, /forecast, /wait-times, /corridors,
//      GET /alerts, POST /alerts/{id}/resolve, WebSocket alert.created / alert.resolved

import { getSummary } from "../shared/api/client";
import "./dashboard.css";
import { DashboardHeader } from "./panels/DashboardHeader";
import { DemandHeatmapPanel } from "./panels/DemandHeatmapPanel";
import { LiveAlertPanel } from "./panels/LiveAlertPanel";
import { PodsTile, ResponseTimeTile, SafetyReportsTile } from "./panels/StatTiles";
import { TransitForecastPanel } from "./panels/TransitForecastPanel";
import { WaitTimesPanel } from "./panels/WaitTimesPanel";
import { useApi, useLiveAlerts } from "./useApi";

const SUMMARY_REFRESH_MS = 30_000;

export default function DashboardApp() {
  // The summary feeds the badge and three tiles, so it is loaded once here.
  const summary = useApi(getSummary, SUMMARY_REFRESH_MS);
  const { alerts, error: alertsError, resolve } = useLiveAlerts();

  return (
    <div className="dash">
      <DashboardHeader summary={summary.data} />
      <main className="dash-grid">
        <DemandHeatmapPanel alerts={alerts} />
        <div className="dash-side">
          <TransitForecastPanel />
          <WaitTimesPanel />
        </div>
        <div className="dash-tiles">
          <SafetyReportsTile summary={summary.data} error={summary.error} />
          <PodsTile summary={summary.data} error={summary.error} />
          <ResponseTimeTile summary={summary.data} error={summary.error} />
          <LiveAlertPanel alerts={alerts} error={alertsError} onResolve={resolve} />
        </div>
      </main>
    </div>
  );
}
