import { getForecast, type ForecastResponse } from "../../shared/api/client";
import { useApi } from "../useApi";
import { Panel, PanelStatus } from "./Panel";

type Series = ForecastResponse["series"][number];

const REFRESH_MS = 30_000;

const SERVICE_NAMES: Record<string, string> = {
  fryft: "Fryft rides",
  shuttle: "USC shuttles",
};

/** "00:30" -> "12:30 AM". Labels that are not HH:MM are shown as they are. */
function formatLabel(label: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(label);
  if (!m) return label;
  const h = Number(m[1]);
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m[2] === "00" ? `${h12} ${suffix}` : `${h12}:${m[2]} ${suffix}`;
}

function BarChart({ series }: { series: Series }) {
  const max = Math.max(1, ...series.buckets.map((b) => b.requests));
  const firstForecast = series.buckets.findIndex((b) => b.is_forecast);
  // Show about four axis labels so they never collide.
  const step = Math.max(1, Math.ceil(series.buckets.length / 4));
  const name = SERVICE_NAMES[series.service] ?? series.service;

  return (
    <figure className="dash-chart">
      <figcaption className="dash-chart__title">{name}</figcaption>
      {series.buckets.length === 0 ? (
        <p className="dash-status">No data yet.</p>
      ) : (
        <>
          <div className="dash-chart__bars" role="img" aria-label={`${name}, requests per bucket`}>
            {series.buckets.map((b) => (
              <div
                key={b.label}
                className={`dash-chart__bar dash-chart__bar--${b.is_forecast ? "forecast" : series.service}`}
                style={{ height: `${Math.max(3, (b.requests / max) * 100)}%` }}
                title={`${formatLabel(b.label)}: ${b.requests} requests${b.is_forecast ? " (forecast)" : ""}`}
              />
            ))}
          </div>
          <div className="dash-chart__axis" aria-hidden="true">
            {series.buckets.map((b, i) => (
              <span key={b.label}>
                {i === firstForecast ? "Now" : i % step === 0 ? formatLabel(b.label) : ""}
              </span>
            ))}
          </div>
        </>
      )}
    </figure>
  );
}

export function TransitForecastPanel() {
  const { data, error } = useApi(getForecast, REFRESH_MS);

  return (
    <Panel
      title="Predictive transit bottlenecks"
      subtitle="Requests per 30 minutes. Teal bars are the forecast."
    >
      {data ? (
        <>
          {data.series.map((s) => (
            <BarChart key={s.service} series={s} />
          ))}
          {data.surge_note && <p className="dash-note">{data.surge_note}</p>}
        </>
      ) : (
        <PanelStatus error={error} />
      )}
    </Panel>
  );
}
