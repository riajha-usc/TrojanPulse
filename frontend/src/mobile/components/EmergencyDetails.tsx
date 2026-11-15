import Map from "../../shared/components/Map";
import type { LatLng } from "../types";

type Props = {
  transcript?: string;
  reasons?: string[];
  safePhrase?: string;
  location: LatLng;
  locationLabel?: string | null;
  locationState: "gps" | "last-known" | "alert";
  caption: string;
};
const escapePattern = (text: string) => text.replace(/[.*+?^\x24{}()|[\]\\]/g, "\\$&");

export function EmergencyHeader() {
  return (
    <header className="emergency-header">
      <span aria-hidden="true" />
      <span className="emergency-wordmark">TrojanPulse</span>
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--tp-alert)"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path d="M12 3 5 6v5c0 4.5 3 7.5 7 10 4-2.5 7-5.5 7-10V6l-7-3Z" />
      </svg>
    </header>
  );
}
export default function EmergencyDetails({
  transcript,
  reasons = [],
  safePhrase,
  location,
  locationLabel,
  locationState,
  caption,
}: Props) {
  const clean = transcript?.trim();
  const phrase = safePhrase?.trim();
  const parts = clean
    ? phrase
      ? clean.split(new RegExp("(" + escapePattern(phrase) + ")", "gi"))
      : [clean]
    : [];
  const label = locationLabel || location.lat.toFixed(5) + ", " + location.lng.toFixed(5);
  return (
    <>
      <div className="emergency-waveform" aria-hidden="true">
        <svg viewBox="0 0 320 36" fill="none">
          <path
            d="M0 18 9 10 18 26 27 5 36 30 45 14 54 23 63 8 72 29 81 3 90 32 99 12 108 23 117 10 126 28 135 7 144 30 153 12 162 24 171 5 180 31 189 11 198 25 207 8 216 29 225 4 234 31 243 12 252 25 261 9 270 29 279 12 288 23 297 14 306 20 320 18"
            stroke="var(--tp-alert)"
            strokeWidth="2"
          />
        </svg>
        <span>{caption}</span>
      </div>
      <div className="emergency-transcript">
        <p>
          {parts.length ? (
            <>
              “
              {parts.map((part, index) =>
                index % 2 === 1 ? <mark key={index}>{part}</mark> : <span key={index}>{part}</span>,
              )}
              ”
            </>
          ) : (
            "Manual help requested. No voice transcript."
          )}
        </p>
      </div>
      {reasons.length > 0 && (
        <ul className="emergency-reasons" aria-label="Trigger reasons">
          {reasons.map((reason, index) => (
            <li key={index}>{reason}</li>
          ))}
        </ul>
      )}
      <div className="emergency-location">
        <div className="emergency-location-tile">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--tp-alert)"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
          <span>
            {locationState === "gps"
              ? "LOCKED: LIVE"
              : locationState === "alert"
                ? "ALERT LOCATION"
                : "LAST KNOWN"}
          </span>
        </div>
        <div className="emergency-mini-map">
          <Map center={location} alertPins={[{ ...location }]} height={110} zoom={16} />
        </div>
      </div>
      <p className="sent-location-caption">{label}</p>
    </>
  );
}
