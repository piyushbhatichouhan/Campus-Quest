import { Sparkles, Trophy } from "lucide-react";
import "./QuestsView.css";

function QuestsView({
  checkpoints = [],
  currentCheckpoint,
  onSelectCheckpoint,
  score = 0,
  gameCompleted = false,
  onSwitchToMap,
}) {
  const completedCount = checkpoints.filter((c) => c.status === "COMPLETED").length;
  const totalCount = checkpoints.length || 5;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="quests-view">
      <div className="quests-container">
        {/* Header Progress Card */}
        <section className="quests-header-card">
          <span className="quests-kicker">DAVV CAMPUS QUEST</span>
          <h2 className="quests-header-title">OBJECTIVES & CLUES</h2>

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

        {/* Current Active Quest Panel */}
        {gameCompleted ? (
          <section className="active-quest-panel">
            <div className="active-quest-tag">
              <Trophy size={14} /> QUEST COMPLETE
            </div>
            <h3 className="active-quest-name">Campus Legend!</h3>
            <p style={{ margin: "6px 0 14px", fontSize: "13px", color: "#6ee7a0" }}>
              You have discovered all campus checkpoints and conquered every riddle.
            </p>
            <button
              type="button"
              className="active-quest-action-btn"
              onClick={onSwitchToMap}
            >
              EXPLORE CAMPUS MAP ▶
            </button>
          </section>
        ) : currentCheckpoint ? (
          <section className="active-quest-panel">
            <div className="active-quest-tag">
              <Sparkles size={13} />
              {currentCheckpoint.status === "CHALLENGE"
                ? "CHALLENGE UNLOCKED"
                : currentCheckpoint.status === "DISCOVERED"
                  ? "READY TO CLAIM"
                  : "CURRENT OBJECTIVE"}
            </div>

            <h3 className="active-quest-name">{currentCheckpoint.name}</h3>

            {currentCheckpoint.distance != null && (
              <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#f5c542" }}>
                📍 Approx. {Math.round(currentCheckpoint.distance)} meters away
              </p>
            )}

            {currentCheckpoint.discoveryText && (
              <p style={{ margin: "4px 0 12px", fontSize: "12px", color: "#bcb4a3" }}>
                {currentCheckpoint.discoveryText}
              </p>
            )}

            {currentCheckpoint.challenge?.question && (
              <div className="active-quest-clue-box">
                <div className="active-quest-clue-title">CLUE / RIDDLE</div>
                <p className="active-quest-clue-text">
                  "{currentCheckpoint.challenge.question}"
                </p>
              </div>
            )}

            <button
              type="button"
              className="active-quest-action-btn"
              onClick={() => {
                if (currentCheckpoint.status === "DISCOVERED" || currentCheckpoint.status === "CHALLENGE") {
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
                  : "TRACK ON MAP ▶"}
            </button>
          </section>
        ) : null}

        {/* Checkpoint Sequence List */}
        <h3 className="timeline-title">CHECKPOINT PROGRESSION</h3>

        <div className="checkpoint-list">
          {checkpoints.map((cp, idx) => {
            const isCompleted = cp.status === "COMPLETED";
            const isActive =
              !gameCompleted &&
              (cp.status === "DISCOVERED" ||
                cp.status === "CHALLENGE" ||
                cp.status === "REVEALED");

            return (
              <div
                key={cp.id}
                className={`checkpoint-item ${isCompleted ? "completed" : ""} ${isActive ? "active" : ""}`}
                onClick={() => {
                  if (isCompleted || isActive) {
                    onSelectCheckpoint(cp.id);
                  }
                }}
              >
                <div className="checkpoint-item-left">
                  <div className="checkpoint-number">
                    {isCompleted ? "✓" : `#${cp.order || idx + 1}`}
                  </div>
                  <div className="checkpoint-info">
                    <h3>{cp.name}</h3>
                    <p>
                      {isCompleted
                        ? `+${cp.points} XP Earned`
                        : isActive
                          ? `Reward: +${cp.points} XP`
                          : "Locked"}
                    </p>
                  </div>
                </div>

                <div
                  className={`checkpoint-badge ${
                    isCompleted ? "completed" : isActive ? "active" : ""
                  }`}
                >
                  {isCompleted
                    ? "SOLVED"
                    : isActive
                      ? cp.status === "CHALLENGE"
                        ? "CHALLENGE"
                        : cp.status === "DISCOVERED"
                          ? "DISCOVERED"
                          : "ACTIVE"
                      : "LOCKED"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default QuestsView;
