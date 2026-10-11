import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getFriendlyErrorMessage } from "../utils/authErrors";
import "./Auth.css";

function Register() {
  const navigate = useNavigate();
  const { registerLeader, user } = useAuth();

  const [form, setForm] = useState({
    teamName: "",
    leaderName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setErrorMsg("");

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!form.teamName.trim() || form.teamName.trim().length < 2) {
      setErrorMsg("Please choose a team name (at least 2 characters).");
      return;
    }

    if (!form.leaderName.trim() || form.leaderName.trim().length < 2) {
      setErrorMsg("Please enter the team leader's name.");
      return;
    }

    if (form.password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      await registerLeader({
        email: form.email.trim(),
        password: form.password,
        leaderName: form.leaderName.trim(),
        teamName: form.teamName.trim(),
      });
      navigate("/lobby");
    } catch (err) {
      setErrorMsg(
        err.message?.includes("team")
          ? err.message
          : getFriendlyErrorMessage(err),
      );
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

      <section className="auth-container register-container">
        <div className="game-logo">
          <div className="logo-icon">
            <span>DQ</span>
          </div>

          <div>
            <h1>CAMPUS QUEST</h1>
            <p>Team Adventure</p>
          </div>
        </div>

        <div className="auth-card">
          <div className="card-top">
            <span className="pixel-diamond">◆</span>
            <h2>CREATE TEAM</h2>
            <span className="pixel-diamond">◆</span>
          </div>

          <p className="auth-subtitle">
            Register as Team Leader and invite up to 3 teammates.
          </p>

          {errorMsg && (
            <div className="auth-error-banner" role="alert">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-field">
              <label htmlFor="teamName">TEAM NAME</label>
              <input
                id="teamName"
                name="teamName"
                type="text"
                placeholder="e.g. Pixel Explorers"
                value={form.teamName}
                onChange={handleChange}
                required
                minLength={2}
                maxLength={30}
                autoComplete="organization"
                disabled={submitting}
              />
              <span className="field-hint">
                This name will appear on the campus leaderboard.
              </span>
            </div>

            <div className="form-field">
              <label htmlFor="leaderName">TEAM LEADER NAME</label>
              <input
                id="leaderName"
                name="leaderName"
                type="text"
                placeholder="Your name (e.g. Alex)"
                value={form.leaderName}
                onChange={handleChange}
                required
                minLength={2}
                maxLength={30}
                autoComplete="name"
                disabled={submitting}
              />
              <span className="field-hint">
                You will lead the team and manage the lobby.
              </span>
            </div>

            <div className="form-field">
              <label htmlFor="email">LEADER EMAIL</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="leader@example.com"
                value={form.email}
                onChange={handleChange}
                required
                autoComplete="email"
                disabled={submitting}
              />
            </div>

            <div className="form-field">
              <label htmlFor="password">PASSWORD</label>
              <div className="password-wrapper">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Password (min 6 chars)"
                  value={form.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  disabled={submitting}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? "HIDE" : "SHOW"}
                </button>
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="confirmPassword">CONFIRM PASSWORD</label>
              <div className="password-wrapper">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Repeat your password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                  disabled={submitting}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                >
                  {showConfirmPassword ? "HIDE" : "SHOW"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="pixel-button primary"
              disabled={submitting}
            >
              <span>{submitting ? "INITIALIZING TEAM..." : "CREATE & ENTER LOBBY"}</span>
              <span className="button-arrow">▶</span>
            </button>
          </form>

          <div className="auth-divider">
            <span />
            <p>HAVE A JOIN CODE?</p>
            <span />
          </div>

          <Link to="/join" className="pixel-button secondary" style={{ marginBottom: "8px" }}>
            JOIN TEAM WITH CODE
          </Link>

          <div className="auth-divider">
            <span />
            <p>RETURNING LEADER?</p>
            <span />
          </div>

          <Link to="/login" className="pixel-button secondary">
            RETURN TO LOGIN
          </Link>
        </div>

        <p className="auth-footer">
          CAMPUS QUEST <span>•</span> MULTIPLAYER ORIENTATION
        </p>
      </section>
    </main>
  );
}

export default Register;
