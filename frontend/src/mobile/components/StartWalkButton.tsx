type Props = {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export default function StartWalkButton({
  onClick,
  disabled = false,
  loading = false,
}: Props) {
  return (
    <button
      type="button"
      className="start-walk-button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading}
    >
      {loading ? "Starting walk…" : "Start walk"}
    </button>
  );
}