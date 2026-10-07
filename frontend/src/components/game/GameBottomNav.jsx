import { Map, ScrollText, Backpack, Trophy } from "lucide-react";

function GameBottomNav() {
  return (
    <nav className="game-bottom-nav">
      <button className="game-nav-item active">
        <Map size={20} />

        <span>MAP</span>
      </button>

      <button className="game-nav-item">
        <ScrollText size={20} />

        <span>QUESTS</span>
      </button>

      <button className="game-nav-item">
        <Backpack size={20} />

        <span>INVENTORY</span>
      </button>

      <button className="game-nav-item">
        <Trophy size={20} />

        <span>RANK</span>
      </button>
    </nav>
  );
}

export default GameBottomNav;
