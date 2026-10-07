import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Leaderboard.css";

const leaderboardData = [
  {
    rank: 1,
    name: "Team Phoenix",
    player: "Aarav",
    xp: 1250,
    checkpoints: 5,
    avatar: "P",
  },
  {
    rank: 2,
    name: "Pixel Warriors",
    player: "Rohan",
    xp: 1100,
    checkpoints: 4,
    avatar: "P",
  },
  {
    rank: 3,
    name: "Circuit Breakers",
    player: "Piyush",
    xp: 950,
    checkpoints: 4,
    avatar: "C",
    isCurrentUser: true,
  },
  {
    rank: 4,
    name: "Code Raiders",
    player: "Aditya",
    xp: 850,
    checkpoints: 3,
    avatar: "C",
  },
  {
    rank: 5,
    name: "Debug Squad",
    player: "Kunal",
    xp: 700,
    checkpoints: 3,
    avatar: "D",
  },
  {
    rank: 6,
    name: "The Explorers",
    player: "Ankit",
    xp: 550,
    checkpoints: 2,
    avatar: "E",
  },
  {
    rank: 7,
    name: "Quest Masters",
    player: "Dev",
    xp: 400,
    checkpoints: 2,
    avatar: "Q",
  },
];

function Leaderboard() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("players");

  const sortedPlayers = [...leaderboardData].sort((a, b) => b.xp - a.xp);

  return (
    <main className="leaderboard-page">
      {/* HEADER */}

      <header className="leaderboard-header">
        <button className="back-button" onClick={() => navigate("/game")}>
          ←
        </button>

        <div>
          <span className="section-kicker">DAVV QUEST</span>
          <h1>LEADERBOARD</h1>
        </div>

        <div className="live-indicator">
          <span />
          LIVE
        </div>
      </header>

      {/* HERO */}

      <section className="leaderboard-hero">
        <div className="trophy">♛</div>

        <div>
          <span className="section-kicker">CURRENT EVENT</span>
          <h2>DAVV CAMPUS QUEST</h2>
          <p>Race across campus. Find the checkpoints. Top the board.</p>
        </div>
      </section>

      {/* MODE SWITCH */}

      <div className="leaderboard-tabs">
        <button
          className={mode === "players" ? "active" : ""}
          onClick={() => setMode("players")}
        >
          PLAYERS
        </button>

        <button
          className={mode === "teams" ? "active" : ""}
          onClick={() => setMode("teams")}
        >
          TEAMS
        </button>
      </div>

      {/* PODIUM */}

      <section className="podium">
        {sortedPlayers.slice(0, 3).map((player) => (
          <div
            key={player.rank}
            className={`podium-player rank-${player.rank}`}
          >
            <div className="podium-avatar">{player.avatar}</div>

            <span className="podium-rank">
              {player.rank === 1 ? "♛" : `#${player.rank}`}
            </span>

            <strong>{player.name}</strong>

            <span>{player.xp} XP</span>
          </div>
        ))}
      </section>

      {/* LIST */}

      <section className="ranking-list pixel-panel">
        <div className="ranking-title">
          <div>
            <span className="section-kicker">RANKINGS</span>
            <h2>ALL PLAYERS</h2>
          </div>

          <span className="player-count">{sortedPlayers.length} PLAYERS</span>
        </div>

        <div className="ranking-items">
          {sortedPlayers.map((player) => (
            <div
              key={player.rank}
              className={`ranking-item ${
                player.isCurrentUser ? "current-player" : ""
              }`}
            >
              <div className="rank-number">#{player.rank}</div>

              <div className="ranking-avatar">{player.avatar}</div>

              <div className="ranking-player">
                <strong>
                  {player.name}

                  {player.isCurrentUser && (
                    <span className="you-badge">YOU</span>
                  )}
                </strong>

                <small>{player.checkpoints} checkpoints</small>
              </div>

              <div className="ranking-xp">
                <strong>{player.xp}</strong>
                <span>XP</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* YOUR POSITION */}

      <section className="your-position pixel-panel">
        <div className="your-position-icon">◆</div>

        <div>
          <span>YOUR POSITION</span>
          <strong>#3 — 950 XP</strong>
        </div>

        <button onClick={() => navigate("/game")}>PLAY</button>
      </section>

      {/* BOTTOM NAV */}

      <nav className="game-nav">
        <button className="nav-item" onClick={() => navigate("/game")}>
          <span>◆</span>
          <small>GAME</small>
        </button>

        <button className="nav-item active">
          <span>♜</span>
          <small>RANK</small>
        </button>

        <button className="nav-item" onClick={() => navigate("/profile")}>
          <span>●</span>
          <small>PROFILE</small>
        </button>
      </nav>
    </main>
  );
}

export default Leaderboard;
