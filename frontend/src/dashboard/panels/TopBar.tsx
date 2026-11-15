import type { WsStatus } from "../../shared/hooks/useWebSocket";

const STATUS_TEXT: Record<WsStatus, string> = {
  open: "Live",
  connecting: "Connecting",
  closed: "Offline, reconnecting",
};

interface TopBarProps {
  simulated: boolean;
  liveStatus: WsStatus;
  onExport: () => void;
}

export function TopBar({ simulated, liveStatus, onExport }: TopBarProps) {
  return (
    <div className="dash-topbar">
      <span className="dash-crumb">
        Dashboard / <b>Campus Pulse</b>
      </span>
      <span className={`dash-live dash-live--${liveStatus}`} role="status">
        <i aria-hidden="true" />
        {STATUS_TEXT[liveStatus]}
      </span>
      <span className="dash-topbar__spacer" />
      {simulated && <span className="dash-badge">Simulated data</span>}
      <button className="dash-btn" onClick={onExport}>
        Export summary
      </button>
    </div>
  );
}
