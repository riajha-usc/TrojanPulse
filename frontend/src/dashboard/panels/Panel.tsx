// Shared frame for every dashboard card. Owner: Arin.

import type { ReactNode } from "react";

interface PanelProps {
  title: ReactNode;
  /** Small grey line under the title. */
  subtitle?: ReactNode;
  /** Controls on the right of the title row, such as tabs. */
  actions?: ReactNode;
  id?: string;
  className?: string;
  children: ReactNode;
}

export function Panel({ title, subtitle, actions, id, className = "", children }: PanelProps) {
  return (
    <section id={id} className={`dash-card ${className}`}>
      <header className="dash-card__head">
        <div>
          <h2 className="dash-card__title">{title}</h2>
          {subtitle && <p className="dash-card__subtitle">{subtitle}</p>}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}

/** What a card shows while its data loads, or if loading failed. */
export function PanelStatus({ error }: { error: string | null }) {
  return error ? (
    <p className="dash-status dash-status--error" role="alert">
      Couldn't load this. Retrying. ({error})
    </p>
  ) : (
    <p className="dash-status" aria-busy="true">
      Loading…
    </p>
  );
}

/** Segmented tabs, like the ones in the card headers. */
export function Tabs<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="dash-tabs" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          className="dash-tabs__tab"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
