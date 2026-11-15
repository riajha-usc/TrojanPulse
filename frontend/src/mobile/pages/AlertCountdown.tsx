import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ApiFailure, createAlert, getAlerts } from "../api";
import DpsButton from "../components/DpsButton";
import EmergencyDetails, { EmergencyHeader } from "../components/EmergencyDetails";
import SimulatedLabel from "../components/SimulatedLabel";
import { CONFIG } from "../config";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { useGeolocation } from "../hooks/useGeolocation";
import type { MobileNavigationState, LatLng, Walk } from "../types";
import "../mobile.css";

export default function AlertCountdown() {
  const state = (useLocation().state ?? {}) as MobileNavigationState;
  if (!state.walk || !state.position) return <main className="tp-mobile emergency-page">
    <EmergencyHeader /><h1 className="emergency-banner">No active walk with a location</h1>
    <p className="mobile-feedback">Start a walk to attach an in-app alert. You can call DPS directly.</p>
    <DpsButton /><Link className="dps-shortcut" to="/">Plan a walk</Link>
  </main>;
  return <Countdown state={state} walk={state.walk} initialPosition={state.position} />;
}
function Countdown({ state, walk, initialPosition }: {
  state: MobileNavigationState; walk: Walk; initialPosition: LatLng;
}) {
  const navigate = useNavigate();
  const geo = useGeolocation(true);
  const position = geo.position ?? geo.lastKnownPosition ?? initialPosition;
  const { busy, failure, error, run } = useAsyncAction<"send" | "check">();
  const [deadline] = useState(() => Date.now() + CONFIG.countdownSeconds * 1000);
  const [seconds, setSeconds] = useState(CONFIG.countdownSeconds as number);
  const [uncertain, setUncertain] = useState(false);
  const [notice, setNotice] = useState("");
  const attempted = useRef(false);
  const stopped = useRef(false);
  const source = state.source ?? "manual";
  const uncertainNow = uncertain || (failure instanceof ApiFailure && failure.outcomeUnknown);
  const sending = busy === "send";
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const submit = useCallback(async () => {
    if (attempted.current || stopped.current || uncertainNow) return;
    attempted.current = true;
    const alert = await run("send", (signal) => createAlert({
      walk_id: walk.id, source, location: position,
      location_label: geo.position ? null : "Last-known location",
      transcript: state.transcript?.trim() || null,
      reasons: state.reasons ?? (source === "manual" ? ["Manual help requested"] : []),
    }, signal));
    if (!alert || stopped.current) return;
    stopped.current = true;
    navigate("/alert/sent", { replace: true, state: {
      ...state, alert, demoAlert: undefined, position,
      positionUpdatedAt: geo.updatedAt ?? state.positionUpdatedAt,
      positionSource: geo.position ? "gps" : "last-known",
    } satisfies MobileNavigationState });
  }, [run, walk.id, source, position, geo.position, geo.updatedAt, state, navigate, uncertainNow]);

  useEffect(() => {
    const tick = () => {
      if (stopped.current || attempted.current) return;
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSeconds(remaining);
      if (remaining === 0) void submit();
    };
    const timer = setInterval(tick, 200);
    document.addEventListener("visibilitychange", tick);
    tick();
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [deadline, submit]);

  function cancel() {
    if (busy || stopped.current) return;
    stopped.current = true;
    navigate(state.plan ? "/walk" : "/", { replace: true, state: {
      ...state, alert: undefined, demoAlert: undefined, source: undefined,
      transcript: undefined, reasons: undefined, suppressTriggersUntil: undefined,
      position, positionUpdatedAt: geo.updatedAt ?? state.positionUpdatedAt,
      positionSource: geo.position ? "gps" : "last-known",
    } satisfies MobileNavigationState });
  }
  async function checkStatus() {
    setUncertain(true);
    const response = await run("check", (signal) => getAlerts(signal));
    if (!response) return;
    const alert = response.alerts.filter((item) => item.walk_id === walk.id && item.status === "open")
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
    if (alert) {
      stopped.current = true;
      navigate("/alert/sent", { replace: true, state: { ...state, alert } });
    } else setNotice("No matching alert has been confirmed yet. Check again or call DPS.");
  }

  return <main className="tp-mobile emergency-page">
    <EmergencyHeader />
    <h1 className="emergency-banner">EMERGENCY: {source === "voice" ? "Hands-free trigger detected" : "Manual help requested"}</h1>
    <div className="countdown-ring" role="timer" aria-label={sending ? "Sending alert" : error ? "Alert not confirmed" : seconds + " seconds to cancel"}>
      <span className="countdown-number">{sending ? "…" : error || uncertain ? "!" : seconds}</span>
      <span className="countdown-caption">{sending ? "Sending alert" : error || uncertain ? "Not confirmed" : "seconds to cancel"}</span>
    </div>
    <EmergencyDetails transcript={state.transcript} reasons={state.reasons}
      safePhrase={walk.safe_phrase} location={position} locationState={geo.position ? "gps" : "last-known"}
      caption={source === "voice" ? "Voice trigger captured" : "Help requested manually"} />
    <p className="emergency-status-pill" role="status">{sending ? "Sending alert…" : error || uncertain ?
      "Alert not confirmed" : "Alerting your pod and contacts in " + seconds + " s"}</p>
    {error && <p className="mobile-error" role="alert">{error}</p>}
    {notice && <p className="mobile-feedback" role="status">{notice}</p>}
    <div className="emergency-actions">
      <button className="emergency-cancel-button" type="button" onClick={cancel} disabled={busy !== null}>I'm safe, cancel</button>
      <div className="emergency-secondary-actions">
        <button className="emergency-send-button" type="button" disabled={busy !== null} onClick={() => {
          if (uncertainNow) { void checkStatus(); return; }
          if (failure) attempted.current = false;
          void submit();
        }}>{busy === "check" ? "Checking…" : sending ? "Sending…" : uncertainNow ? "Check alert status" : failure ? "Retry send" : "Send now"}</button>
        <DpsButton />
      </div><SimulatedLabel />
    </div>
  </main>;
}
