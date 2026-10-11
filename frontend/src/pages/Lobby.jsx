import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { gameApi } from "../services/gameApi";
import "./Lobby.css";

function Lobby() {
  const navigate = useNavigate();
  const { user, team: cachedTeam, refreshTeam, logout } = useAuth();

  const [team, setTeam] = useState(cachedTeam || null);
  const [loading, setLoading] = useState(!cachedTeam);
  const [starting, setStarting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);

  const isPollingRef = useRef(false);

  const fetchLobbyState = useCallback(async () => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;

    try {
      const data = await gameApi.getMyTeam();
      if (!data || !data.hasTeam) {
        navigate("/join");
        return;
      }

      setTeam(data);

      // If game has already started, redirect automatically to game view
      if (data.status === "active" || data.status === "completed") {
        navigate("/game");
      }
    } catch (err) {
      console.warn("Lobby sync notice:", err.message);
    } finally {
      isPollingRef.current = false;
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    let timerId = null;
    let isMounted = true;

    fetchLobbyState();

    const poll = async () => {
      if (!isMounted) return;
      if (document.visibilityState === "visible") {
        await fetchLobbyState();
      }
      if (isMounted) {
        timerId = window.setTimeout(poll, 3500);
      }
    };

    timerId = window.setTimeout(poll, 3500);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchLobbyState();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchLobbyState]);

  const handleCopyCode = async () => {
    if (!team?.joinCode) return;
    try {
      await navigator.clipboard.writeText(team.joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStartAdventure = async () => {
    if (starting) return;
    setStarting(true);
    setErrorMsg("");

    try {
      await gameApi.startAdventure();
      await refreshTeam();
      navigate("/game");
    } catch (err) {
      setErrorMsg(err.message || "Could not start adventure. Please try again.");
      setStarting(false);
    }
  };

  const handleLeaveTeam = async () => {
    const isAnonymous = user?.isAnonymous;
    const confirmMessage = isAnonymous
      ? "Warning: Signing out or leaving as a temporary member may prevent you from rejoining with the same identity. Continue?"
      : "Are you sure you want to leave this team lobby?";

    if (window.confirm(confirmMessage)) {
      try {
        await gameApi.leaveTeam();
        await refreshTeam();
        if (isAnonymous) {
          await logout();
          navigate("/join");
        } else {
          navigate("/register");
        }
      } catch (err) {
        setErrorMsg(err.message || "Failed to leave team.");
      }
    }
  };

  const handleKickMember = async (targetUid) => {
    if (!window.confirm("Remove this player from the team?")) return;
    try {
      await gameApi.removeMember(targetUid);
      await fetchLobbyState();
    } catch (err) {
      setErrorMsg(err.message || "Failed to remove member.");
    }
  };

  if (loading && !team) {
    return (
      <main className="lobby-page">
        <div className="lobby-card" style={{ textAlign: "center", color: "#fff" }}>
          CONNECTING TO LOBBY...
        </div>
      </main>
    );
  }

  const isLeader = Boolean(
    team && (team.isLeader || team.role === "leader" || team.leaderUid === user?.uid),
  );
  const members = team?.members || [];
  const memberCount = members.length || team?.memberCount || 1;
  const maxMembers = team?.maxMembers || 4;

  const emptySlotsCount = Math.max(0, maxMembers - memberCount);
  const emptySlots = Array.from({ length: emptySlotsCount });

  return (
    <main className="lobby-page">
      <div className="lobby-container">
        <div className="lobby-card">
          {/* HEADER */}
          <div className="lobby-header">
            <span className="lobby-kicker">CAMPUS QUEST LOBBY</span>
            <h1 className="lobby-team-name">{team?.name || "YOUR SQUAD"}</h1>
          </div>

          {/* JOIN CODE BOX */}
          <div className="lobby-code-box">
            <span className="lobby-code-label">TEAM JOIN CODE</span>
            <span className="lobby-code-value">{team?.joinCode || "------"}</span>
            <button
              type="button"
              className="lobby-copy-btn"
              onClick={handleCopyCode}
            >
              {copied ? "COPIED TO CLIPBOARD!" : "[ COPY CODE ]"}
            </button>
          </div>

          {/* ERROR MESSAGE */}
          {errorMsg && (
            <div
              style={{
                background: "#3b1111",
                border: "2px solid #e05252",
                color: "#ff9999",
                padding: "8px",
                fontSize: "10px",
                textAlign: "center",
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* ROSTER */}
          <section className="lobby-roster-section">
            <div className="lobby-roster-header">
              <span>SQUAD ROSTER</span>
              <span className="lobby-member-count">
                MEMBERS ({memberCount}/{maxMembers})
              </span>
            </div>

            <div className="lobby-roster-list">
              {members.map((member) => {
                const isMemberLeader =
                  member.role === "leader" || member.uid === team?.leaderUid;
                const isCurrentUser = member.uid === user?.uid;

                return (
                  <div key={member.uid} className="lobby-member-item">
                    <div className="lobby-member-info">
                      {isMemberLeader && (
                        <span className="lobby-leader-star">★</span>
                      )}
                      <strong>{member.displayName}</strong>
                      {isMemberLeader && (
                        <span className="lobby-leader-badge">(Leader)</span>
                      )}
                      {isCurrentUser && (
                        <span className="lobby-you-badge">YOU</span>
                      )}
                    </div>

                    {isLeader && !isMemberLeader && (
                      <button
                        type="button"
                        className="lobby-kick-btn"
                        onClick={() => handleKickMember(member.uid)}
                      >
                        REMOVE
                      </button>
                    )}
                  </div>
                );
              })}

              {emptySlots.map((_, index) => (
                <div key={index} className="lobby-empty-slot">
                  Waiting for teammate {memberCount + index + 1}...
                </div>
              ))}
            </div>
          </section>

          {/* STATUS BANNER */}
          <div className="lobby-status-banner">
            <span className="pulse-dot" />
            <span>
              {isLeader
                ? "You can start the adventure whenever your squad is ready."
                : "Waiting for team leader to start the adventure..."}
            </span>
          </div>

          {/* ACTIONS */}
          {isLeader ? (
            <button
              type="button"
              className="lobby-start-btn"
              onClick={handleStartAdventure}
              disabled={starting}
            >
              {starting ? "STARTING ADVENTURE..." : "[ START ADVENTURE ]"}
            </button>
          ) : (
            <div style={{ textAlign: "center", fontSize: "9px", color: "#858c93" }}>
              Only the team leader can start the adventure.
            </div>
          )}

          <button
            type="button"
            className="lobby-leave-btn"
            onClick={handleLeaveTeam}
          >
            {isLeader ? "DISBAND / LEAVE LOBBY" : "LEAVE SQUAD"}
          </button>
        </div>
      </div>
    </main>
  );
}

export default Lobby;
