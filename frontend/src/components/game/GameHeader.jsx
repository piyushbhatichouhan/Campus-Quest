import { Menu, Trophy } from "lucide-react";
import "./GameHeader.css";

function GameHeader({
  score = 0,
  teamName,
  memberCount = 1,
  maxMembers = 4,
  onMenuOpen,
}) {
  const displayTitle = teamName || "CAMPUS QUEST";
  const displaySubtitle = `${memberCount}/${maxMembers} PLAYERS • ${score} XP`;

  return (
    <header className="game-header">
      <div className="game-header-brand">
        <div className="game-header-mark">CQ</div>

        <div className="game-header-text-block">
          <div className="game-header-title" title={displayTitle}>
            {displayTitle}
          </div>

          <div className="game-header-subtitle">
            {displaySubtitle}
          </div>
        </div>
      </div>

      <div className="game-header-actions">
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
