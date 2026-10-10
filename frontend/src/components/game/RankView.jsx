import { Trophy, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./RankView.css";

function RankView({
  user,
  score = 0,
  level = 1,
  nextLevelXP = 250,
  rank = 1,
  completedCheckpoints = [],
  inventory = [],
}) {
  const navigate = useNavigate();

  const prevLevelXP = (level - 1) * 250;
  const currentXPInLevel = score - prevLevelXP;
  const xpNeededForLevel = 250;
  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round((currentXPInLevel / xpNeededForLevel) * 100)),
  );

  const displayName = user?.displayName || "Explorer";
  const avatarLetter = displayName.charAt(0).toUpperCase();

  return (
    <div className="rank-view">
      <div className="rank-container">
        {/* Hero Card */}
        <section className="rank-hero-card">
          <div className="rank-hero-avatar">{avatarLetter}</div>
          <div className="rank-hero-details">
            <h2>{displayName}</h2>
            <div className="rank-badge-row">
              <span className="rank-level-badge">LEVEL {level}</span>
              <span className="rank-position-badge">RANK #{rank}</span>
            </div>
          </div>
        </section>

        {/* XP Card */}
        <section className="rank-xp-card">
          <div className="rank-xp-header">
            <span className="rank-xp-title">EXPERIENCE PROGRESS</span>
            <span className="rank-xp-value">{score} XP TOTAL</span>
          </div>

          <div className="rank-progress-bg">
            <div
              className="rank-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="rank-progress-details">
            <span>Level {level}</span>
            <span>{nextLevelXP - score} XP to Level {level + 1}</span>
          </div>
        </section>

        {/* Stats Grid */}
        <div className="rank-stats-grid">
          <div className="rank-stat-box">
            <strong>{completedCheckpoints.length}</strong>
            <small>CHECKPOINTS</small>
          </div>

          <div className="rank-stat-box">
            <strong>{inventory.length}</strong>
            <small>ARTIFACTS</small>
          </div>

          <div className="rank-stat-box">
            <strong>#{rank}</strong>
            <small>LEADERBOARD RANK</small>
          </div>

          <div className="rank-stat-box">
            <strong>{score}</strong>
            <small>TOTAL XP</small>
          </div>
        </div>

        {/* Full Leaderboard Button */}
        <button
          type="button"
          className="view-leaderboard-btn"
          onClick={() => navigate("/leaderboard")}
        >
          <Trophy size={16} /> VIEW CAMPUS LEADERBOARD <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export default RankView;
