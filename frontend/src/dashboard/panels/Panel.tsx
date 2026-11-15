// Shared frame for every dashboard panel. Owner: Arin.

import type { ReactNode } from "react";

interface PanelProps {
  title: string;
  /** Small grey line under the title. */
  subtitle?: ReactNode;
  /** Small grey note on the right of the title row. */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Panel({ title, subtitle, aside, className = "", children }: PanelProps) {
  return (
    <section className={`dash-panel ${className}`}>
      <header className="dash-panel__head">
        <h2 className="dash-panel__title">{title}</h2>
        {aside && <span className="dash-panel__aside">{aside}</span>}
      </header>
      {subtitle && <p className="dash-panel__subtitle">{subtitle}</p>}
      {children}
    </section>
  );
}

/** What a panel shows while its data loads, or if loading failed. */
export function PanelStatus({ error }: { error: string | null }) {
  return error ? (
    <p className="dash-status dash-status--error" role="alert">
      Couldn't load this panel. Retrying. ({error})
    </p>
  ) : (
    <p className="dash-status" aria-busy="true">
      Loading…
    </p>
  );
}
