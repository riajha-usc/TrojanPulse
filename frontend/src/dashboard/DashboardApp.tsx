// Campus Pulse dashboard for USG and GSG. Owner: Arin.
// Wireframe panels: wait-time and walk-demand heatmap, transit forecast charts,
// wait times by pickup location, safety reports, pods in progress,
// alert response time, live alert, "Simulated data" badge.
// API: GET /dashboard/summary, /heatmap, /forecast, /wait-times, /corridors,
//      GET /alerts, POST /alerts/{id}/resolve, WebSocket alert.created / alert.resolved

export default function DashboardApp() {
  return (
    <main className="tp-placeholder">
      <h1>TrojanPulse Campus Pulse</h1>
      <p>TODO(Arin): build the dashboard from the wireframe. Put panels in ./panels.</p>
    </main>
  );
}
