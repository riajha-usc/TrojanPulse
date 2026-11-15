import { useState } from "react";

import type { Alert } from "../../shared/api/client";

interface LiveAlertPanelProps {
  alerts: Alert[];
  error: string | null;
  onResolve: (alertId: string) => Promise<void>;
  onViewOnMap: (alert: Alert) => void;
}

/** created_at is UTC; show it in the viewer's local time, e.g. "12:41:07 AM". */
function localTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

const SOURCE_TEXT: Record<Alert["source"], string> = {
  voice: "voice trigger",
  manual: "Hold for help",
};

function Notified({ label, count }: { label: string; count: number }) {
  return (
    <div className="dash-alert__row">
      {label}
      {count > 0 ? <b>Notified · {count}</b> : <span>Not notified</span>}
    </div>
  );
}

function AlertCard({
  alert,
  onResolve,
  onViewOnMap,
}: {
  alert: Alert;
  onResolve: LiveAlertPanelProps["onResolve"];
  onViewOnMap: LiveAlertPanelProps["onViewOnMap"];
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const resolve = async () => {
    setBusy(true);
    setFailed(null);
    try {
      await onResolve(alert.id); // the card disappears on success
    } catch (err) {
      setFailed((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <article className="dash-card dash-alert" aria-live="assertive">
      <header className="dash-alert__head">
        <h2 className="dash-card__title">
          <span className="dash-alert__dot" aria-hidden="true" />
          Live alert
        </h2>
        <span className="dash-alert__when">{localTime(alert.created_at)}</span>
      </header>
      <p className="dash-card__subtitle">
        {alert.location_label ? `${alert.location_label} · ` : ""}
        {SOURCE_TEXT[alert.source]}
      </p>
      {alert.transcript && (
        <blockquote className="dash-alert__quote">“{alert.transcript}”</blockquote>
      )}
      {alert.reasons && alert.reasons.length > 0 && (
        <ul className="dash-alert__reasons" aria-label="Why it triggered">
          {alert.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      <div className="dash-alert__rows">
        <Notified label="Walking pod" count={alert.pod_notified} />
        <Notified label="Emergency contacts" count={alert.contacts_notified} />
      </div>
      <div className="dash-alert__actions">
        <button className="dash-btn dash-btn--primary" onClick={resolve} disabled={busy}>
          {busy ? "Resolving…" : "Mark resolved"}
        </button>
        <button className="dash-btn" onClick={() => onViewOnMap(alert)}>
          View on map
        </button>
      </div>
      {failed && (
        <p className="dash-alert__error" role="alert">
          Couldn't resolve: {failed}
        </p>
      )}
    </article>
  );
}

export function LiveAlertPanel({ alerts, error, onResolve, onViewOnMap }: LiveAlertPanelProps) {
  if (alerts.length === 0) {
    return (
      <section className="dash-card dash-alert--calm">
        <h2 className="dash-card__title">Live alert</h2>
        <p className="dash-alert__calm">
          <span className="dash-alert__calm-dot" aria-hidden="true" />
          {error ? `Couldn't load alerts. (${error})` : "No open alerts"}
        </p>
      </section>
    );
  }
  return (
    <div className="dash-alerts">
      {alerts.map((a) => (
        <AlertCard key={a.id} alert={a} onResolve={onResolve} onViewOnMap={onViewOnMap} />
      ))}
    </div>
  );
}
