import { getWaitTimes } from "../../shared/api/client";
import { useApi } from "../useApi";
import { Panel, PanelStatus } from "./Panel";

const REFRESH_MS = 60_000;

export function WaitTimesPanel() {
  const { data, error } = useApi(getWaitTimes, REFRESH_MS);

  return (
    <Panel title="Live wait times by pickup location">
      {data ? (
        <table className="dash-table">
          <thead>
            <tr>
              <th scope="col">Location</th>
              <th scope="col">Now</th>
              <th scope="col">In 30 min</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((w) => (
              <tr key={w.location_label}>
                <th scope="row">{w.location_label}</th>
                <td className="dash-table__now">{w.now_min} min</td>
                <td className="dash-table__later">{w.in_30_min} min</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <PanelStatus error={error} />
      )}
    </Panel>
  );
}
