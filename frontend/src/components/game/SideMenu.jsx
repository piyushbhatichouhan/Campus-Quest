import {
  X,
  User,
  Map,
  ScrollText,
  Backpack,
  Trophy,
  Settings,
  LogOut,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import "./SideMenu.css";

function SideMenu({ isOpen, onClose }) {
  const navigate = useNavigate();

  function goTo(path) {
    onClose();
    navigate(path);
  }

  return (
    <>
      <div
        className={`side-menu-overlay ${isOpen ? "open" : ""}`}
        onClick={onClose}
      />

      <aside className={`side-menu ${isOpen ? "open" : ""}`}>
        <div className="side-menu-header">
          <div>
            <div className="side-menu-title">DAVV QUEST</div>

            <div className="side-menu-subtitle">ADVENTURER MENU</div>
          </div>

          <button
            className="side-menu-close"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="side-menu-content">
          <div className="side-menu-section-label">ADVENTURE</div>

          <button className="side-menu-item" onClick={() => goTo("/game")}>
            <Map size={19} />

            <span>Map</span>
          </button>

          <button className="side-menu-item">
            <ScrollText size={19} />

            <span>Quests</span>

            <span className="side-menu-badge">LIVE</span>
          </button>

          <button className="side-menu-item">
            <Backpack size={19} />

            <span>Inventory</span>
          </button>

          <button
            className="side-menu-item"
            onClick={() => goTo("/leaderboard")}
          >
            <Trophy size={19} />

            <span>Leaderboard</span>
          </button>

          <div className="side-menu-divider" />

          <div className="side-menu-section-label">PLAYER</div>

          <button className="side-menu-item" onClick={() => goTo("/profile")}>
            <User size={19} />

            <span>Profile</span>
          </button>

          <button className="side-menu-item">
            <Settings size={19} />

            <span>Settings</span>
          </button>
        </div>

        <div className="side-menu-footer">
          <button className="side-menu-logout">
            <LogOut size={18} />

            <span>LOG OUT</span>
          </button>

          <div className="side-menu-version">DAVV QUEST • v0.1</div>
        </div>
      </aside>
    </>
  );
}

export default SideMenu;
