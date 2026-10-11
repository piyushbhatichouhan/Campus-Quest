import "./TeamNotification.css";

function TeamNotification({ notifications = [], onDismiss }) {
  if (!notifications.length) return null;

  return (
    <div className="team-notification-container" aria-live="polite">
      {notifications.map((n) => {
        let typeClass = "claim";
        let icon = "🚩";

        if (n.type === "challenge_completed") {
          typeClass = "challenge";
          icon = "⚡";
        } else if (n.type === "checkpoint_unlocked") {
          typeClass = "unlock";
          icon = "🗝️";
        } else if (n.type === "adventure_completed") {
          typeClass = "complete";
          icon = "👑";
        } else if (n.type === "event_started") {
          typeClass = "event-start";
          icon = "🚀";
        } else if (n.type === "event_stopped") {
          typeClass = "event-stop";
          icon = "🛑";
        }

        return (
          <div
            key={n.id}
            className={`team-notification-toast ${typeClass}`}
            onClick={() => onDismiss && onDismiss(n.id)}
            role="alert"
          >
            <span className="team-toast-icon">{icon}</span>
            <div className="team-toast-body">
              <div>{n.message}</div>
              {n.points && (
                <div className="team-toast-xp">+{n.points} XP EARNED!</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default TeamNotification;
