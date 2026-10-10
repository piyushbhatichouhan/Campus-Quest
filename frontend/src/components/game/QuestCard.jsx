import { useEffect, useState } from "react";
import { MapPin, LockKeyhole, CheckCircle2, Trophy, X } from "lucide-react";

import "./QuestCard.css";

function QuestCard({ checkpoint, onClaim, onSubmitChallenge, onClose }) {
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setAnswer("");
    setFeedback(null);
    setSubmitting(false);
  }, [checkpoint?.id]);

  if (!checkpoint) {
    return null;
  }

  const { status, name, distance, points, discoveryText, challenge, nextClue } =
    checkpoint;

  async function handleClaim() {
    if (submitting) return;

    setSubmitting(true);
    setFeedback(null);

    try {
      const success = await onClaim(checkpoint.id);

      if (!success) {
        setFeedback({
          type: "error",
          message: "You must be inside the checkpoint area to claim it.",
        });
        return;
      }

      setFeedback(null);
    } catch (error) {
      setFeedback({
        type: "error",
        message: error.message || "Could not claim checkpoint. Try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit() {
    if (!answer.trim()) {
      setFeedback({
        type: "error",
        message: "Enter an answer first.",
      });
      return;
    }

    if (submitting) return;

    setSubmitting(true);
    setFeedback(null);

    try {
      const result = await onSubmitChallenge(checkpoint.id, answer);

      if (!result.success) {
        setFeedback({
          type: "error",
          message: result.reason || "Incorrect answer. Try again.",
        });
        return;
      }

      setFeedback({
        type: "success",
        message: `Checkpoint complete! +${result.points} XP`,
      });

      setAnswer("");
    } catch (error) {
      setFeedback({
        type: "error",
        message: error.message || "Could not submit answer. Try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleOptionSelect(option) {
    if (submitting) return;
    setAnswer(option);
    setFeedback(null);
  }

  return (
    <section className="quest-card">
      <div className="quest-card-header">
        <div className="quest-card-type">
          <MapPin size={14} />
          <span>
            {status === "CHALLENGE"
              ? "CHALLENGE"
              : status === "DISCOVERED"
                ? "CHECKPOINT DISCOVERED"
                : status === "COMPLETED"
                  ? "COMPLETED"
                  : "CURRENT OBJECTIVE"}
          </span>
        </div>

        <button
          className="quest-card-close"
          onClick={onClose}
          aria-label="Close quest"
          type="button"
        >
          <X size={18} />
        </button>
      </div>

      <div className="quest-card-title-row">
        <div className="quest-card-icon">
          {status === "COMPLETED" ? (
            <CheckCircle2 size={24} />
          ) : (
            <MapPin size={24} />
          )}
        </div>

        <div>
          <h2 className="quest-card-title">{name}</h2>

          {distance != null && (
            <div className="quest-card-distance">
              {Math.round(distance)} m away
            </div>
          )}
        </div>
      </div>

      {status === "REVEALED" && (
        <div className="quest-card-discovery">
          <div className="quest-discovery-icon">
            <LockKeyhole size={20} />
          </div>

          <div className="quest-discovery-text">
            <strong>Find this checkpoint</strong>
            <span>
              Travel to the marked location and enter its discovery zone.
            </span>
          </div>
        </div>
      )}

      {status === "DISCOVERED" && (
        <>
          <div className="quest-card-message">{discoveryText}</div>

          <div className="quest-card-reward-row">
            <span>REWARD</span>
            <strong>
              <Trophy size={15} />+{points} XP
            </strong>
          </div>

          <button
            className="quest-card-action"
            onClick={handleClaim}
            disabled={submitting}
            type="button"
          >
            {submitting ? "CLAIMING..." : "CLAIM CHECKPOINT"}
          </button>
        </>
      )}

      {status === "CHALLENGE" && (
        <>
          <div className="quest-card-message">{discoveryText}</div>

          <div className="quest-clue-box">
            <div className="quest-clue-label">YOUR CHALLENGE</div>
            <div className="quest-clue">{challenge.question}</div>

            {challenge.type === "multiple-choice" && (
              <div className="quest-options">
                {challenge.options.map((option) => (
                  <button
                    key={option}
                    className={`quest-option ${
                      answer === option ? "selected" : ""
                    }`}
                    onClick={() => handleOptionSelect(option)}
                    disabled={submitting}
                    type="button"
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}

            {challenge.type === "riddle" && (
              <input
                className="quest-answer-input"
                type="text"
                value={answer}
                onChange={(event) => {
                  setAnswer(event.target.value);
                  setFeedback(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !submitting) {
                    handleSubmit();
                  }
                }}
                placeholder="Enter your answer..."
                autoComplete="off"
                disabled={submitting}
              />
            )}
          </div>

          <button
            className="quest-card-action"
            onClick={handleSubmit}
            disabled={submitting}
            type="button"
          >
            {submitting ? "CHECKING ANSWER..." : "SUBMIT ANSWER"}
          </button>
        </>
      )}

      {status === "COMPLETED" && (
        <>
          <div className="quest-completed-box">
            <CheckCircle2 size={22} />

            <div>
              <strong>Checkpoint Complete!</strong>
              <span>+{points} XP earned</span>
            </div>
          </div>

          {nextClue && (
            <div className="quest-clue-box">
              <div className="quest-clue-label">NEXT CLUE</div>
              <div className="quest-clue">{nextClue}</div>
            </div>
          )}
        </>
      )}

      {feedback && (
        <div
          className={`quest-feedback quest-feedback-${feedback.type}`}
          role="status"
          aria-live="polite"
        >
          {feedback.message}
        </div>
      )}
    </section>
  );
}

export default QuestCard;
