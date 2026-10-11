import { Map, ScrollText, Backpack, Trophy } from "lucide-react";
import "./GameBottomNav.css";

function GameBottomNav({ activeTab = "map", onTabChange }) {
  return (
    <nav className="game-bottom-nav">
      <button
        type="button"
        className={`game-nav-item ${activeTab === "map" ? "active" : ""}`}
        onClick={() => onTabChange("map")}
      >
        <Map size={20} />
        <span>MAP</span>
      </button>

      <button
        type="button"
        className={`game-nav-item ${activeTab === "quests" ? "active" : ""}`}
        onClick={() => onTabChange("quests")}
      >
        <ScrollText size={20} />
        <span>QUESTS</span>
      </button>

      <button
        type="button"
        className={`game-nav-item ${activeTab === "inventory" ? "active" : ""}`}
        onClick={() => onTabChange("inventory")}
      >
        <Backpack size={20} />
        <span>INVENTORY</span>
      </button>

      <button
        type="button"
        className={`game-nav-item ${activeTab === "rank" ? "active" : ""}`}
        onClick={() => onTabChange("rank")}
      >
        <Trophy size={20} />
        <span>RANK</span>
      </button>
    </nav>
  );
}

export default GameBottomNav;
