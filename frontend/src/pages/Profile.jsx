import { useNavigate } from "react-router-dom";
import "./Profile.css";

const achievements = [
  {
    id: 1,
    icon: "★",
    title: "First Steps",
    description: "Complete your first checkpoint.",
    unlocked: true,
  },
  {
    id: 2,
    icon: "◆",
    title: "Explorer",
    description: "Visit 3 different checkpoints.",
    unlocked: true,
  },
  {
    id: 3,
    icon: "⚡",
    title: "Speedrunner",
    description: "Complete a checkpoint in under 2 minutes.",
    unlocked: false,
  },
  {
    id: 4,
    icon: "♛",
    title: "Champion",
    description: "Reach the top of the leaderboard.",
    unlocked: false,
  },
];

const recentActivity = [
  {
    title: "Joined DAVV Campus Quest",
    time: "Today",
    xp: "+0 XP",
  },
  {
    title: "Completed tutorial checkpoint",
    time: "Today",
    xp: "+100 XP",
  },
  {
    title: "Found Hint power-up",
    time: "Today",
    xp: "+50 XP",
  },
];

function Profile() {
  const navigate = useNavigate();

  return (
    <main className="profile-page">
      {/* HEADER */}

      <header className="profile-header">
        <button className="back-button" onClick={() => navigate("/game")}>
          ←
        </button>

        <div>
          <span className="section-kicker">DAVV QUEST</span>
          <h1>PROFILE</h1>
        </div>

        <button className="settings-button">⚙</button>
      </header>

      {/* PROFILE HERO */}

      <section className="profile-hero">
        <div className="large-avatar">P</div>

        <div className="profile-identity">
          <span className="player-label">PLAYER</span>

          <h2>Piyush</h2>

          <span className="profile-team">CIRCUIT BREAKERS</span>

          <div className="level-badge">LEVEL 4</div>
        </div>
      </section>

      {/* XP */}

      <section className="xp-card pixel-panel">
        <div className="xp-header">
          <div>
            <span className="section-kicker">EXPERIENCE</span>
            <h2>ADVENTURER LEVEL 4</h2>
          </div>

          <strong>950 XP</strong>
        </div>

        <div className="large-xp-bar">
          <div style={{ width: "68%" }} />
        </div>

        <div className="xp-details">
          <span>950 XP</span>
          <span>1,400 XP TO LEVEL 5</span>
        </div>
      </section>

      {/* STATS */}

      <section className="stats-grid">
        <div className="stat-card pixel-panel">
          <span className="stat-icon">◆</span>
          <strong>4</strong>
          <small>CHECKPOINTS</small>
        </div>

        <div className="stat-card pixel-panel">
          <span className="stat-icon">♛</span>
          <strong>#3</strong>
          <small>RANK</small>
        </div>

        <div className="stat-card pixel-panel">
          <span className="stat-icon">◷</span>
          <strong>18m</strong>
          <small>PLAY TIME</small>
        </div>

        <div className="stat-card pixel-panel">
          <span className="stat-icon">★</span>
          <strong>2</strong>
          <small>ACHIEVEMENTS</small>
        </div>
      </section>

      {/* ACHIEVEMENTS */}

      <section className="achievements pixel-panel">
        <div className="section-header">
          <div>
            <span className="section-kicker">PROGRESSION</span>
            <h2>ACHIEVEMENTS</h2>
          </div>

          <span className="achievement-count">2 / 4</span>
        </div>

        <div className="achievement-list">
          {achievements.map((achievement) => (
            <div
              key={achievement.id}
              className={`achievement ${
                achievement.unlocked ? "unlocked" : "locked"
              }`}
            >
              <div className="achievement-icon">{achievement.icon}</div>

              <div>
                <strong>{achievement.title}</strong>
                <p>{achievement.description}</p>
              </div>

              {achievement.unlocked && <span className="check">✓</span>}
            </div>
          ))}
        </div>
      </section>

      {/* RECENT ACTIVITY */}

      <section className="activity pixel-panel">
        <div className="section-header">
          <div>
            <span className="section-kicker">HISTORY</span>
            <h2>RECENT ACTIVITY</h2>
          </div>
        </div>

        <div className="activity-list">
          {recentActivity.map((activity, index) => (
            <div className="activity-item" key={index}>
              <div className="activity-dot" />

              <div className="activity-content">
                <strong>{activity.title}</strong>
                <small>{activity.time}</small>
              </div>

              <span>{activity.xp}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ACTIONS */}

      <section className="profile-actions">
        <button
          className="profile-action primary"
          onClick={() => navigate("/game")}
        >
          RETURN TO GAME
        </button>

        <button
          className="profile-action danger"
          onClick={() => navigate("/login")}
        >
          LOG OUT
        </button>
      </section>

      {/* NAV */}

      <nav className="game-nav">
        <button className="nav-item" onClick={() => navigate("/game")}>
          <span>◆</span>
          <small>GAME</small>
        </button>

        <button className="nav-item" onClick={() => navigate("/leaderboard")}>
          <span>♜</span>
          <small>RANK</small>
        </button>

        <button className="nav-item active">
          <span>●</span>
          <small>PROFILE</small>
        </button>
      </nav>
    </main>
  );
}

export default Profile;
