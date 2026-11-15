import { useEffect, useState } from "react";
import { getHealth } from "../api";
type Mode = "checking" | "simulated" | "live" | "unavailable";
export default function SimulatedLabel() {
  const [mode, setMode] = useState<Mode>("checking");
  useEffect(() => {
    const controller = new AbortController();
    void getHealth(controller.signal).then(
      (health) => {
        if (!controller.signal.aborted) setMode(health.simulated_data ? "simulated" : "live");
      },
      () => {
        if (!controller.signal.aborted) setMode("unavailable");
      },
    );
    return () => controller.abort();
  }, []);
  if (mode === "live") return null;
  return (
    <p className="mobile-demo-label">
      {mode === "simulated"
        ? "Simulated data and notifications"
        : mode === "unavailable"
          ? "Backend data mode unavailable"
          : "Checking data mode…"}
    </p>
  );
}
