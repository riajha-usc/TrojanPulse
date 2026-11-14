// Screen 3: trigger detected, cancel countdown. Owner: Sharyu.
// Wireframe features: 10 second countdown, live transcript, why it fired,
// locked GPS and mini map, I'm safe (cancel), Send now, DPS shortcut.
// The countdown lives in the browser. Call POST /alerts only when it expires
// or the student taps Send now.

import { Link } from "react-router-dom";

export default function AlertCountdown() {
  return (
    <main className="tp-placeholder">
      <h1>Trigger detected</h1>
      <p>TODO(Sharyu): build this screen from the wireframe.</p>
      <Link to="/alert/sent">Go to alert sent</Link>
    </main>
  );
}
