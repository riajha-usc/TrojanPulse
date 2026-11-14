// Screen 4: distress alert sent. Owner: Sharyu.
// Wireframe features: sent confirmation, transcript, locked GPS and mini map,
// who was notified, DPS shortcut, I'm safe now (end alert).
// API: POST /alerts/{id}/resolve

import { Link } from "react-router-dom";

export default function AlertSent() {
  return (
    <main className="tp-placeholder">
      <h1>Distress alert sent</h1>
      <p>TODO(Sharyu): build this screen from the wireframe.</p>
      <Link to="/">Back to start</Link>
    </main>
  );
}
