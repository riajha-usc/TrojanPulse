export type HazardType = "light_out" | "blocked_path" | "other";

type Props = {
  onReport: (type: HazardType) => void;
};

const REPORTS: { type: HazardType; label: string }[] = [
  { type: "light_out", label: "Light out" },
  { type: "blocked_path", label: "Blocked path" },
  { type: "other", label: "Other" },
];

export default function ReportButtons({ onReport }: Props) {
  return (
    <div className="report-controls" role="group" aria-label="Report a hazard at your location">
      <span className="report-controls-label">One-tap report</span>

      {REPORTS.map((report) => (
        <button
          key={report.type}
          type="button"
          className="report-button"
          onClick={() => onReport(report.type)}
        >
          {report.label}
        </button>
      ))}
    </div>
  );
}
