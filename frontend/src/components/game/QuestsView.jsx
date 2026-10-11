import { Sparkles, Trophy, Lock } from "lucide-react";
import "./QuestsView.css";

function QuestsView({
  checkpoints = [],
  currentCheckpoint,
  currentClue = null,
  completedJourney = [],
  eventStatus = "active",
  onSelectCheckpoint,
  score = 0,
  gameCompleted = false,
  onSwitchToMap,
  onNavigateLeaderboard,
}) {
  const completedCount = checkpoints.filter(
    (c) => c.status === "COMPLETED",
  ).length;
  const totalCount = checkpoints.length || 10;
  const progressPercent = Math.round((completedCount / totalCount) * 100);
  const isEventEnded =
    eventStatus === "stopped" || eventStatus === "completed";
  const isMysteryUnrevealed = currentCheckpoint?.status === "REVEALED";

  const solvedCheckpoints =
    completedJourney.length > 0
      ? completedJourney
      : checkpoints.filter((c) => c.status === "COMPLETED");

  return (
    <div className="quests-view">
      <div className="quests-container">
        {/* Header Progress Card */}
        <section className="quests-header-card">
          <span className="quests-kicker">CAMPUS QUEST</span>
          <h2 className="quests-header-title">MYSTERY CLUES & PROGRESS</h2>

          <div className="quests-progress-bar-bg">
            <div
              className="quests-progress-bar-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="quests-progress-label">
            <span>
              {completedCount} / {totalCount} CHECKPOINTS COMPLETE
            </span>
            <span>{score} XP TOTAL</span>
          </div>
        </section>

        {/* Event Stopped / Completed Results Panel */}
        {isEventEnded ? (
          <section className="active-quest-panel">
            <div
              className="active-quest-tag"
              style={{ background: "#ef4444", color: "#fff" }}
            >
              <Lock size={13} />
              {eventStatus === "completed"
                ? "OFFICIAL RESULTS FINALIZED"
                : "EVENT STOPPED BY ADMINISTRATOR"}
            </div>
            <h3 className="active-quest-name">
              {eventStatus === "completed"
                ? "Competition Complete"
                : "Competition Ended"}
            </h3>
            <p
              style={{
                margin: "6px 0 14px",
                fontSize: "13px",
                color: "#bcb4a3",
                lineHeight: 1.5,
              }}
            >
              All checkpoint claims and challenge submissions are now locked.
              Your team finished with {completedCount}/{totalCount} checkpoints (
              {score} XP).
            </p>
            {onNavigateLeaderboard && (
              <button
                type="button"
                className="active-quest-action-btn"
                onClick={onNavigateLeaderboard}
              >
                VIEW RACE LEADERBOARD ▶
              </button>
            )}
          </section>
        ) : gameCompleted ? (
          <section className="active-quest-panel">
            <div className="active-quest-tag">
              <Trophy size={14} /> QUEST COMPLETE
            </div>
            <h3 className="active-quest-name">Campus Legend!</h3>
            <p
              style={{
                margin: "6px 0 14px",
                fontSize: "13px",
                color: "#6ee7a0",
              }}
            >
              You have discovered all campus checkpoints and conquered every
              challenge!
            </p>
            <button
              type="button"
              className="active-quest-action-btn"
              onClick={onNavigateLeaderboard || onSwitchToMap}
            >
              VIEW RACE STANDINGS ▶
            </button>
          </section>
        ) : currentCheckpoint ? (
          <section className="active-quest-panel">
            <div className="active-quest-tag">
              <Sparkles size={13} />
              {currentCheckpoint.status === "CHALLENGE"
                ? "CHALLENGE UNLOCKED"
                : currentCheckpoint.status === "DISCOVERED"
                  ? "CHECKPOINT DISCOVERED — READY TO CLAIM"
                  : `MYSTERY CLUE #${currentCheckpoint.order || completedCount + 1}`}
            </div>

            <h3 className="active-quest-name">
              {isMysteryUnrevealed
                ? `Mystery Checkpoint #${currentCheckpoint.order || completedCount + 1}`
                : currentCheckpoint.name}
            </h3>

            {!isMysteryUnrevealed && currentCheckpoint.distance != null && (
              <p
                style={{
                  margin: "0 0 10px",
                  fontSize: "12px",
                  color: "#f5c542",
                }}
              >
                📍 Inside geofence ({Math.round(currentCheckpoint.distance)}m)
              </p>
            )}

            {!isMysteryUnrevealed && currentCheckpoint.discoveryText && (
              <p
                style={{
                  margin: "4px 0 12px",
                  fontSize: "12px",
                  color: "#bcb4a3",
                }}
              >
                {currentCheckpoint.discoveryText}
              </p>
            )}

            {/* Show Mystery Clue while searching, or Challenge Question once claimed */}
            {currentCheckpoint.status === "CHALLENGE" &&
            currentCheckpoint.challenge?.question ? (
              <div className="active-quest-clue-box">
                <div className="active-quest-clue-title">ACTIVE CHALLENGE</div>
                <p className="active-quest-clue-text">
                  "{currentCheckpoint.challenge.question}"
                </p>
              </div>
            ) : (
              (currentClue || currentCheckpoint.clue) && (
                <div className="active-quest-clue-box">
                  <div className="active-quest-clue-title">MYSTERY CLUE</div>
                  <p className="active-quest-clue-text">
                    "{currentClue || currentCheckpoint.clue}"
                  </p>
                </div>
              )
            )}

            <button
              type="button"
              className="active-quest-action-btn"
              onClick={() => {
                if (
                  currentCheckpoint.status === "DISCOVERED" ||
                  currentCheckpoint.status === "CHALLENGE"
                ) {
                  onSelectCheckpoint(currentCheckpoint.id);
                } else {
                  onSwitchToMap();
                }
              }}
            >
              {currentCheckpoint.status === "CHALLENGE"
                ? "OPEN CHALLENGE NOW ▶"
                : currentCheckpoint.status === "DISCOVERED"
                  ? "CLAIM CHECKPOINT ▶"
                  : "EXPLORE ON MAP ▶"}
            </button>
          </section>
        ) : null}

        {/* Completed Journey Log (only shows solved checkpoints, never undiscovered ones) */}
        {solvedCheckpoints.length > 0 && (
          <>
            <h3 className="timeline-title">COMPLETED JOURNEY</h3>
            <div className="checkpoint-list">
              {solvedCheckpoints.map((cp, idx) => (
                <div
                  key={cp.id || idx}
                  className="checkpoint-item completed"
                  onClick={() => cp.id && onSelectCheckpoint(cp.id)}
                >
                  <div className="checkpoint-item-left">
                    <div className="checkpoint-number">✓</div>
                    <div className="checkpoint-info">
                      <h3>{cp.name}</h3>
                      <p>+{cp.points || 100} XP Earned</p>
                    </div>
                  </div>
                  <div className="checkpoint-badge completed">SOLVED</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default QuestsView;
