// "Export summary": downloads a short plain-text summary of what the dashboard shows.

import type { Alert, CorridorsResponse, DashboardSummary } from "../shared/api/client";

type Corridor = CorridorsResponse["items"][number];

export function exportSummary(
  summary: DashboardSummary | null,
  alerts: Alert[],
  busiest: Corridor | null,
): void {
  const now = new Date();
  const lines = ["TrojanPulse Campus Pulse summary", `Exported ${now.toLocaleString()}`];
  if (summary?.simulated) lines.push("All figures are simulated.");
  lines.push("");
  if (summary) {
    lines.push(
      `Students walking now: ${summary.active_walks}`,
      `Walking pods in progress: ${summary.pods_in_progress}`,
      `Active safety reports: ${summary.active_hazard_reports}`,
      `Top issue: ${summary.top_hazard_summary}`,
      `Alert response time (simulated): ${Math.round(summary.median_response_s / 6) / 10} min`,
    );
  } else {
    lines.push("Summary data was not loaded.");
  }
  if (busiest)
    lines.push(
      `Busiest corridor: ${busiest.from_label} to ${busiest.to_label} (${busiest.walks} walks)`,
    );
  lines.push(`Open alerts: ${alerts.length}`);
  for (const a of alerts) {
    lines.push(
      `  - ${new Date(a.created_at).toLocaleTimeString()} ${a.location_label ?? ""}`.trimEnd(),
    );
  }

  const blob = new Blob([lines.join("\n") + "\n"], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `trojanpulse-summary-${now.toISOString().slice(0, 10)}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}
