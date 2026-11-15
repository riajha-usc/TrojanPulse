export type RouteKind = "safest" | "fastest";

type Props = {
  value: RouteKind;
  onChange: (value: RouteKind) => void;
  safestMinutes: number;
  fastestMinutes: number;
};

export default function RouteToggle({
  value,
  onChange,
  safestMinutes,
  fastestMinutes,
}: Props) {
  return (
    <div
      className="route-toggle"
      role="group"
      aria-label="Choose your walking route"
    >
      <button
        type="button"
        className="route-toggle-button"
        aria-pressed={value === "safest"}
        onClick={() => onChange("safest")}
      >
        Safest route, {safestMinutes} min
      </button>

      <button
        type="button"
        className="route-toggle-button"
        aria-pressed={value === "fastest"}
        onClick={() => onChange("fastest")}
      >
        Fastest, {fastestMinutes} min
      </button>
    </div>
  );
}