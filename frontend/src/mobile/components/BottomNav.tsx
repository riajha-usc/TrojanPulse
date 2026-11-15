import { Link, useLocation } from "react-router-dom";

const ICONS = {
  home: "M3 10 12 3l9 7v11h-6v-7H9v7H3V10Z",
  explore: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM16 8l-3 5-5 3 3-5 5-3Z",
  emergency: "M2 12h5l3-8 4 16 3-8h5",
  alerts: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5",
};

function NavIcon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

export default function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className="mobile-bottom-nav" aria-label="Main navigation">
      <Link
        to="/"
        className="mobile-nav-item"
        aria-label="Home"
        aria-current={pathname === "/" ? "page" : undefined}
      >
        <NavIcon name="home" />
      </Link>

      <button type="button" className="mobile-nav-item" aria-label="Explore, coming soon" disabled>
        <NavIcon name="explore" />
      </button>

      <Link
        to="/alert"
        state={{ source: "manual" }}
        className="mobile-nav-item mobile-nav-emergency"
        aria-label="Emergency"
      >
        <NavIcon name="emergency" />
      </Link>

      <button type="button" className="mobile-nav-item" aria-label="Alerts, coming soon" disabled>
        <NavIcon name="alerts" />
      </button>

      <button type="button" className="mobile-nav-item" aria-label="Settings, coming soon" disabled>
        <NavIcon name="settings" />
      </button>
    </nav>
  );
}
