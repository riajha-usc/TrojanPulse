// Left navigation. Each link jumps to a section of this page.

const LINKS = [
  { href: "#overview", label: "Campus Pulse", icon: "▦" },
  { href: "#alerts", label: "Alerts", icon: "⚠" },
  { href: "#transit", label: "Transit", icon: "⇄" },
  { href: "#safety", label: "Safety reports", icon: "◎" },
  { href: "#pods", label: "Walking pods", icon: "⚇" },
];

export function Sidebar({ openAlerts }: { openAlerts: number }) {
  return (
    <aside className="dash-sidebar">
      <div className="dash-brand">
        <span className="dash-wordmark">
          Trojan<span>Pulse</span>
        </span>
        <small>USG &amp; GSG Campus Pulse</small>
      </div>
      <nav aria-label="Dashboard sections">
        <p className="dash-nav__label">Overview</p>
        {LINKS.map((l, i) => (
          <a key={l.href} href={l.href} className={`dash-nav__link${i === 0 ? " is-active" : ""}`}>
            <span className="dash-nav__icon" aria-hidden="true">
              {l.icon}
            </span>
            {l.label}
            {l.href === "#alerts" && openAlerts > 0 && (
              <span className="dash-nav__count" aria-label={`${openAlerts} open`}>
                {openAlerts}
              </span>
            )}
          </a>
        ))}
      </nav>
      <div className="dash-sidebar__note">
        <b>All data is simulated</b>
        Built for the AI@USC hackathon. Pipelines are real.
      </div>
    </aside>
  );
}
