/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { gameApi } from "../services/gameApi";
import { useAuth } from "../context/AuthContext";
import "./Leaderboard.css";

function formatFinishedTime(isoString, fallbackFormatted) {
  if (fallbackFormatted && fallbackFormatted !== "—") {
    return fallbackFormatted;
  }
  if (!isoString) return "—";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Leaderboard() {
  const navigate = useNavigate();
  const { team: authTeam } = useAuth();
  const [teams, setTeams] = useState([]);
  const [eventState, setEventState] = useState({ status: "active" });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const isPollingRef = useRef(false);

  const fetchLeaderboard = useCallback(async (isInitial = false) => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;

    try {
      if (isInitial) setLoading(true);
      const [leaderboardData, evtData] = await Promise.all([
        gameApi.getLeaderboard(),
        gameApi.getEventStatus().catch(() => null),
      ]);
      setTeams(leaderboardData || []);
      if (evtData) {
        setEventState(evtData);
      }
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
        timerId = window.setTimeout(schedulePoll, 4000);
      }
    };

    timerId = window.setTimeout(schedulePoll, 4000);

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

  const eventStatus = eventState?.status || "active";
  const isOfficialFinal = eventStatus === "completed";
  const isStopped = eventStatus === "stopped";

  return (
    <main className="leaderboard-page">
      {/* HEADER */}
      <header className="leaderboard-header">
        <button className="back-button" onClick={() => navigate("/game")}>
          ←
        </button>

        <div>
          <span className="section-kicker">CAMPUS QUEST</span>
          <h1>
            {isOfficialFinal
              ? "OFFICIAL FINAL RESULTS"
              : isStopped
                ? "FROZEN RACE STANDINGS"
                : "RACE LEADERBOARD"}
          </h1>
        </div>

        <div
          className={`live-indicator ${isOfficialFinal || isStopped ? "frozen" : ""}`}
        >
          <span />
          {isOfficialFinal ? "OFFICIAL" : isStopped ? "STOPPED" : "LIVE"}
        </div>
      </header>

      {/* HERO */}
      <section className="leaderboard-hero">
        <div className="trophy">♛</div>

        <div>
          <span className="section-kicker">
            {isOfficialFinal
              ? "FINALIZED COMPETITION STANDINGS"
              : isStopped
                ? "EVENT ENDED — RESULTS FROZEN"
                : "AUTHORITATIVE RACE STANDINGS"}
          </span>
          <h2>CAMPUS QUEST RACE LEADERBOARD</h2>
          <p>
            First team to complete every mystery checkpoint challenge wins.
            Ranked by completion timestamp, checkpoint progress, and earliest
            checkpoint arrival.
          </p>
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
          LOADING RACE STANDINGS...
        </div>
      ) : (
        <>
          {/* PODIUM FOR TOP 3 SQUADS */}
          {teams.length > 0 && (
            <section className="podium">
              {teams.slice(0, 3).map((team) => {
                const progressText =
                  team.progress ||
                  `${team.completedCount || 0}/${team.totalCheckpoints || 10}`;
                const finishText = formatFinishedTime(
                  team.completedAt,
                  team.finishedAtFormatted,
                );
                return (
                  <div
                    key={team.teamId || team.rank}
                    className={`podium-player rank-${team.rank}`}
                  >
                    <div className="podium-avatar">
                      {(team.name || "T").charAt(0).toUpperCase()}
                    </div>

                    <span className="podium-rank">
                      {team.rank === 1 ? "♛ #1" : `#${team.rank}`}
                    </span>

                    <strong>{team.name}</strong>

                    <span>
                      {progressText} • {finishText !== "—" ? finishText : `${team.score} XP`}
                    </span>
                  </div>
                );
              })}
            </section>
          )}

          {/* RACE LEADERBOARD TABLE */}
          <section className="ranking-list pixel-panel">
            <div className="ranking-title">
              <div>
                <span className="section-kicker">
                  {isOfficialFinal ? "OFFICIAL STANDINGS" : "RACE STANDINGS"}
                </span>
                <h2>ALL COMPETING TEAMS</h2>
              </div>

              <span className="player-count">{teams.length} TEAMS</span>
            </div>

            <div className="race-table-wrapper">
              <table className="race-leaderboard-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Team</th>
                    <th>Progress</th>
                    <th>Finished at</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((team) => {
                    const isYou =
                      team.isCurrentTeam ||
                      (currentTeamId && team.teamId === currentTeamId);
                    const progressLabel =
                      team.progress ||
                      `${team.completedCount || 0}/${team.totalCheckpoints || 10}`;
                    const finishedLabel = formatFinishedTime(
                      team.completedAt,
                      team.finishedAtFormatted,
                    );

                    return (
                      <tr
                        key={team.teamId || team.rank}
                        className={isYou ? "current-player-row" : ""}
                      >
                        <td className="race-col-rank">#{team.rank}</td>
                        <td className="race-col-team">
                          <div className="race-team-cell">
                            <strong>
                              {team.name}
                              {isYou && (
                                <span className="you-badge">YOUR TEAM</span>
                              )}
                            </strong>
                            <small>
                              {team.score} XP
                              {team.memberCount
                                ? ` • ${team.memberCount} players`
                                : ""}
                            </small>
                          </div>
                        </td>
                        <td className="race-col-progress">
                          <span
                            className={`race-progress-pill ${
                              team.gameCompleted ? "completed" : ""
                            }`}
                          >
                            {progressLabel}
                          </span>
                        </td>
                        <td className="race-col-finished">{finishedLabel}</td>
                      </tr>
                    );
                  })}

                  {teams.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          padding: "20px",
                          textAlign: "center",
                          color: "#bcb4a3",
                        }}
                      >
                        No teams on the leaderboard yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* YOUR POSITION */}
          {currentTeamEntry && (
            <section className="your-position pixel-panel">
              <div className="your-position-icon">◆</div>

              <div>
                <span>YOUR TEAM STANDING</span>
                <strong>
                  #{currentTeamEntry.rank} — {currentTeamEntry.name} —{" "}
                  {currentTeamEntry.progress ||
                    `${currentTeamEntry.completedCount || 0}/${currentTeamEntry.totalCheckpoints || 10}`}{" "}
                  (
                  {formatFinishedTime(
                    currentTeamEntry.completedAt,
                    currentTeamEntry.finishedAtFormatted,
                  )}
                  )
                </strong>
              </div>

              <button type="button" onClick={() => navigate("/game")}>
                {isOfficialFinal || isStopped ? "VIEW" : "PLAY"}
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
