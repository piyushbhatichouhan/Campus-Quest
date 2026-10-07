import { MapPin, X, Sparkles, CheckCircle2, LockKeyhole } from "lucide-react";
import "./QuestCard.css";
function QuestCard({
  checkpoint,
  availableCheckpoint,
  onClaim,
  onComplete,
  onClose,
  onSelectCheckpoint,
}) {
  /*
   * If a checkpoint is selected, show that quest.
   *
   * Otherwise, if there is an available checkpoint,
   * show a discovery card for it.
   *
   * Otherwise show the exploration state.
   */

  if (checkpoint) {
    return (
      <div className="quest-card">
        <div className="quest-card-header">
          <div className="quest-card-type">
            {checkpoint.status === "COMPLETED"
              ? "QUEST COMPLETE"
              : checkpoint.status === "CLAIMED"
                ? "ACTIVE QUEST"
                : "QUEST AVAILABLE"}
          </div>

          <button
            className="quest-card-close"
            onClick={onClose}
            aria-label="Close quest"
          >
            <X size={17} />
          </button>
        </div>

        <div className="quest-card-title-row">
          <div className="quest-card-icon">
            {checkpoint.status === "COMPLETED" ? (
              <CheckCircle2 size={22} />
            ) : (
              <MapPin size={22} />
            )}
          </div>

          <div>
            <h2>{checkpoint.name}</h2>

            {checkpoint.distance !== null && (
              <div className="quest-card-distance">
                {checkpoint.distance.toFixed(1)}m away
              </div>
            )}
          </div>
        </div>

        {checkpoint.status === "AVAILABLE" && (
          <>
            <div className="quest-card-message">
              <Sparkles size={16} />

              <p>
                You have entered the checkpoint zone. Claim this location to
                discover your quest.
              </p>
            </div>

            <QuestReward points={checkpoint.points} />

            <button
              className="quest-card-action"
              onClick={() => onClaim(checkpoint.id)}
            >
              CLAIM QUEST
            </button>
          </>
        )}

        {checkpoint.status === "CLAIMED" && (
          <>
            <div className="quest-clue-box">
              <div className="quest-clue-label">YOUR CLUE</div>

              <div className="quest-clue">"{checkpoint.clue}"</div>
            </div>

            <QuestReward points={checkpoint.points} />

            <button
              className="quest-card-action"
              onClick={() => onComplete(checkpoint.id)}
            >
              SOLVE QUEST
            </button>
          </>
        )}

        {checkpoint.status === "COMPLETED" && (
          <>
            <div className="quest-completed-box">
              <CheckCircle2 size={20} />

              <div>
                <strong>QUEST COMPLETED</strong>

                <span>Location successfully discovered.</span>
              </div>
            </div>

            <QuestReward points={checkpoint.points} />
          </>
        )}
      </div>
    );
  }

  if (availableCheckpoint) {
    return (
      <div className="quest-card quest-card-discovery">
        <div className="quest-card-header">
          <div className="quest-card-type">NEW QUEST NEARBY</div>

          <Sparkles size={18} className="quest-discovery-icon" />
        </div>

        <div className="quest-card-title-row">
          <div className="quest-card-icon available">
            <MapPin size={22} />
          </div>

          <div>
            <h2>{availableCheckpoint.name}</h2>

            <div className="quest-card-distance">Checkpoint discovered</div>
          </div>
        </div>

        <p className="quest-discovery-text">
          You've entered a quest zone. Open the checkpoint to discover what
          awaits you.
        </p>

        <button
          className="quest-card-action"
          onClick={() => onSelectCheckpoint(availableCheckpoint.id)}
        >
          VIEW QUEST
        </button>
      </div>
    );
  }

  return (
    <div className="quest-card quest-card-empty">
      <div className="quest-card-header">
        <div className="quest-card-type">CURRENT OBJECTIVE</div>

        <LockKeyhole size={17} />
      </div>

      <div className="quest-empty-content">
        <div className="quest-empty-icon">
          <MapPin size={25} />
        </div>

        <div>
          <h2>EXPLORE THE CAMPUS</h2>

          <p>
            Move around campus and enter a marked checkpoint zone to discover
            your next quest.
          </p>
        </div>
      </div>
    </div>
  );
}

function QuestReward({ points }) {
  return (
    <div className="quest-reward-row">
      <span>REWARD</span>

      <strong>+{points} XP</strong>
    </div>
  );
}

export default QuestCard;
