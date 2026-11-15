import type { DashboardSummary } from "../../shared/api/client";

export function DashboardHeader({ summary }: { summary: DashboardSummary | null }) {
  return (
    <header className="dash-header">
      <h1 className="dash-header__title">
        TrojanPulse <span className="dash-header__sub">USG &amp; GSG Campus Pulse</span>
      </h1>
      {summary?.simulated && <span className="dash-badge">Simulated data</span>}
    </header>
  );
}
