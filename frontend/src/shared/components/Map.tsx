// Shared map component. Owner: Arin. Used by the mobile screens and the dashboard.
// This is Arin's first task, because the mobile screens wait on it.
//
// Planned layers: routes, hazard pins, live position, heatmap.
// TODO(Arin): pick the map library, define the props, replace this placeholder.

export default function Map() {
  return (
    <div
      role="img"
      aria-label="Map placeholder"
      style={{
        height: 290,
        borderRadius: "var(--tp-radius)",
        background: "var(--tp-navy-raised)",
        display: "grid",
        placeItems: "center",
        color: "var(--tp-text-muted)",
      }}
    >
      Map placeholder
    </div>
  );
}
