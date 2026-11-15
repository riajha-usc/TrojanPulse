// The three stat tiles. They share the summary, which DashboardApp loads once.

import { getCorridors, type DashboardSummary } from "../../shared/api/client";
import { useApi } from "../useApi";
import { Panel, PanelStatus } from "./Panel";

interface TileProps {
  summary: DashboardSummary | null;
  error: string | null;
}

export function SafetyReportsTile({ summary, error }: TileProps) {
  return (
    <Panel title="Live student safety reports" subtitle="From 1-tap reports, summarized by AI">
      {summary ? (
        <>
          <p className="dash-stat">{summary.active_hazard_reports}</p>
          <p className="dash-stat__text">Top issue: {summary.top_hazard_summary}</p>
        </>
      ) : (
        <PanelStatus error={error} />
      )}
    </Panel>
  );
}

export function PodsTile({ summary, error }: TileProps) {
  // Optional extra: the busiest corridor, if that endpoint answers.
  const corridors = useApi(getCorridors, 60_000);
  const busiest = corridors.data?.items.reduce<(typeof corridors.data.items)[number] | null>(
    (best, c) => (best && best.walks >= c.walks ? best : c),
    null,
  );

  return (
    <Panel title="Walking pods in progress" subtitle="Verified @usc.edu students">
      {summary ? (
        <>
          <p className="dash-stat">{summary.pods_in_progress}</p>
          <p className="dash-stat__text">
            {summary.active_walks} students walking now.
            {busiest && ` Busiest corridor: ${busiest.from_label} to ${busiest.to_label}.`}
          </p>
        </>
      ) : (
        <PanelStatus error={error} />
      )}
    </Panel>
  );
}

/** 120 -> "2 min", 45 -> "45 s", 150 -> "2.5 min". */
export function formatResponseTime(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round((seconds / 60) * 10) / 10;
  return `${minutes} min`;
}

export function ResponseTimeTile({ summary, error }: TileProps) {
  return (
    <Panel title="Alert response time" subtitle="Trigger to peer responder on the way">
      {summary ? (
        <>
          <p className="dash-stat">{formatResponseTime(summary.median_response_s)}</p>
          <p className="dash-stat__text">
            Median tonight. Pod and contacts are notified after the 10 s cancel window.
          </p>
        </>
      ) : (
        <PanelStatus error={error} />
      )}
    </Panel>
  );
}
