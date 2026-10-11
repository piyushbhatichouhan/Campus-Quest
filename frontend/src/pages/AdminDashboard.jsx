/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { gameApi } from "../services/gameApi";
import "./AdminDashboard.css";

function formatElapsedTime(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return hrs > 0
    ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
    : `${pad(mins)}:${pad(secs)}`;
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function AdminDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [overview, setOverview] = useState(null);
  const [raceLeaderboard, setRaceLeaderboard] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedCheckpointId, setSelectedCheckpointId] = useState(
    "mechanical_workshop",
  );
  const [checkpointAnalytics, setCheckpointAnalytics] = useState(null);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [teamDetail, setTeamDetail] = useState(null);

  const [activeTab, setActiveTab] = useState("race"); // "race" | "checkpoints" | "teams"
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: "success" | "error", message: string }

  // Confirmation modal states:
  // modalFlow: null | "start_1" | "start_2" | "stop_1" | "stop_2" | "finalize"
  const [modalFlow, setModalFlow] = useState(null);
  const [confirmInput, setConfirmInput] = useState("");

  // Live competition timer state
  const [liveElapsed, setLiveElapsed] = useState(0);
  const isPollingRef = useRef(false);

  const fetchDashboardData = useCallback(
    async (isInitial = false) => {
      if (isPollingRef.current) return;
      isPollingRef.current = true;

      try {
        if (isInitial) setLoading(true);

        const [overviewData, lbData, teamsData] = await Promise.all([
          gameApi.getAdminOverview(),
          gameApi.getAdminLeaderboard(),
          gameApi.getAdminTeams(),
        ]);

        setOverview(overviewData);
        setRaceLeaderboard(lbData || []);
        setTeams(teamsData || []);
        setForbidden(false);

        const defaultCp =
          selectedCheckpointId ||
          overviewData?.event?.checkpoints?.[0]?.id ||
          "mechanical_workshop";

        const cpData = await gameApi.getCheckpointAnalytics(defaultCp);
        setCheckpointAnalytics(cpData);

        if (selectedTeamId) {
          const detail = await gameApi.getAdminTeamDetail(selectedTeamId);
          setTeamDetail(detail);
        } else if (teamsData && teamsData.length > 0 && !selectedTeamId) {
          setSelectedTeamId(teamsData[0].teamId);
          const detail = await gameApi.getAdminTeamDetail(teamsData[0].teamId);
          setTeamDetail(detail);
        }
      } catch (err) {
        if (err.status === 403 || err.code === "FORBIDDEN") {
          setForbidden(true);
        } else if (isInitial) {
          setFeedback({
            type: "error",
            message: err.message || "Failed to load administrator dashboard.",
          });
        }
      } finally {
        isPollingRef.current = false;
        if (isInitial) setLoading(false);
      }
    },
    [selectedCheckpointId, selectedTeamId],
  );

  useEffect(() => {
    fetchDashboardData(true);

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchDashboardData(false);
      }
    }, 4000);

    return () => clearInterval(intervalId);
  }, [fetchDashboardData]);

  // Authoritative server-synced elapsed timer
  useEffect(() => {
    const event = overview?.event;
    if (!event || !event.startedAt) {
      setLiveElapsed(0);
      return;
    }

    const computeElapsed = () => {
      const startMs = new Date(event.startedAt).getTime();
      const endMs = event.stoppedAt
        ? new Date(event.stoppedAt).getTime()
        : Date.now();
      setLiveElapsed(Math.max(0, Math.floor((endMs - startMs) / 1000)));
    };

    computeElapsed();

    if (event.status === "active") {
      const timer = window.setInterval(computeElapsed, 1000);
      return () => clearInterval(timer);
    }
  }, [overview?.event]);

  const handleSelectCheckpoint = async (cpId) => {
    setSelectedCheckpointId(cpId);
    try {
      const cpData = await gameApi.getCheckpointAnalytics(cpId);
      setCheckpointAnalytics(cpData);
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || "Failed to load checkpoint analytics.",
      });
    }
  };

  const handleSelectTeam = async (teamId) => {
    setSelectedTeamId(teamId);
    setActiveTab("teams");
    try {
      const detail = await gameApi.getAdminTeamDetail(teamId);
      setTeamDetail(detail);
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || "Failed to load team timeline.",
      });
    }
  };

  // Modal flow handlers
  const openStartModal1 = () => {
    if (actionLoading || overview?.event?.status !== "waiting") return;
    setConfirmInput("");
    setModalFlow("start_1");
  };

  const proceedToStartModal2 = () => {
    if (actionLoading) return;
    setConfirmInput("");
    setModalFlow("start_2");
  };

  const openStopModal1 = () => {
    if (actionLoading || overview?.event?.status !== "active") return;
    setConfirmInput("");
    setModalFlow("stop_1");
  };

  const proceedToStopModal2 = () => {
    if (actionLoading) return;
    setConfirmInput("");
    setModalFlow("stop_2");
  };

  const openFinalizeModal = () => {
    if (actionLoading || overview?.event?.status !== "stopped") return;
    setModalFlow("finalize");
  };

  const closeModal = () => {
    if (actionLoading) return;
    setModalFlow(null);
    setConfirmInput("");
  };

  // Authoritative Start Event mutation (never optimistic)
  const executeStartEvent = async () => {
    if (actionLoading || confirmInput !== "START EVENT") return;
    setActionLoading(true);
    setFeedback(null);

    try {
      await gameApi.adminStartEvent();
      setModalFlow(null);
      setConfirmInput("");
      await fetchDashboardData(false);
      setFeedback({
        type: "success",
        message:
          "Campus Quest event is now ACTIVE! The first mystery clue has been unlocked for all teams.",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || "Failed to start event.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Authoritative Stop Event mutation (never optimistic)
  const executeStopEvent = async () => {
    if (actionLoading || confirmInput !== "STOP EVENT") return;
    setActionLoading(true);
    setFeedback(null);

    try {
      await gameApi.adminStopEvent();
      setModalFlow(null);
      setConfirmInput("");
      await fetchDashboardData(false);
      setFeedback({
        type: "success",
        message:
          "Campus Quest event has been STOPPED. All gameplay actions are disabled and competition results are frozen.",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || "Failed to stop event.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Authoritative Finalize Results mutation
  const executeFinalizeEvent = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    setFeedback(null);

    try {
      await gameApi.adminFinalizeEvent();
      setModalFlow(null);
      await fetchDashboardData(false);
      setFeedback({
        type: "success",
        message:
          "Event results are now COMPLETED and marked as OFFICIAL final standings.",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || "Failed to finalize event results.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="admin-page">
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "80vh",
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "12px",
          }}
        >
          LOADING ADMINISTRATOR CONSOLE...
        </div>
      </main>
    );
  }

  if (forbidden) {
    return (
      <main className="admin-page">
        <div className="admin-container" style={{ maxWidth: "540px", marginTop: "60px" }}>
          <section className="admin-lifecycle-panel" style={{ textAlign: "center" }}>
            <span className="admin-kicker">SECURITY ACCESS CONTROL</span>
            <h1 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "15px", color: "#ff8a80" }}>
              403 — ADMINISTRATOR ACCESS REQUIRED
            </h1>
            <p style={{ fontSize: "13px", color: "#bcb4a3", lineHeight: 1.6 }}>
              Your account ({user?.email || user?.uid}) does not have administrator privileges.
              Only authorized administrators can start, stop, or inspect the global Campus Quest event.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                type="button"
                className="admin-nav-btn"
                onClick={() => navigate("/")}
              >
                RETURN TO PLAYER VIEW
              </button>
              <button
                type="button"
                className="admin-nav-btn"
                onClick={async () => {
                  await logout();
                  navigate("/login");
                }}
              >
                SWITCH ACCOUNT
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const event = overview?.event || { status: "waiting" };
  const metrics = overview?.metrics || {
    totalTeams: 0,
    totalPlayers: 0,
    completedTeams: 0,
    inProgressTeams: 0,
    totalCheckpoints: 10,
  };
  const checkpointList = event.checkpoints || [
    { id: "mechanical_workshop", order: 1, name: "Mechanical Workshop" },
    { id: "library", order: 2, name: "Library" },
    { id: "f_block_pond", order: 3, name: "F-block Pond" },
    { id: "cse_block", order: 4, name: "CSE Block (B-block)" },
    { id: "central_placement_cell", order: 5, name: "Central Placement Cell" },
    { id: "electronics_block_1", order: 6, name: "Electronics Block-1 (D-block)" },
    { id: "admin_block", order: 7, name: "Admin Block (M-block)" },
    { id: "electronics_block_2", order: 8, name: "Electronics Block-2 (E-block)" },
    { id: "it_block", order: 9, name: "IT Block (F-block)" },
    { id: "mechanical_block", order: 10, name: "Mechanical Block (A-block)" },
  ];

  return (
    <main className="admin-page">
      {/* HEADER */}
      <header className="admin-header">
        <div className="admin-header-brand">
          <div className="admin-badge-icon">CQ</div>
          <div>
            <span className="admin-kicker">ADMINISTRATOR COMMAND CENTER</span>
            <h1>CAMPUS QUEST EVENT CONTROL</h1>
          </div>
        </div>

        <div className="admin-header-actions">
          <button
            type="button"
            className="admin-nav-btn"
            onClick={() => fetchDashboardData(false)}
          >
            ↻ REFRESH
          </button>
          <button
            type="button"
            className="admin-nav-btn"
            onClick={() => navigate("/leaderboard")}
          >
            PUBLIC LEADERBOARD
          </button>
          <button
            type="button"
            className="admin-nav-btn"
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
          >
            LOG OUT
          </button>
        </div>
      </header>

      <div className="admin-container">
        {/* FEEDBACK BANNER */}
        {feedback && (
          <div
            className={`admin-banner ${feedback.type}`}
            role="alert"
            aria-live="polite"
          >
            <span>{feedback.message}</span>
            <button
              type="button"
              className="admin-banner-close"
              onClick={() => setFeedback(null)}
              aria-label="Dismiss message"
            >
              ✕
            </button>
          </div>
        )}

        {/* AUTHORITATIVE LIFECYCLE OVERVIEW */}
        <section className="admin-lifecycle-panel">
          <div className="admin-status-top">
            <div>
              <span className="admin-kicker">GLOBAL EVENT LIFECYCLE STATE</span>
              <div className={`admin-status-pill ${event.status}`}>
                ● STATUS: {event.status.toUpperCase()}
                {event.status === "completed" ? " (OFFICIAL)" : ""}
              </div>
            </div>

            <div className="admin-timer-box">
              <span className="admin-timer-label">OFFICIAL EVENT TIMER</span>
              <div className="admin-timer-value">
                {formatElapsedTime(liveElapsed)}
              </div>
            </div>
          </div>

          {/* METRICS */}
          <div className="admin-metrics-grid">
            <div className="admin-metric-card">
              <span>REGISTERED TEAMS</span>
              <strong>{metrics.totalTeams}</strong>
            </div>
            <div className="admin-metric-card">
              <span>TOTAL PLAYERS</span>
              <strong>{metrics.totalPlayers}</strong>
            </div>
            <div className="admin-metric-card">
              <span>COMPLETED TEAMS</span>
              <strong>{metrics.completedTeams}</strong>
            </div>
            <div className="admin-metric-card">
              <span>IN PROGRESS</span>
              <strong>{metrics.inProgressTeams}</strong>
            </div>
            <div className="admin-metric-card">
              <span>CHECKPOINTS</span>
              <strong>{metrics.totalCheckpoints}</strong>
            </div>
          </div>

          {/* LIFECYCLE TIMESTAMPS */}
          <div className="admin-timestamps-row">
            <div>
              <strong>Started At</strong>
              {formatDateTime(event.startedAt)}
              {event.startedBy ? ` (${event.startedBy})` : ""}
            </div>
            <div>
              <strong>Stopped At</strong>
              {formatDateTime(event.stoppedAt)}
              {event.stoppedBy ? ` (${event.stoppedBy})` : ""}
            </div>
            <div>
              <strong>Finalized At</strong>
              {formatDateTime(event.finalizedAt)}
              {event.finalizedBy ? ` (${event.finalizedBy})` : ""}
            </div>
          </div>

          {/* VISUALLY SEPARATED EVENT LIFECYCLE CONTROLS */}
          <div className="admin-controls-grid">
            {/* 1. START EVENT CONTROL */}
            <div className="admin-control-card start-zone">
              <div>
                <span className="admin-kicker">PHASE 1 •WAITING → ACTIVE</span>
                <h3>START COMPETITION</h3>
                <p>
                  Simultaneously begins the adventure for all registered teams,
                  closes registration, locks team rosters, starts the official
                  timer, and unlocks the first mystery clue.
                </p>
              </div>
              <button
                type="button"
                className="admin-action-btn start-btn"
                disabled={actionLoading || event.status !== "waiting"}
                onClick={openStartModal1}
              >
                {event.status === "waiting"
                  ? "START EVENT"
                  : "EVENT ALREADY STARTED"}
              </button>
            </div>

            {/* 2. FINALIZE RESULTS CONTROL */}
            <div className="admin-control-card finalize-zone">
              <div>
                <span className="admin-kicker">
                  PHASE 3 • STOPPED → COMPLETED
                </span>
                <h3>FINALIZE OFFICIAL RESULTS</h3>
                <p>
                  After stopping the event and reviewing checkpoint arrival
                  analytics, finalize the frozen standings to mark results as
                  official.
                </p>
              </div>
              <button
                type="button"
                className="admin-action-btn finalize-btn"
                disabled={actionLoading || event.status !== "stopped"}
                onClick={openFinalizeModal}
              >
                {event.status === "completed"
                  ? "RESULTS FINALIZED"
                  : "FINALIZE RESULTS"}
              </button>
            </div>

            {/* 3. STOP EVENT CONTROL (SEPARATED DANGER CARD) */}
            <div className="admin-control-card stop-zone">
              <div>
                <span className="admin-kicker" style={{ color: "#ff8a80" }}>
                  PHASE 2 • ACTIVE → STOPPED (DANGER ZONE)
                </span>
                <h3>STOP ENTIRE EVENT</h3>
                <p>
                  Immediately ends the competition for every team, disables new
                  checkpoint claims and challenge submissions, and freezes
                  standings while preserving all progress.
                </p>
              </div>
              <button
                type="button"
                className="admin-action-btn stop-btn"
                disabled={actionLoading || event.status !== "active"}
                onClick={openStopModal1}
              >
                {event.status === "stopped" || event.status === "completed"
                  ? "EVENT STOPPED"
                  : "STOP EVENT"}
              </button>
            </div>
          </div>
        </section>

        {/* NAVIGATION TABS FOR LEADERBOARDS & ANALYTICS */}
        <div className="admin-tabs">
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === "race" ? "active" : ""}`}
            onClick={() => setActiveTab("race")}
          >
            ♛ RACE LEADERBOARD ({raceLeaderboard.length})
          </button>
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === "checkpoints" ? "active" : ""}`}
            onClick={() => setActiveTab("checkpoints")}
          >
            📍 CHECKPOINT ANALYTICS
          </button>
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === "teams" ? "active" : ""}`}
            onClick={() => setActiveTab("teams")}
          >
            👥 TEAM TIMELINES ({teams.length})
          </button>
        </div>

        {/* TAB 1: RACE LEADERBOARD */}
        {activeTab === "race" && (
          <section className="admin-section-panel">
            <div className="admin-section-header">
              <div>
                <span className="admin-kicker">
                  {event.status === "completed"
                    ? "OFFICIAL FINAL RESULTS"
                    : event.status === "stopped"
                      ? "FROZEN STANDINGS"
                      : "COMPETITION STANDINGS"}
                </span>
                <h2>RACE LEADERBOARD</h2>
              </div>
            </div>

            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Team</th>
                    <th>Progress</th>
                    <th>Finished at</th>
                    <th>XP</th>
                    <th>Members</th>
                    <th>Inspect</th>
                  </tr>
                </thead>
                <tbody>
                  {raceLeaderboard.map((entry) => (
                    <tr key={entry.teamId}>
                      <td className="admin-rank-cell">#{entry.rank}</td>
                      <td>
                        <strong>{entry.name}</strong>
                      </td>
                      <td>{entry.progress}</td>
                      <td>{entry.finishedAt || "—"}</td>
                      <td>{entry.score} XP</td>
                      <td>{entry.memberCount || 1}/4</td>
                      <td>
                        <button
                          type="button"
                          className="admin-inspect-btn"
                          onClick={() => handleSelectTeam(entry.teamId)}
                        >
                          TIMELINE ▶
                        </button>
                      </td>
                    </tr>
                  ))}
                  {raceLeaderboard.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "24px" }}>
                        No teams registered yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* TAB 2: CHECKPOINT ARRIVAL ANALYTICS */}
        {activeTab === "checkpoints" && (
          <section className="admin-section-panel">
            <div className="admin-section-header">
              <div>
                <span className="admin-kicker">
                  RANKED BY ORIGINAL SUCCESSFUL CLAIM TIMESTAMP
                </span>
                <h2>
                  {checkpointAnalytics?.checkpointName || "CHECKPOINT"} — ARRIVAL
                  HISTORY
                </h2>
              </div>
            </div>

            <div className="admin-checkpoint-selector">
              {checkpointList.map((cp) => (
                <button
                  key={cp.id}
                  type="button"
                  className={`admin-cp-chip ${
                    selectedCheckpointId === cp.id ? "active" : ""
                  }`}
                  onClick={() => handleSelectCheckpoint(cp.id)}
                >
                  #{cp.order} {cp.name}
                </button>
              ))}
            </div>

            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Team</th>
                    <th>Claimed at</th>
                    <th>Challenge completed</th>
                    <th>Inspect</th>
                  </tr>
                </thead>
                <tbody>
                  {(checkpointAnalytics?.arrivals || []).map((item) => (
                    <tr key={item.teamId}>
                      <td className="admin-rank-cell">#{item.rank}</td>
                      <td>
                        <strong>{item.teamName}</strong>
                      </td>
                      <td>{item.claimedAtFormatted || formatDateTime(item.claimedAt)}</td>
                      <td>
                        {item.completedAtFormatted ||
                          (item.completedAt ? formatDateTime(item.completedAt) : "—")}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="admin-inspect-btn"
                          onClick={() => handleSelectTeam(item.teamId)}
                        >
                          TIMELINE ▶
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!checkpointAnalytics?.arrivals ||
                    checkpointAnalytics.arrivals.length === 0) && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "24px" }}>
                        No teams have claimed this checkpoint yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* TAB 3: TEAM INSPECTOR & TIMELINE */}
        {activeTab === "teams" && (
          <section className="admin-section-panel">
            <div className="admin-section-header">
              <div>
                <span className="admin-kicker">
                  TEAM ROSTER & CHRONOLOGICAL CHECKPOINT TIMELINE
                </span>
                <h2>TEAM JOURNEY INSPECTOR</h2>
              </div>
            </div>

            <div className="admin-teams-layout">
              <div className="admin-team-list">
                {teams.map((t) => (
                  <button
                    key={t.teamId}
                    type="button"
                    className={`admin-team-item ${
                      selectedTeamId === t.teamId ? "active" : ""
                    }`}
                    onClick={() => handleSelectTeam(t.teamId)}
                  >
                    <div>
                      <strong>{t.name}</strong>
                      <div style={{ fontSize: "11px", color: "#bcb4a3", marginTop: "4px" }}>
                        Code: {t.joinCode} • {t.memberCount}/{t.maxMembers} players
                      </div>
                    </div>
                    <div
                      style={{
                        fontFamily: "'Press Start 2P', monospace",
                        fontSize: "9px",
                        color: "#f5c542",
                      }}
                    >
                      {t.progress}
                    </div>
                  </button>
                ))}
                {teams.length === 0 && (
                  <div style={{ color: "#9ca3af", fontSize: "13px" }}>
                    No teams registered yet.
                  </div>
                )}
              </div>

              <div>
                {teamDetail ? (
                  <div>
                    <div
                      style={{
                        background: "#16181b",
                        border: "2px solid #2b2f36",
                        padding: "16px",
                        marginBottom: "16px",
                      }}
                    >
                      <h3
                        style={{
                          margin: "0 0 8px",
                          fontFamily: "'Press Start 2P', monospace",
                          fontSize: "13px",
                          color: "#f5c542",
                        }}
                      >
                        {teamDetail.name}
                      </h3>
                      <div style={{ fontSize: "13px", color: "#bcb4a3" }}>
                        <strong>Join Code:</strong> {teamDetail.joinCode} •{" "}
                        <strong>Progress:</strong> {teamDetail.progress} •{" "}
                        <strong>Score:</strong> {teamDetail.score} XP •{" "}
                        <strong>Members:</strong>{" "}
                        {(teamDetail.members || [])
                          .map((m) =>
                            m.role === "leader"
                              ? `${m.displayName} (Leader)`
                              : m.displayName,
                          )
                          .join(", ")}
                      </div>
                    </div>

                    <h4
                      style={{
                        margin: "0 0 10px",
                        fontFamily: "'Press Start 2P', monospace",
                        fontSize: "9px",
                        color: "#9ca3af",
                      }}
                    >
                      TEAM TIMELINE (EVENT START → CHECKPOINTS → COMPLETION)
                    </h4>

                    <div className="admin-timeline-list">
                      {(teamDetail.journeySteps || []).map((step, idx) => (
                        <div
                          key={idx}
                          className={`admin-timeline-step ${
                            step.reached ? "reached" : ""
                          }`}
                        >
                          <span>
                            {step.reached ? "✓ " : "○ "}
                            {step.label}
                          </span>
                          <span className="admin-timeline-time">
                            {step.formattedTime || "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ color: "#9ca3af", padding: "20px" }}>
                    Select a team on the left to inspect its checkpoint timeline.
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* =========================================================
          CONFIRMATION MODAL 1 — START EVENT
          ========================================================= */}
      {modalFlow === "start_1" && (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true">
          <div className="admin-modal-card">
            <span className="admin-modal-step-tag">
              CONFIRMATION 1 OF 2 • START COMPETITION
            </span>
            <h2 className="admin-modal-title">Start Campus Quest?</h2>
            <p className="admin-modal-message">
              This will begin the competition for all registered teams. The
              first mystery clue will become available, and the official event
              timer will start.
            </p>
            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-modal-btn secondary"
                onClick={closeModal}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-modal-btn primary"
                onClick={proceedToStartModal2}
                disabled={actionLoading}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          CONFIRMATION MODAL 2 — START EVENT (TYPED CONFIRMATION)
          ========================================================= */}
      {modalFlow === "start_2" && (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true">
          <div className="admin-modal-card">
            <span className="admin-modal-step-tag">
              CONFIRMATION 2 OF 2 • TYPED VERIFICATION
            </span>
            <h2 className="admin-modal-title">Final Confirmation</h2>
            <p className="admin-modal-message">
              You are about to start the Campus Quest event for every team. This
              action cannot be undone through the normal dashboard controls.
            </p>

            <div className="admin-modal-input-block">
              <label htmlFor="start-confirm-input">
                Type <strong>START EVENT</strong> to confirm:
              </label>
              <input
                id="start-confirm-input"
                type="text"
                className="admin-modal-input"
                placeholder="START EVENT"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                autoComplete="off"
                disabled={actionLoading}
              />
            </div>

            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-modal-btn secondary"
                onClick={() => {
                  setConfirmInput("");
                  setModalFlow("start_1");
                }}
                disabled={actionLoading}
              >
                Go Back
              </button>
              <button
                type="button"
                className="admin-modal-btn primary"
                disabled={confirmInput !== "START EVENT" || actionLoading}
                onClick={executeStartEvent}
              >
                {actionLoading ? "Starting..." : "Start Event"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          CONFIRMATION MODAL 1 — STOP EVENT
          ========================================================= */}
      {modalFlow === "stop_1" && (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true">
          <div className="admin-modal-card danger-modal">
            <span className="admin-modal-step-tag" style={{ color: "#ff8a80" }}>
              CONFIRMATION 1 OF 2 • EMERGENCY / EVENT SHUTDOWN
            </span>
            <h2 className="admin-modal-title">Stop the Entire Event?</h2>
            <p className="admin-modal-message">
              This will immediately end the competition for every team. Players
              will no longer be able to claim checkpoints or complete
              challenges.
            </p>
            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-modal-btn secondary"
                onClick={closeModal}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-modal-btn danger-final"
                onClick={proceedToStopModal2}
                disabled={actionLoading}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          CONFIRMATION MODAL 2 — STOP EVENT (TYPED CONFIRMATION)
          ========================================================= */}
      {modalFlow === "stop_2" && (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true">
          <div className="admin-modal-card danger-modal">
            <span className="admin-modal-step-tag" style={{ color: "#ff8a80" }}>
              CONFIRMATION 2 OF 2 • TYPED SHUTDOWN VERIFICATION
            </span>
            <h2 className="admin-modal-title">Confirm Event Shutdown</h2>
            <p className="admin-modal-message">
              This action affects every participating team. All current progress
              will be preserved, but the competition will stop and results will
              be frozen.
            </p>

            <div className="admin-modal-input-block">
              <label htmlFor="stop-confirm-input" style={{ color: "#ff8a80" }}>
                Type <strong>STOP EVENT</strong> to confirm:
              </label>
              <input
                id="stop-confirm-input"
                type="text"
                className="admin-modal-input"
                placeholder="STOP EVENT"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                autoComplete="off"
                disabled={actionLoading}
              />
            </div>

            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-modal-btn secondary"
                onClick={() => {
                  setConfirmInput("");
                  setModalFlow("stop_1");
                }}
                disabled={actionLoading}
              >
                Go Back
              </button>
              <button
                type="button"
                className="admin-modal-btn danger-final"
                disabled={confirmInput !== "STOP EVENT" || actionLoading}
                onClick={executeStopEvent}
              >
                {actionLoading ? "Stopping..." : "Stop Event"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          CONFIRMATION MODAL — FINALIZE RESULTS
          ========================================================= */}
      {modalFlow === "finalize" && (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true">
          <div className="admin-modal-card">
            <span className="admin-modal-step-tag">
              OFFICIAL STANDINGS FINALIZATION
            </span>
            <h2 className="admin-modal-title">Finalize Official Results?</h2>
            <p className="admin-modal-message">
              This will transition the event from stopped to completed, preserve
              the frozen results, and mark the race standings as official.
            </p>
            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-modal-btn secondary"
                onClick={closeModal}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-modal-btn primary"
                onClick={executeFinalizeEvent}
                disabled={actionLoading}
              >
                {actionLoading ? "Finalizing..." : "Finalize Results"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default AdminDashboard;
