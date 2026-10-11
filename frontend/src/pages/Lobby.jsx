/* eslint-disable react-hooks/set-state-in-effect */
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
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmKickUid, setConfirmKickUid] = useState(null);

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

      const effectiveStatus = data.eventStatus || data.status;
      // If administrator has started (or stopped/finalized) the event, transition automatically
      if (
        effectiveStatus === "active" ||
        effectiveStatus === "stopped" ||
        effectiveStatus === "completed"
      ) {
        await refreshTeam();
        navigate("/game");
      }
    } catch (err) {
      console.warn("Lobby sync notice:", err.message);
    } finally {
      isPollingRef.current = false;
      setLoading(false);
    }
  }, [navigate, refreshTeam]);

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
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const executeLeaveTeam = async () => {
    const isAnonymous = user?.isAnonymous;
    setConfirmLeave(false);
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
  };

  const executeKickMember = async (targetUid) => {
    setConfirmKickUid(null);
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
  const teamNameUpper = (team?.name || "YOUR SQUAD").toUpperCase();

  const emptySlotsCount = Math.max(0, maxMembers - memberCount);
  const emptySlots = Array.from({ length: emptySlotsCount });

  return (
    <main className="lobby-page">
      <div className="lobby-container">
        <div className="lobby-card">
          {/* HEADER SUMMARY */}
          <div className="lobby-header">
            <span className="lobby-kicker">CAMPUS QUEST</span>
            <h1 className="lobby-team-name">TEAM: {teamNameUpper}</h1>
            <div className="lobby-members-summary">
              MEMBERS: {memberCount}/{maxMembers}
            </div>
          </div>

          {/* WAITING FOR THE EVENT TO START BANNER */}
          <div className="lobby-waiting-hero" role="status" aria-live="polite">
            <div className="lobby-waiting-badge">
              <span className="pulse-dot" />
              <span>WAITING FOR THE EVENT TO START</span>
            </div>
            <p className="lobby-waiting-copy">
              The administrator will begin the adventure.
              <br />
              Get ready to explore!
            </p>
            <div className="lobby-mystery-locked-note">
              🔒 FIRST MYSTERY CLUE LOCKED UNTIL OFFICIAL EVENT START
            </div>
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
            <div className="lobby-error-banner" role="alert">
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
                      confirmKickUid === member.uid ? (
                        <div className="lobby-inline-confirm">
                          <button
                            type="button"
                            className="lobby-kick-btn"
                            onClick={() => executeKickMember(member.uid)}
                          >
                            CONFIRM
                          </button>
                          <button
                            type="button"
                            className="lobby-cancel-mini-btn"
                            onClick={() => setConfirmKickUid(null)}
                          >
                            CANCEL
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="lobby-kick-btn"
                          onClick={() => setConfirmKickUid(member.uid)}
                        >
                          REMOVE
                        </button>
                      )
                    )}
                  </div>
                );
              })}

              {emptySlots.map((_, index) => (
                <div key={index} className="lobby-empty-slot">
                  Waiting for teammate {memberCount + index + 1} (optional)...
                </div>
              ))}
            </div>
          </section>

          {/* LEAVE CONFIRMATION OR BUTTON */}
          {confirmLeave ? (
            <div className="lobby-confirm-box">
              <p>
                {user?.isAnonymous
                  ? "Leaving as a temporary member may prevent you from rejoining with the same identity. Continue?"
                  : "Are you sure you want to leave this team lobby?"}
              </p>
              <div className="lobby-confirm-actions">
                <button
                  type="button"
                  className="lobby-cancel-mini-btn"
                  onClick={() => setConfirmLeave(false)}
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  className="lobby-kick-btn"
                  onClick={executeLeaveTeam}
                >
                  CONFIRM LEAVE
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="lobby-leave-btn"
              onClick={() => setConfirmLeave(true)}
            >
              {isLeader ? "DISBAND / LEAVE LOBBY" : "LEAVE SQUAD"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

export default Lobby;
