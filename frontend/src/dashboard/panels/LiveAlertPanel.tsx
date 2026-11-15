import { useState } from "react";

import type { Alert } from "../../shared/api/client";

interface LiveAlertPanelProps {
  alerts: Alert[];
  error: string | null;
  onResolve: (alertId: string) => Promise<void>;
}

/** created_at is UTC; show it in the viewer's local time, e.g. "12:41:07 AM". */
function localTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function AlertCard({
  alert,
  onResolve,
}: {
  alert: Alert;
  onResolve: LiveAlertPanelProps["onResolve"];
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
    <article className="dash-alert" aria-live="assertive">
      <header className="dash-alert__head">
        <h2 className="dash-panel__title">Live alert</h2>
        <span className="dash-alert__when">
          {localTime(alert.created_at)}
          {alert.location_label && `, ${alert.location_label}`}
        </span>
      </header>
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
      <p className="dash-alert__notified">
        Pod notified: {alert.pod_notified}. Contacts notified: {alert.contacts_notified}.
      </p>
      <button className="dash-alert__resolve" onClick={resolve} disabled={busy}>
        {busy ? "Resolving…" : "Mark resolved"}
      </button>
      {failed && (
        <p className="dash-alert__error" role="alert">
          Couldn't resolve: {failed}
        </p>
      )}
    </article>
  );
}

export function LiveAlertPanel({ alerts, error, onResolve }: LiveAlertPanelProps) {
  if (alerts.length === 0) {
    return (
      <section className="dash-panel dash-alert--calm">
        <h2 className="dash-panel__title">Live alert</h2>
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
        <AlertCard key={a.id} alert={a} onResolve={onResolve} />
      ))}
    </div>
  );
}
