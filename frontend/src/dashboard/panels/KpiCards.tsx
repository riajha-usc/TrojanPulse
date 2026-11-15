// The row of four stat cards. The summary and corridors are loaded once in DashboardApp.

import type { CorridorsResponse, DashboardSummary } from "../../shared/api/client";
import { PanelStatus } from "./Panel";

type Corridor = CorridorsResponse["items"][number];

interface KpiCardsProps {
  summary: DashboardSummary | null;
  summaryError: string | null;
  busiest: Corridor | null;
}

/** 120 -> "2 min", 45 -> "45 s", 150 -> "2.5 min". */
export function formatResponseTime(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  return `${Math.round((seconds / 60) * 10) / 10} min`;
}

function Kpi({
  id,
  label,
  pill,
  pillTone,
  value,
  small,
  foot,
}: {
  id?: string;
  label: string;
  pill: string;
  pillTone?: "simulated";
  value: string | number;
  small?: boolean;
  foot: string;
}) {
  return (
    <section id={id} className="dash-card dash-kpi">
      <div className="dash-kpi__top">
        <h2>{label}</h2>
        <span className={`dash-pill${pillTone ? ` dash-pill--${pillTone}` : ""}`}>{pill}</span>
      </div>
      <p className={`dash-kpi__value${small ? " dash-kpi__value--small" : ""}`}>{value}</p>
      <p className="dash-kpi__foot">{foot}</p>
    </section>
  );
}

export function KpiCards({ summary, summaryError, busiest }: KpiCardsProps) {
  if (!summary) {
    return (
      <div className="dash-kpis">
        <section className="dash-card dash-kpi">
          <PanelStatus error={summaryError} />
        </section>
      </div>
    );
  }
  return (
    <div className="dash-kpis">
      <Kpi
        id="safety"
        label="Safety reports"
        pill="Active"
        value={summary.active_hazard_reports}
        foot={`Top issue: ${summary.top_hazard_summary}`}
      />
      <Kpi
        id="pods"
        label="Walking pods"
        pill="In progress"
        value={summary.pods_in_progress}
        foot={`${summary.active_walks} students walking now`}
      />
      <Kpi
        label="Busiest corridor"
        pill={busiest ? `${busiest.walks} walks` : "Tonight"}
        value={busiest ? `${shortName(busiest.from_label)} → ${shortName(busiest.to_label)}` : "–"}
        small
        foot={busiest ? `${busiest.from_label} to ${busiest.to_label}` : "No corridor data yet"}
      />
      <Kpi
        label="Alert response"
        pill="Simulated"
        pillTone="simulated"
        value={formatResponseTime(summary.median_response_s)}
        foot="Trigger to peer responder on the way"
      />
    </div>
  );
}

/** "Leavey Library" -> "Leavey", "Ellendale Pl & 28th St" -> "Ellendale". */
function shortName(label: string): string {
  return label.split(/[\s&]/)[0];
}
