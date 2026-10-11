import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { gameApi } from "../services/gameApi";
import "./Profile.css";

function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [gameState, setGameState] = useState(null);
  const [loadingState, setLoadingState] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadState() {
      try {
        const state = await gameApi.getGameState();
        if (isMounted) setGameState(state);
      } catch (err) {
        console.error("Failed to load profile state:", err);
      } finally {
        if (isMounted) setLoadingState(false);
      }
    }
    loadState();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate(user?.isAnonymous ? "/join" : "/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const displayName = user?.displayName || gameState?.displayName || "Explorer";
  const teamName = gameState?.teamName || "Campus Squad";
  const role = gameState?.role === "leader" ? "Leader" : "Member";
  const email =
    user?.email ||
    (user?.isAnonymous
      ? `Anonymous ${role} • ${teamName}`
      : `${role} • ${teamName}`);
  const avatarLetter = displayName.charAt(0).toUpperCase() || "P";
  const score = gameState?.score || 0;
  const completedCount = (gameState?.completedCheckpoints || []).length;
  const inventoryCount = (gameState?.inventory || []).length;
  const rank = gameState?.rank || 1;
  const level = Math.floor(score / 250) + 1;
  const nextLevelXP = level * 250;

  const achievements = [
    {
      id: 1,
      icon: "★",
      title: "First Steps",
      description: "Complete your first campus checkpoint.",
      unlocked: completedCount >= 1,
    },
    {
      id: 2,
      icon: "◆",
      title: "Campus Explorer",
      description: "Discover and solve at least 3 checkpoints.",
      unlocked: completedCount >= 3,
    },
    {
      id: 3,
      icon: "⚡",
      title: "Master Scholar",
      description: "Accumulate 400+ total XP.",
      unlocked: score >= 400,
    },
    {
      id: 4,
      icon: "♛",
      title: "Campus Champion",
      description: "Complete the entire DAVV Quest.",
      unlocked: Boolean(gameState?.gameCompleted),
    },
  ];

  if (loadingState) {
    return (
      <main className="profile-page">
        <header className="profile-header">
          <button
            type="button"
            className="back-button"
            onClick={() => navigate("/game")}
          >
            ←
          </button>
          <div>
            <span className="section-kicker">DAVV QUEST</span>
            <h1>PROFILE</h1>
          </div>
        </header>
        <div style={{ textAlign: "center", padding: "60px 0", color: "#fff" }}>
          LOADING PROFILE...
        </div>
      </main>
    );
  }

  return (
    <main className="profile-page">
      {/* HEADER */}
      <header className="profile-header">
        <button
          type="button"
          className="back-button"
          onClick={() => navigate("/game")}
        >
          ←
        </button>

        <div>
          <span className="section-kicker">DAVV QUEST</span>
          <h1>PROFILE</h1>
        </div>

        <button
          type="button"
          className="settings-button"
          onClick={() => setShowSettings(!showSettings)}
          aria-label="Settings"
        >
          ⚙
        </button>
      </header>

      {/* SETTINGS / ACCOUNT MODAL */}
      {showSettings && (
        <section
          className="pixel-panel"
          style={{
            margin: "14px 16px",
            background: "#1c1a17",
            border: "3px solid #f5c542",
            padding: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <strong style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px", color: "#f5c542" }}>
              ACCOUNT SETTINGS
            </strong>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "#fff",
                fontSize: "18px",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
          <p style={{ margin: "4px 0", fontSize: "12px", color: "#bcb4a3" }}>
            <strong>Email:</strong> {email}
          </p>
          <p style={{ margin: "4px 0", fontSize: "12px", color: "#bcb4a3" }}>
            <strong>Player UID:</strong> {user?.uid?.slice(0, 12)}...
          </p>
          <p style={{ margin: "4px 0", fontSize: "12px", color: "#bcb4a3" }}>
            <strong>Status:</strong> Active Adventurer
          </p>
          <button
            type="button"
            className="profile-action danger"
            onClick={handleLogout}
            style={{ marginTop: "12px", width: "100%", padding: "10px" }}
          >
            LOG OUT OF ACCOUNT
          </button>
        </section>
      )}

      {/* PROFILE HERO */}
      <section className="profile-hero">
        <div className="large-avatar">{avatarLetter}</div>

        <div className="profile-identity">
          <span className="player-label">AUTHENTICATED PLAYER</span>
          <h2>{displayName}</h2>
          <span className="profile-team">{email}</span>
          <div className="level-badge">
            {gameState?.gameCompleted
              ? "QUEST MASTER"
              : `LEVEL ${level} ADVENTURER`}
          </div>
        </div>
      </section>

      {/* XP */}
      <section className="xp-card pixel-panel">
        <div className="xp-header">
          <div>
            <span className="section-kicker">EXPERIENCE</span>
            <h2>LEVEL {level} PROGRESSION</h2>
          </div>

          <strong>{score} XP</strong>
        </div>

        <div className="large-xp-bar">
          <div
            style={{
              width: `${Math.min(
                100,
                Math.max(8, ((score % 250) / 250) * 100),
              )}%`,
            }}
          />
        </div>

        <div className="xp-details">
          <span>{score} XP TOTAL</span>
          <span>{nextLevelXP - score} XP TO LEVEL {level + 1}</span>
        </div>
      </section>

      {/* STATS */}
      <section className="stats-grid">
        <div className="stat-card pixel-panel">
          <span className="stat-icon">◆</span>
          <strong>{completedCount}</strong>
          <small>CHECKPOINTS</small>
        </div>

        <div className="stat-card pixel-panel">
          <span className="stat-icon">🎒</span>
          <strong>{inventoryCount}</strong>
          <small>ARTIFACTS</small>
        </div>

        <div className="stat-card pixel-panel">
          <span className="stat-icon">♛</span>
          <strong>#{rank}</strong>
          <small>RANK</small>
        </div>

        <div className="stat-card pixel-panel">
          <span className="stat-icon">★</span>
          <strong>{score}</strong>
          <small>TOTAL XP</small>
        </div>
      </section>

      {/* ACHIEVEMENTS */}
      <section className="achievements pixel-panel">
        <div className="section-header">
          <div>
            <span className="section-kicker">PROGRESSION</span>
            <h2>ACHIEVEMENTS</h2>
          </div>

          <span className="achievement-count">
            {achievements.filter((a) => a.unlocked).length} / {achievements.length}
          </span>
        </div>

        <div className="achievement-list">
          {achievements.map((a) => (
            <div
              key={a.id}
              className={`achievement ${a.unlocked ? "unlocked" : "locked"}`}
            >
              <div className="achievement-icon">{a.icon}</div>
              <div>
                <strong>{a.title}</strong>
                <p>{a.description}</p>
              </div>
              {a.unlocked && <span className="check">✓</span>}
            </div>
          ))}
        </div>
      </section>

      {/* ACTIONS */}
      <section className="profile-actions">
        <button
          type="button"
          className="profile-action primary"
          onClick={() => navigate("/game")}
        >
          RETURN TO GAME
        </button>

        <button
          type="button"
          className="profile-action danger"
          onClick={handleLogout}
        >
          LOG OUT
        </button>
      </section>

      {/* NAV */}
      <nav className="game-nav">
        <button
          type="button"
          className="nav-item"
          onClick={() => navigate("/game")}
        >
          <span>◆</span>
          <small>GAME</small>
        </button>

        <button
          type="button"
          className="nav-item"
          onClick={() => navigate("/leaderboard")}
        >
          <span>♜</span>
          <small>RANK</small>
        </button>

        <button type="button" className="nav-item active">
          <span>●</span>
          <small>PROFILE</small>
        </button>
      </nav>
    </main>
  );
}

export default Profile;
