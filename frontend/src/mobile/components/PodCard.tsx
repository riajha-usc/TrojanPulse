import { useId } from "react";
import type { components } from "../../shared/api/schema";

type Props = {
  pod: components["schemas"]["Pod"];
  joined: boolean;
  onJoin: () => void;
};

export default function PodCard({ pod, joined, onJoin }: Props) {
  const membersId = useId();
  const members = pod.members.map((member) => member.display_name).join(", ") || "Walking pod";

  return (
    <article className="pod-card" aria-labelledby={membersId}>
      <div className="pod-card-content">
        <div className="pod-avatar" aria-hidden="true">
          {pod.members[0]?.initials ?? "P"}
        </div>

        <div className="pod-card-details">
          <p className="pod-member-names" id={membersId}>
            {members}
          </p>

          <p className="pod-meeting-details">
            {pod.leaves_in_min > 0 ? `Leave in ${pod.leaves_in_min} min` : "Leaving now"} ·{" "}
            {pod.meeting_point_label}
          </p>
        </div>

        <button type="button" className="pod-join-button" onClick={onJoin} disabled={joined}>
          {joined ? "Joined" : "Join Pod"}
        </button>
      </div>
    </article>
  );
}
