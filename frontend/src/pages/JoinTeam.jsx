import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { gameApi } from "../services/gameApi";
import "./Auth.css";

function JoinTeam() {
  const navigate = useNavigate();
  const { joinAsMember } = useAuth();

  const [form, setForm] = useState({
    joinCode: "",
    playerName: "",
  });

  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [eventStatus, setEventStatus] = useState("waiting");

  useEffect(() => {
    let active = true;
    gameApi
      .getEventStatus()
      .then((res) => {
        if (active && res?.status) {
          setEventStatus(res.status);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const joiningClosed = eventStatus !== "waiting";

  const handleChange = (e) => {
    const { name, value } = e.target;
    setErrorMsg("");

    setForm((prev) => ({
      ...prev,
      [name]: name === "joinCode" ? value.toUpperCase().trim() : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (joiningClosed) {
      setErrorMsg(
        "Team joining is closed because the Campus Quest event has already started.",
      );
      return;
    }

    const code = form.joinCode.trim().toUpperCase();
    const name = form.playerName.trim();

    if (!code || code.length !== 6) {
      setErrorMsg("Please enter a valid 6-character team code.");
      return;
    }

    if (!name || name.length < 2) {
      setErrorMsg("Please enter your player name (at least 2 characters).");
      return;
    }

    setSubmitting(true);

    try {
      await joinAsMember(code, name);
      navigate("/lobby");
    } catch (err) {
      setErrorMsg(err.message || "Failed to join team. Please check the code.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-background">
        <div className="pixel-cloud cloud-one" />
        <div className="pixel-cloud cloud-two" />

        <div className="mountain mountain-one" />
        <div className="mountain mountain-two" />
      </div>

      <section className="auth-container">
        <div className="game-logo">
          <div className="logo-icon">
            <span>DQ</span>
          </div>

          <div>
            <h1>CAMPUS QUEST</h1>
            <p>Join Team</p>
          </div>
        </div>

        <div className="auth-card">
          <div className="card-top">
            <span className="pixel-diamond">◆</span>
            <h2>JOIN A SQUAD</h2>
            <span className="pixel-diamond">◆</span>
          </div>

          <p className="auth-subtitle">
            Enter the 6-character code provided by your team leader.
          </p>

          {joiningClosed && (
            <div className="auth-error-banner" role="status">
              🔒 TEAM JOINING CLOSED: The Campus Quest event is currently{" "}
              {eventStatus.toUpperCase()}. Team rosters are locked once the
              event starts.
            </div>
          )}

          {errorMsg && (
            <div className="auth-error-banner" role="alert">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-field">
              <label htmlFor="joinCode">6-CHARACTER TEAM CODE</label>

              <input
                id="joinCode"
                name="joinCode"
                type="text"
                placeholder="e.g. PX7K2M"
                value={form.joinCode}
                onChange={handleChange}
                required
                maxLength={6}
                autoComplete="off"
                disabled={submitting || joiningClosed}
                style={{
                  textTransform: "uppercase",
                  letterSpacing: "3px",
                  fontSize: "18px",
                  fontWeight: "bold",
                  textAlign: "center",
                }}
              />

              <span className="field-hint">
                Ask your team leader for the 6-letter team code.
              </span>
            </div>

            <div className="form-field">
              <label htmlFor="playerName">YOUR PLAYER NAME</label>

              <input
                id="playerName"
                name="playerName"
                type="text"
                placeholder="Choose your display name"
                value={form.playerName}
                onChange={handleChange}
                required
                minLength={2}
                maxLength={24}
                autoComplete="name"
                disabled={submitting || joiningClosed}
              />

              <span className="field-hint">
                No email or password needed to join as a teammate.
              </span>
            </div>

            <button
              type="submit"
              className="pixel-button primary"
              disabled={submitting || joiningClosed}
            >
              <span>
                {joiningClosed
                  ? "ROSTERS LOCKED"
                  : submitting
                    ? "CONNECTING TO SQUAD..."
                    : "JOIN TEAM"}
              </span>
              <span className="button-arrow">▶</span>
            </button>
          </form>

          <div className="auth-divider">
            <span />
            <p>ARE YOU A LEADER?</p>
            <span />
          </div>

          <Link to="/register" className="pixel-button secondary" style={{ marginBottom: "8px" }}>
            CREATE A NEW TEAM
          </Link>

          <Link to="/login" className="pixel-button secondary">
            LEADER LOGIN
          </Link>
        </div>

        <p className="auth-footer">
          CAMPUS QUEST <span>•</span> QUICK ANONYMOUS JOIN
        </p>
      </section>
    </main>
  );
}

export default JoinTeam;
