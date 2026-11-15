import { useId } from "react";
import type { components } from "../../shared/api/schema";

type Props = {
  pod: components["schemas"]["Pod"];
  joined: boolean;
  onJoin: () => void;
};

export default function PodCard({ pod, joined, onJoin }: Props) {
  const headingId = useId();

  return (
    <section className="pod-card" aria-labelledby={headingId}>
      <div className="pod-card-heading">
        <h2 id={headingId}>Walking Pod matches</h2>
        <span className="pod-verification">USC walking pod</span>
      </div>

      <div className="pod-card-content">
        <div className="pod-avatar" aria-hidden="true">
          {pod.members[0]?.initials ?? "P"}
        </div>

        <div className="pod-card-details">
          <p className="pod-member-names">
            {pod.members.map((member) => member.display_name).join(", ")}
          </p>

          <p className="pod-meeting-details">
            Leave in {pod.leaves_in_min} min · {pod.meeting_point_label}
          </p>
        </div>

        <button
          type="button"
          className="pod-join-button"
          onClick={onJoin}
          disabled={joined}
        >
          {joined ? "Joined" : "Join Pod"}
        </button>
      </div>
    </section>
  );
}