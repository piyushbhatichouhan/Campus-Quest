import "./QuestPanel.css";

function QuestPanel({ checkpoint, onClaim, onComplete, onClose }) {
  if (!checkpoint) {
    return (
      <div className="quest-panel quest-panel-empty">
        <div className="quest-panel-title">NO ACTIVE QUEST</div>

        <div className="quest-panel-message">
          Enter a checkpoint zone to discover a quest.
        </div>
      </div>
    );
  }

  return (
    <div className="quest-panel">
      {/* Header */}

      <div className="quest-panel-header">
        <div className="quest-panel-label">
          {checkpoint.status === "AVAILABLE"
            ? "QUEST AVAILABLE"
            : checkpoint.status === "CLAIMED"
              ? "QUEST ACTIVE"
              : "QUEST COMPLETE"}
        </div>

        <button
          className="quest-close-button"
          onClick={onClose}
          aria-label="Close quest"
        >
          ×
        </button>
      </div>

      {/* Checkpoint name */}

      <h2 className="quest-panel-title">{checkpoint.name}</h2>

      {/* Distance */}

      {checkpoint.distance !== null && (
        <div className="quest-distance">
          {checkpoint.distance.toFixed(1)}m away
        </div>
      )}

      {/* Quest content */}

      {checkpoint.status === "AVAILABLE" && (
        <>
          <div className="quest-panel-section">
            <div className="quest-section-label">DISCOVERY</div>

            <p>You have entered the checkpoint zone.</p>

            <p>Claim this checkpoint to reveal your quest.</p>
          </div>

          <button
            className="quest-action-button"
            onClick={() => onClaim(checkpoint.id)}
          >
            CLAIM QUEST
          </button>
        </>
      )}

      {checkpoint.status === "CLAIMED" && (
        <>
          <div className="quest-panel-section">
            <div className="quest-section-label">CLUE</div>

            <p className="quest-clue">"{checkpoint.clue}"</p>
          </div>

          <div className="quest-panel-section">
            <div className="quest-section-label">REWARD</div>

            <p>+{checkpoint.points} XP</p>
          </div>

          <button
            className="quest-action-button"
            onClick={() => onComplete(checkpoint.id)}
          >
            SOLVE QUEST
          </button>
        </>
      )}

      {checkpoint.status === "COMPLETED" && (
        <>
          <div className="quest-completed">✓ QUEST COMPLETED</div>

          <div className="quest-panel-section">
            <div className="quest-section-label">REWARD</div>

            <p className="quest-reward">+{checkpoint.points} XP</p>
          </div>
        </>
      )}
    </div>
  );
}

export default QuestPanel;
