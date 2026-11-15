import { useEffect } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { resolveAlert } from "../api";
import DpsButton from "../components/DpsButton";
import EmergencyDetails, { EmergencyHeader } from "../components/EmergencyDetails";
import SimulatedLabel from "../components/SimulatedLabel";
import { useAsyncAction } from "../hooks/useAsyncAction";
import type { MobileNavigationState } from "../types";
import "../mobile.css";

export default function AlertSent() {
  const navigate = useNavigate();
  const state = (useLocation().state ?? {}) as MobileNavigationState;
  const alert = state.alert;
  const { busy, error, run } = useAsyncAction<"resolve">();
  useEffect(() => { window.scrollTo(0, 0); }, []);
  if (!alert) return <Navigate to={state.walk && state.plan ? "/walk" : "/"} replace state={state} />;
  async function finish() {
    if (!alert) return;
    const resolved = await run("resolve", async (signal) => {
      const response = await resolveAlert(alert.id, signal);
      if (response.status !== "resolved") throw new Error("The server did not confirm resolution.");
      return response;
    });
    if (resolved) navigate(state.walk && state.plan ? "/walk" : "/", { replace: true, state: {
      ...state, alert: undefined, demoAlert: undefined, source: undefined,
      transcript: undefined, reasons: undefined, suppressTriggersUntil: undefined,
    } satisfies MobileNavigationState });
  }
  return <main className="tp-mobile emergency-page sent-page">
    <EmergencyHeader />
    <h1 className="emergency-banner">EMERGENCY: {alert.source === "voice" ? "Hands-free trigger detected" : "Manual help requested"}</h1>
    <div className="countdown-ring sent-ring">
      <div className="sent-badge" role="status"><span>DISTRESS ALERT SENT</span>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--tp-ok)" strokeWidth="3" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
      </div>
    </div>
    <EmergencyDetails transcript={alert.transcript ?? undefined} safePhrase={state.walk?.safe_phrase}
      location={alert.location} locationLabel={alert.location_label} locationState="alert"
      caption={alert.source === "voice" ? "Voice trigger captured" : "Help requested manually"} />
    <section className="sent-notifications" aria-label="Notification results"><dl>
      <div><dt>Walking pod</dt><dd>{alert.pod_notified} notified</dd></div>
      <div><dt>Emergency contacts</dt><dd>{alert.contacts_notified} notified</dd></div>
    </dl></section>
    <p className="emergency-status-pill">{alert.pod_notified > 0 ? "ALERT CONFIRMED: WALKING POD" : "ALERT CONFIRMED"}</p>
    <div className="emergency-actions">
      <DpsButton />
      {error && <p className="mobile-error" role="alert">{error}</p>}
      <button className="sent-end-button" type="button" onClick={() => void finish()} disabled={busy !== null}>
        {busy ? "Ending alert…" : "I'm safe now, end alert"}
      </button>
      <SimulatedLabel />
    </div>
  </main>;
}
