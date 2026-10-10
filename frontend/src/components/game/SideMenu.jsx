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
import { useAuth } from "../../context/AuthContext";
import "./SideMenu.css";

function SideMenu({ isOpen, onClose, onSelectTab }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  function handleTab(tab) {
    onClose();
    if (onSelectTab) {
      onSelectTab(tab);
    }
  }

  function goTo(path) {
    onClose();
    navigate(path);
  }

  async function handleLogout() {
    onClose();
    try {
      await logout();
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
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

            <div className="side-menu-subtitle">
              {user?.displayName ? `PLAYER: ${user.displayName.toUpperCase()}` : "ADVENTURER MENU"}
            </div>
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

          <button className="side-menu-item" onClick={() => handleTab("map")}>
            <Map size={19} />
            <span>Map</span>
          </button>

          <button className="side-menu-item" onClick={() => handleTab("quests")}>
            <ScrollText size={19} />
            <span>Quests</span>
            <span className="side-menu-badge">LIVE</span>
          </button>

          <button className="side-menu-item" onClick={() => handleTab("inventory")}>
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

          <button className="side-menu-item" onClick={() => goTo("/profile")}>
            <Settings size={19} />
            <span>Settings</span>
          </button>
        </div>

        <div className="side-menu-footer">
          <button className="side-menu-logout" onClick={handleLogout}>
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
