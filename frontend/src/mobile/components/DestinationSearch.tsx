import { useId } from "react";

export const DESTINATIONS = [
  {
    label: "Ellendale Pl & 28th St",
    location: { lat: 34.0297, lng: -118.2915 },
  },
  {
    label: "USC Village",
    location: { lat: 34.0259, lng: -118.2851 },
  },
  {
    label: "Leavey Library",
    location: { lat: 34.0217, lng: -118.2828 },
  },
];

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export default function DestinationSearch({ value, onChange }: Props) {
  const inputId = useId();
  const listId = useId();

  return (
    <div className="destination-search">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4 4" />
      </svg>

      <label className="mobile-sr-only" htmlFor={inputId}>
        Where are you walking?
      </label>

      <input
        id={inputId}
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Where are you walking?"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="done"
      />

      <datalist id={listId}>
        {DESTINATIONS.map((destination) => (
          <option key={destination.label} value={destination.label} />
        ))}
      </datalist>
    </div>
  );
}