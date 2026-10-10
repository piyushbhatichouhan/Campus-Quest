import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { gameApi } from "../services/gameApi";
import { useAuth } from "../context/AuthContext";
import "./Leaderboard.css";

function Leaderboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [players, setPlayers] = useState([]);
  const [mode, setMode] = useState("players");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function fetchLeaderboard() {
      try {
        setLoading(true);
        const data = await gameApi.getLeaderboard();
        if (isMounted) {
          setPlayers(data || []);
        }
      } catch (err) {
        if (isMounted) {
          setErrorMsg(err.message || "Failed to load leaderboard.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchLeaderboard();

    return () => {
      isMounted = false;
    };
  }, []);

  const currentUserEntry = players.find(
    (p) => p.isCurrentUser || p.uid === user?.uid,
  );

  // Derive campus squads for Teams view
  const teamsData = [
    {
      rank: 1,
      name: "Circuit Breakers",
      avatar: "C",
      score: players.slice(0, 3).reduce((acc, p) => acc + (p.score || 0), 450),
      members: "IIPS Tech Club",
    },
    {
      rank: 2,
      name: "Pixel Warriors",
      avatar: "P",
      score: players.slice(3, 6).reduce((acc, p) => acc + (p.score || 0), 300),
      members: "Computer Science Dept",
    },
    {
      rank: 3,
      name: "Team Phoenix",
      avatar: "P",
      score: 250,
      members: "DAVV Explorers",
    },
    {
      rank: 4,
      name: "Debug Squad",
      avatar: "D",
      score: 150,
      members: "Campus Engineering",
    },
  ];

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

      {/* MODE TABS */}
      <div className="leaderboard-tabs">
        <button
          type="button"
          className={mode === "players" ? "active" : ""}
          onClick={() => setMode("players")}
        >
          PLAYERS
        </button>

        <button
          type="button"
          className={mode === "teams" ? "active" : ""}
          onClick={() => setMode("teams")}
        >
          TEAMS
        </button>
      </div>

      {/* ERROR MSG */}
      {errorMsg && (
        <div
          style={{
            background: "#3b1111",
            border: "2px solid #e05252",
            color: "#ff9999",
            padding: "10px",
            margin: "10px 16px",
            fontSize: "12px",
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* LOADING */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#fff" }}>
          LOADING LEADERBOARD...
        </div>
      ) : mode === "players" ? (
        <>
          {/* PODIUM */}
          {players.length > 0 && (
            <section className="podium">
              {players.slice(0, 3).map((player) => (
                <div
                  key={player.uid || player.rank}
                  className={`podium-player rank-${player.rank}`}
                >
                  <div className="podium-avatar">
                    {(player.displayName || "P").charAt(0).toUpperCase()}
                  </div>

                  <span className="podium-rank">
                    {player.rank === 1 ? "♛" : `#${player.rank}`}
                  </span>

                  <strong>{player.displayName}</strong>

                  <span>{player.score} XP</span>
                </div>
              ))}
            </section>
          )}

          {/* LIST */}
          <section className="ranking-list pixel-panel">
            <div className="ranking-title">
              <div>
                <span className="section-kicker">RANKINGS</span>
                <h2>ALL PLAYERS</h2>
              </div>

              <span className="player-count">{players.length} PLAYERS</span>
            </div>

            <div className="ranking-items">
              {players.map((player) => {
                const isYou = player.isCurrentUser || player.uid === user?.uid;
                return (
                  <div
                    key={player.uid || player.rank}
                    className={`ranking-item ${isYou ? "current-player" : ""}`}
                  >
                    <div className="rank-number">#{player.rank}</div>

                    <div className="ranking-avatar">
                      {(player.displayName || "P").charAt(0).toUpperCase()}
                    </div>

                    <div className="ranking-player">
                      <strong>
                        {player.displayName}
                        {isYou && <span className="you-badge">YOU</span>}
                      </strong>

                      <small>{player.completedCount} checkpoints</small>
                    </div>

                    <div className="ranking-xp">
                      <strong>{player.score}</strong>
                      <span>XP</span>
                    </div>
                  </div>
                );
              })}

              {players.length === 0 && (
                <div
                  style={{
                    padding: "20px",
                    textAlign: "center",
                    color: "#bcb4a3",
                  }}
                >
                  No players on the leaderboard yet. Be the first!
                </div>
              )}
            </div>
          </section>

          {/* YOUR POSITION */}
          {currentUserEntry && (
            <section className="your-position pixel-panel">
              <div className="your-position-icon">◆</div>

              <div>
                <span>YOUR POSITION</span>
                <strong>
                  #{currentUserEntry.rank} — {currentUserEntry.score} XP
                </strong>
              </div>

              <button type="button" onClick={() => navigate("/game")}>
                PLAY
              </button>
            </section>
          )}
        </>
      ) : (
        /* TEAMS MODE */
        <section className="ranking-list pixel-panel" style={{ margin: "16px" }}>
          <div className="ranking-title">
            <div>
              <span className="section-kicker">CAMPUS SQUADS</span>
              <h2>TEAM STANDINGS</h2>
            </div>
            <span className="player-count">{teamsData.length} TEAMS</span>
          </div>

          <div className="ranking-items">
            {teamsData.map((team) => (
              <div key={team.name} className="ranking-item">
                <div className="rank-number">#{team.rank}</div>
                <div className="ranking-avatar">{team.avatar}</div>
                <div className="ranking-player">
                  <strong>{team.name}</strong>
                  <small>{team.members}</small>
                </div>
                <div className="ranking-xp">
                  <strong>{team.score}</strong>
                  <span>XP</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* BOTTOM NAV */}
      <nav className="game-nav">
        <button type="button" className="nav-item" onClick={() => navigate("/game")}>
          <span>◆</span>
          <small>GAME</small>
        </button>

        <button type="button" className="nav-item active">
          <span>♜</span>
          <small>RANK</small>
        </button>

        <button
          type="button"
          className="nav-item"
          onClick={() => navigate("/profile")}
        >
          <span>●</span>
          <small>PROFILE</small>
        </button>
      </nav>
    </main>
  );
}

export default Leaderboard;
