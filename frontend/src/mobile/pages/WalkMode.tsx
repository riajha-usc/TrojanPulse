import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import Map from "../../shared/components/Map";
import { endWalk } from "../api";
import DpsButton from "../components/DpsButton";
import HoldForHelpButton from "../components/HoldForHelpButton";
import SimulatedLabel from "../components/SimulatedLabel";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { useGeolocation } from "../hooks/useGeolocation";
import { useLocationSharing } from "../hooks/useLocationSharing";
import { useWalkAudio, type AudioResult } from "../hooks/useWalkAudio";
import type { MobileNavigationState, Walk, WalkPlan } from "../types";
import "../mobile.css";

export default function WalkMode() {
  const state = (useLocation().state ?? {}) as MobileNavigationState;
  if (!state.walk || !state.plan) return <Navigate to="/" replace />;
  return <ActiveWalk state={state} walk={state.walk} plan={state.plan} />;
}

function ActiveWalk({ state, walk, plan }: { state: MobileNavigationState; walk: Walk; plan: WalkPlan }) {
  const navigate = useNavigate();
  const { busy, error, run } = useAsyncAction<"end">();
  const ending = busy === "end";
  const leaving = useRef(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const geo = useGeolocation(!ending);
  const lastPosition = geo.position ?? geo.lastKnownPosition ?? state.position;
  const updatedAt = geo.updatedAt ?? state.positionUpdatedAt;
  const sharing = useLocationSharing(walk.id,
    geo.position && geo.updatedAt ? { position: geo.position, timestamp: geo.updatedAt } : null, !ending);

  useEffect(() => { window.scrollTo(0, 0); }, []);
  const openCountdown = useCallback((source: "voice" | "manual", transcript: string, reasons: string[]) => {
    if (ending || leaving.current) return;
    leaving.current = true;
    setVoiceEnabled(false);
    navigate("/alert", { state: {
      ...state, walk, plan, source, transcript, reasons, alert: undefined, demoAlert: undefined,
      position: lastPosition,
      positionUpdatedAt: updatedAt,
      positionSource: geo.position ? "gps" : "last-known",
      positionIsSimulated: false,
    } satisfies MobileNavigationState });
  }, [navigate, state, walk, plan, ending, lastPosition, updatedAt, geo.position]);

  const audio = useWalkAudio({
    walkId: walk.id, enabled: !ending && voiceEnabled,
    onTrigger: (result: AudioResult) =>
  openCountdown("voice", result.transcript, result.reasons ?? []),
  });

  async function handleEnd() {
    if (leaving.current) return;
    leaving.current = true;
    const result = await run("end", async (signal) => {
      const ended = await endWalk(walk.id, signal);
      if (ended.status !== "ended") throw new Error("The server did not confirm the walk ended.");
      return ended;
    });
    if (result) navigate("/", { replace: true });
    else leaving.current = false;
  }

  return <main className="tp-mobile walk-page">
    <header className="walk-header">
      <span className="mobile-wordmark">Trojan<span>Pulse</span></span>
      <button type="button" className="walk-end-button" onClick={() => void handleEnd()} disabled={ending}>
        {ending ? "Ending…" : "End walk"}
      </button>
    </header>
    {error && <p className="mobile-error" role="alert">{error}</p>}
    <section className="walk-banner" aria-label="Active walk">
      <div><p className="walk-eyebrow">Walk Mode on</p>
        <h1>{walk.route.minutes} min to {walk.destination_label}</h1></div>
      <span className="walk-route-label">{walk.route.kind === "safest" ? "Safest route" : "Fastest route"}</span>
    </section>
    <Map center={geo.position ?? lastPosition ?? plan.origin}
      routes={walk.route.path.length >= 2 ? [{ kind: walk.route.kind, path: walk.route.path, highlighted: true }] : []}
      start={plan.origin} destination={{ ...plan.destination.location, label: walk.destination_label }}
      position={geo.position ?? undefined} hazards={plan.routes.hazards} height={290} />
    {walk.route.path.length < 2 && <p className="mobile-error">Route geometry is unavailable.</p>}
    <section className="walk-info-card" aria-live="polite">
      <div className="walk-info-text">
        <h2>{audio.status === "listening" && !audio.uploadFailing
          ? "Listening for “" + walk.safe_phrase + "”" : "Safe phrase: “" + walk.safe_phrase + "”"}</h2>
        <p>{audio.uploadFailing ? "Audio could not be assessed. Use Hold for help." :
          audio.status === "listening" ? "Microphone on only during this walk." :
          audio.status === "requesting" ? "Allow microphone access to start listening." :
          audio.error || "Microphone is off."}</p>
        {(audio.status === "error" || audio.status === "denied") &&
          <button className="mobile-retry-button" type="button" onClick={audio.restart}>Restart listening</button>}
      </div>
    </section>
    {geo.status !== "live" && <p className="mobile-feedback" role="status">
      {geo.error ?? "Waiting for a fresh GPS fix."} {lastPosition ? "The previous location is shown as last-known." : ""}
    </p>}
    <section className="walk-info-card">
      <div className="walk-pod-avatars" aria-hidden="true">
        {plan.pod?.members.slice(0, 2).map((member) => <span className="pod-avatar" key={member.user_id}>{member.initials}</span>)}
      </div>
      <div className="walk-info-text">
        <h2>{plan.pod ? "Pod: " + plan.pod.members.map((member) => member.display_name).join(", ") : "Walking solo"}</h2>
        <p>{sharing === "connected" && geo.status === "live" ? "Live location updates connected." :
          sharing === "connecting" ? "Connecting location sharing…" : "Live location sharing is unavailable."}</p>
      </div>
    </section>
    <div className="walk-actions">
      <HoldForHelpButton onTrigger={() => openCountdown("manual", "", ["Manual help requested"])} />
      <DpsButton /><SimulatedLabel />
    </div>
  </main>;
}
