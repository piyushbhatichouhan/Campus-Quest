import { Menu, Trophy, Clock } from "lucide-react";
import "./GameHeader.css";

function formatElapsed(totalSeconds = 0) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const pad = (n) => String(n).padStart(2, "0");
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

function GameHeader({
  score = 0,
  teamName,
  memberCount = 1,
  maxMembers = 4,
  elapsedSeconds = 0,
  eventStatus = "active",
  onMenuOpen,
}) {
  const displayTitle = teamName || "CAMPUS QUEST";
  const displaySubtitle = `${memberCount}/${maxMembers} PLAYERS • ${score} XP`;
  const isEventEnded =
    eventStatus === "stopped" || eventStatus === "completed";

  return (
    <header className="game-header">
      <div className="game-header-brand">
        <div className="game-header-mark">CQ</div>

        <div className="game-header-text-block">
          <div className="game-header-title" title={displayTitle}>
            {displayTitle}
          </div>

          <div className="game-header-subtitle">{displaySubtitle}</div>
        </div>
      </div>

      <div className="game-header-actions">
        <div
          className={`game-timer-display ${isEventEnded ? "ended" : "live"}`}
          title="Authoritative Event Timer (Read-Only)"
          aria-label="Official competition elapsed timer"
        >
          <Clock size={14} strokeWidth={2.5} />
          <span>{formatElapsed(elapsedSeconds)}</span>
          <small>
            {eventStatus === "completed"
              ? "FINAL"
              : eventStatus === "stopped"
                ? "FROZEN"
                : "TIMER"}
          </small>
        </div>

        <div className="game-xp-display">
          <Trophy size={16} strokeWidth={2.5} />
          <span>{score}</span>
          <small>XP</small>
        </div>

        <button
          className="game-menu-button"
          onClick={onMenuOpen}
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
      </div>
    </header>
  );
}

export default GameHeader;
