import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { gameApi } from "../services/gameApi";
import { useAuth } from "../context/AuthContext";
import "./Leaderboard.css";

function Leaderboard() {
  const navigate = useNavigate();
  const { user, team: authTeam } = useAuth();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const isPollingRef = useRef(false);

  const fetchLeaderboard = useCallback(async (isInitial = false) => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;

    try {
      if (isInitial) setLoading(true);
      const data = await gameApi.getLeaderboard();
      setTeams(data || []);
      setErrorMsg("");
    } catch (err) {
      if (isInitial) {
        setErrorMsg(err.message || "Failed to load leaderboard.");
      }
    } finally {
      isPollingRef.current = false;
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let timerId = null;
    let isMounted = true;

    fetchLeaderboard(true);

    const schedulePoll = async () => {
      if (!isMounted) return;
      if (document.visibilityState === "visible") {
        await fetchLeaderboard(false);
      }
      if (isMounted) {
        timerId = window.setTimeout(schedulePoll, 5000);
      }
    };

    timerId = window.setTimeout(schedulePoll, 5000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchLeaderboard(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchLeaderboard]);

  const currentTeamId = authTeam?.teamId;
  const currentTeamEntry = teams.find(
    (t) => t.isCurrentTeam || (currentTeamId && t.teamId === currentTeamId),
  );

  return (
    <main className="leaderboard-page">
      {/* HEADER */}
      <header className="leaderboard-header">
        <button className="back-button" onClick={() => navigate("/game")}>
          ←
        </button>

        <div>
          <span className="section-kicker">CAMPUS QUEST</span>
          <h1>TEAM LEADERBOARD</h1>
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
          <span className="section-kicker">ORIENTATION SQUAD STANDINGS</span>
          <h2>CAMPUS QUEST LEADERBOARD</h2>
          <p>Explore together. Solve challenges. Climb the squad leaderboard.</p>
        </div>
      </section>

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
          LOADING TEAM RANKINGS...
        </div>
      ) : (
        <>
          {/* PODIUM FOR TOP 3 SQUADS */}
          {teams.length > 0 && (
            <section className="podium">
              {teams.slice(0, 3).map((team) => (
                <div
                  key={team.teamId || team.rank}
                  className={`podium-player rank-${team.rank}`}
                >
                  <div className="podium-avatar">
                    {(team.name || "T").charAt(0).toUpperCase()}
                  </div>

                  <span className="podium-rank">
                    {team.rank === 1 ? "♛" : `#${team.rank}`}
                  </span>

                  <strong>{team.name}</strong>

                  <span>{team.score} XP</span>
                </div>
              ))}
            </section>
          )}

          {/* SQUADS LIST */}
          <section className="ranking-list pixel-panel">
            <div className="ranking-title">
              <div>
                <span className="section-kicker">STANDINGS</span>
                <h2>ALL SQUADS</h2>
              </div>

              <span className="player-count">{teams.length} SQUADS</span>
            </div>

            <div className="ranking-items">
              {teams.map((team) => {
                const isYou =
                  team.isCurrentTeam ||
                  (currentTeamId && team.teamId === currentTeamId);

                return (
                  <div
                    key={team.teamId || team.rank}
                    className={`ranking-item ${isYou ? "current-player" : ""}`}
                  >
                    <div className="rank-number">#{team.rank}</div>

                    <div className="ranking-avatar">
                      {(team.name || "T").charAt(0).toUpperCase()}
                    </div>

                    <div className="ranking-player">
                      <strong>
                        {team.name}
                        {isYou && <span className="you-badge">YOUR TEAM</span>}
                      </strong>

                      <small>
                        {team.completedCount} / {team.totalCheckpoints || 10} checkpoints
                        {team.memberCount ? ` • ${team.memberCount} players` : ""}
                      </small>
                    </div>

                    <div className="ranking-xp">
                      <strong>{team.score}</strong>
                      <span>XP</span>
                    </div>
                  </div>
                );
              })}

              {teams.length === 0 && (
                <div
                  style={{
                    padding: "20px",
                    textAlign: "center",
                    color: "#bcb4a3",
                  }}
                >
                  No teams on the leaderboard yet. Be the first to claim a checkpoint!
                </div>
              )}
            </div>
          </section>

          {/* YOUR POSITION */}
          {currentTeamEntry && (
            <section className="your-position pixel-panel">
              <div className="your-position-icon">◆</div>

              <div>
                <span>YOUR SQUAD POSITION</span>
                <strong>
                  #{currentTeamEntry.rank} — {currentTeamEntry.name} — {currentTeamEntry.score} XP
                </strong>
              </div>

              <button type="button" onClick={() => navigate("/game")}>
                PLAY
              </button>
            </section>
          )}
        </>
      )}

      {/* BOTTOM NAV */}
      <nav className="game-nav">
        <button
          type="button"
          className="nav-item"
          onClick={() => navigate("/game")}
        >
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
