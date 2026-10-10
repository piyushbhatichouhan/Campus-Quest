import { Menu, Trophy } from "lucide-react";

import "./GameHeader.css";
function GameHeader({ score, onMenuOpen }) {
  return (
    <header className="game-header">
      <div className="game-header-brand">
        <div className="game-header-mark">DQ</div>

        <div>
          <div className="game-header-title">DAVV QUEST</div>

          <div className="game-header-subtitle">CAMPUS ADVENTURE</div>
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
