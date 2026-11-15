import type { CorridorsResponse } from "../../shared/api/client";
import { Panel, PanelStatus } from "./Panel";

interface CorridorsPanelProps {
  data: CorridorsResponse | null;
  error: string | null;
}

export function CorridorsPanel({ data, error }: CorridorsPanelProps) {
  return (
    <Panel title="Busiest walking corridors" subtitle="Tonight, anonymized counts">
      {data ? (
        data.items.length === 0 ? (
          <p className="dash-status">No corridors yet tonight.</p>
        ) : (
          <table className="dash-table">
            <thead>
              <tr>
                <th scope="col">Route</th>
                <th scope="col">Walks</th>
              </tr>
            </thead>
            <tbody>
              {[...data.items]
                .sort((a, b) => b.walks - a.walks)
                .map((c) => (
                  <tr key={`${c.from_label}-${c.to_label}`}>
                    <th scope="row">
                      {c.from_label} → {c.to_label}
                    </th>
                    <td>{c.walks}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )
      ) : (
        <PanelStatus error={error} />
      )}
    </Panel>
  );
}
