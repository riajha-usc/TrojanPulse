import { useEffect, useRef, useState } from "react";

type Props = {
  onTrigger: () => void;
};

export default function HoldForHelpButton({ onTrigger }: Props) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holding, setHolding] = useState(false);

  function cancelHold() {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }

    setHolding(false);
  }

  useEffect(() => {
    return () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  return (
    <button
      type="button"
      className="hold-help-button"
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return;

        cancelHold();
        event.currentTarget.setPointerCapture(event.pointerId);
        setHolding(true);

        timer.current = setTimeout(() => {
          timer.current = null;
          setHolding(false);
          onTrigger();
        }, 2000);
      }}
      onPointerUp={cancelHold}
      onPointerCancel={cancelHold}
      onPointerLeave={cancelHold}
      onLostPointerCapture={cancelHold}
      onBlur={cancelHold}
      onContextMenu={(event) => event.preventDefault()}
      onClick={(event) => {
        // Keyboard and assistive-technology activation.
        if (event.detail === 0) {
          cancelHold();
          onTrigger();
        }
      }}
      aria-label="Hold for two seconds for help, or activate using the keyboard"
    >
      {holding ? "Keep holding…" : "Hold for help"}
    </button>
  );
}
