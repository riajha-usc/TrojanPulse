// Screen 1: plan a walk and join a pod. Owner: Sharyu.
// Wireframe features: destination search, safest vs fastest route, hazard pin,
// one-tap reports, pod matches with Join Pod, Start walk, bottom navigation.
// API: GET /routes, GET /hazards, POST /hazards, GET /pods, POST /pods/{id}/join, POST /walks

import { Link } from "react-router-dom";

export default function StartWalk() {
  return (
    <main className="tp-placeholder">
      <h1>Plan a walk</h1>
      <p>TODO(Sharyu): build this screen from the wireframe.</p>
      <Link to="/walk">Go to Walk Mode</Link>
    </main>
  );
}
