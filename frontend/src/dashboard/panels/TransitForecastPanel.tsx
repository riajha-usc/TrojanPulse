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
  const { buckets } = series;
  const name = SERVICE_NAMES[series.service] ?? series.service;
  const peak = Math.max(0, ...buckets.map((b) => b.requests));
  const max = Math.max(1, peak);
  const nowIndex = buckets.findIndex((b) => b.is_forecast);
  const last = buckets.length - 1;
  // Axis: first bar, "Now" under the first forecast bar, last bar. Skip any
  // label that would sit within two bars of "Now".
  const near = (i: number) => nowIndex >= 0 && Math.abs(i - nowIndex) <= 2;
  const ticks = [
    !near(0) && { i: 0, text: formatLabel(buckets[0]?.label ?? "") },
    nowIndex >= 0 && { i: nowIndex, text: "Now" },
    last > 0 && !near(last) && { i: last, text: formatLabel(buckets[last].label) },
  ].filter(Boolean) as { i: number; text: string }[];

  return (
    <figure className="dash-chart">
      <figcaption className="dash-chart__head">
        <b>{name}</b>
        {buckets.length > 0 && <span>peak {peak}</span>}
      </figcaption>
      {buckets.length === 0 ? (
        <p className="dash-status">No data yet.</p>
      ) : (
        <>
          <div className="dash-chart__bars" role="img" aria-label={`${name}, requests per bucket`}>
            {buckets.map((b) => (
              <div
                key={b.label}
                className={`dash-chart__bar dash-chart__bar--${b.is_forecast ? "forecast" : series.service}`}
                style={{ height: `${Math.max(4, (b.requests / max) * 100)}%` }}
                title={`${formatLabel(b.label)}: ${b.requests} requests${b.is_forecast ? " (forecast)" : ""}`}
              />
            ))}
          </div>
          <div className="dash-chart__axis" aria-hidden="true">
            {ticks.map((t) => (
              <span
                key={t.i}
                style={
                  t.i === last
                    ? { right: 0 }
                    : { left: `calc(${t.i} * (100% + 4px) / ${buckets.length})` }
                }
              >
                {t.text}
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
      id="transit"
      className="dash-forecast"
      title="Transit forecast"
      subtitle={
        <>
          Per 30 min · <span className="dash-forecast__key">teal is forecast</span>
        </>
      }
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
