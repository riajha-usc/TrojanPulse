// Screen 2: Walk Mode. Owner: Sharyu.
// Wireframe features: live position with pod on the route, time remaining,
// safe phrase listening indicator, location sharing, Hold for help, DPS shortcut.
// The mic is on only while this screen's walk is active.
// API: POST /walks/{id}/audio, POST /walks/{id}/end, WebSocket location.update

import { Link } from "react-router-dom";

export default function WalkMode() {
  return (
    <main className="tp-placeholder">
      <h1>Walk Mode</h1>
      <p>TODO(Sharyu): build this screen from the wireframe.</p>
      <Link to="/alert">Go to trigger countdown</Link>
    </main>
  );
}
