import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Map from "../../shared/components/Map";
import {
  ApiFailure,
  getToken,
  login,
  logout,
  getPods,
  getRoutes,
  joinPod,
  reportHazard,
  startWalk,
} from "../api";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import DestinationSearch, { DESTINATIONS } from "../components/DestinationSearch";
import PodCard from "../components/PodCard";
import ReportButtons, { type HazardType } from "../components/ReportButtons";
import RouteToggle from "../components/RouteToggle";
import StartWalkButton from "../components/StartWalkButton";
import SimulatedLabel from "../components/SimulatedLabel";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { DEMO_START, isDemoPosition } from "../hooks/campusLocation";
import { getCurrentFix, type GeoFix } from "../hooks/useGeolocation";
import type { MobileNavigationState, RouteKind, Schema } from "../types";
import "../mobile.css";

type Action = "login" | "join" | "report" | "start";
export default function StartWalk() {
  const navigate = useNavigate();
  const { busy, error, run } = useAsyncAction<Action>();
  const [signedIn, setSignedIn] = useState(() => Boolean(getToken()));
  const [email, setEmail] = useState("");
  const [destination, setDestination] = useState(DESTINATIONS[0].label);
  const [routeKind, setRouteKind] = useState<RouteKind>("safest");
  const [routes, setRoutes] = useState<Schema["RoutesResponse"] | null>(null);
  const [originFix, setOriginFix] = useState<GeoFix | null>(null);
  const [pods, setPods] = useState<Schema["Pod"][]>([]);
  const [pod, setPod] = useState<Schema["Pod"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [retry, setRetry] = useState(0);
  const selected = DESTINATIONS.find(
    (item) => item.label.toLowerCase() === destination.trim().toLowerCase(),
  );

  useEffect(() => {
    const controller = new AbortController();
    setRoutes(null);
    setPods([]);
    setPod(null);
    setOriginFix(null);
    setLoadError("");
    if (!signedIn || !selected) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void (async () => {
      try {
        const fix = await getCurrentFix(controller.signal);
        const [routeResponse, podResponse] = await Promise.all([
          getRoutes(fix.position, selected.location, controller.signal),
          getPods(selected.location, undefined, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setOriginFix(fix);
        setRoutes(routeResponse);
        setPods(podResponse.pods);
      } catch (caught: unknown) {
        if (controller.signal.aborted) return;
        if (caught instanceof ApiFailure && caught.status === 401) {
          logout();
          setSignedIn(false);
        }
        setLoadError(caught instanceof Error ? caught.message : "Could not load your walk.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [signedIn, selected, retry]);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    const result = await run("login", (signal) => login(email.trim().toLowerCase(), signal));
    if (result) setSignedIn(true);
  }
  async function handleReport(type: HazardType) {
    const hazard = await run("report", async (signal) => {
      const fix = await getCurrentFix(signal);
      return reportHazard({ type, location: fix.position }, signal);
    });
    if (!hazard) return;
    setRoutes((current) =>
      current
        ? {
            ...current,
            hazards: [...current.hazards.filter((item) => item.id !== hazard.id), hazard],
          }
        : null,
    );
    setFeedback("Hazard report submitted.");
  }
  async function handleJoin(id: string) {
    const joined = await run("join", (signal) => joinPod(id, signal));
    if (!joined) return;
    setPod(joined);
    setPods((current) => current.map((item) => (item.id === joined.id ? joined : item)));
    setFeedback("Joined walking pod.");
  }
  async function handleStart() {
    if (!selected || !routes) return;
    const result = await run("start", async (signal) => {
      const fix = await getCurrentFix(signal);
      const walk = await startWalk(
        {
          origin: fix.position,
          destination: selected.location,
          destination_label: selected.label,
          route_kind: routeKind,
          pod_id: pod?.id ?? null,
        },
        signal,
      );
      return { walk, fix };
    });
    if (!result) return;
    const state: MobileNavigationState = {
      walk: result.walk,
      plan: { origin: result.fix.position, destination: selected, routes, pod },
      position: result.fix.position,
      positionUpdatedAt: result.fix.timestamp,
      positionSource: "gps",
      positionIsSimulated: false,
    };
    navigate("/walk", { state });
  }

  return (
    <main className="tp-mobile">
      <AppHeader />

      {!signedIn ? (
        <form className="mobile-login" onSubmit={(event) => void handleLogin(event)}>
          <h1>Walk with your Trojan community</h1>

          <label htmlFor="usc-email">USC email</label>

          <input
            id="usc-email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@usc.edu"
            value={email}
            disabled={busy !== null}
            onChange={(event) => setEmail(event.target.value)}
          />

          <button className="start-walk-button" type="submit" disabled={busy !== null}>
            {busy === "login" ? "Signing in…" : "Continue"}
          </button>

          <p className="mobile-feedback">
            The demo checks your USC email format; it is not USC single sign-on.
          </p>
        </form>
      ) : (
        <fieldset
          className="home-controls"
          disabled={busy !== null}
          aria-busy={loading || busy !== null}
        >
          <legend className="mobile-sr-only">Plan your walk</legend>

          <DestinationSearch
            value={destination}
            onChange={(value) => {
              setDestination(value);
              setFeedback("");
            }}
          />

          {loading && (
            <p className="mobile-feedback" role="status">
              Getting your location and finding routes…
            </p>
          )}

          {loadError && (
            <div>
              <p className="mobile-error" role="alert">
                {loadError}
              </p>

              <button
                className="mobile-retry-button"
                type="button"
                onClick={() => setRetry((value) => value + 1)}
              >
                Try again
              </button>
            </div>
          )}

          {!selected && (
            <p className="mobile-feedback">Choose a destination from the suggestions.</p>
          )}

          {routes && selected && (
            <>
              {isDemoPosition(originFix?.position) && (
                <p className="mobile-feedback" role="note">
                  Demo start: {DEMO_START.label}. Your location is unavailable or off campus.
                </p>
              )}

              <RouteToggle
                value={routeKind}
                onChange={setRouteKind}
                safestMinutes={routes.safest.minutes}
                fastestMinutes={routes.fastest.minutes}
              />

              <Map
                center={{
                  lat: (routes.origin.lat + routes.destination.lat) / 2,
                  lng: (routes.origin.lng + routes.destination.lng) / 2,
                }}
                routes={[routes.safest, routes.fastest]
                  .filter((route) => route.path.length >= 2)
                  .map((route) => ({
                    kind: route.kind,
                    path: route.path,
                    highlighted: route.kind === routeKind,
                  }))}
                hazards={routes.hazards}
                start={routes.origin}
                destination={{
                  ...routes.destination,
                  label: selected.label,
                }}
                height={290}
                zoom={15}
              />

              {routes[routeKind].path.length < 2 && (
                <p className="mobile-error">
                  This route has no map geometry. Refresh or choose another route.
                </p>
              )}

              <ReportButtons onReport={(type) => void handleReport(type)} />

              <section className="mobile-pod-matches" aria-labelledby="walking-pod-heading">
                <div className="mobile-pod-heading">
                  <h2 id="walking-pod-heading">Walking Pod matches</h2>

                  <span className="mobile-pod-count">{pods.length} available</span>
                </div>

                {pods.length > 0 ? (
                  <ul className="mobile-pod-list">
                    {pods.map((item) => (
                      <li key={item.id}>
                        <PodCard
                          pod={item}
                          joined={pod?.id === item.id}
                          onJoin={() => void handleJoin(item.id)}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mobile-feedback">No matching pods right now. You can walk solo.</p>
                )}
              </section>
            </>
          )}

          <StartWalkButton
            onClick={() => void handleStart()}
            loading={busy === "start"}
            disabled={
              loading || !routes || !originFix || !selected || routes[routeKind].path.length < 2
            }
          />

          <p className="mobile-feedback" role="status">
            {busy ? "Working…" : feedback}
          </p>
        </fieldset>
      )}

      {error && (
        <p className="mobile-error" role="alert">
          {error}
        </p>
      )}

      <div className="mobile-home-footer">
        <BottomNav />
        <SimulatedLabel />
      </div>
    </main>
  );
}
