import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getFriendlyErrorMessage } from "../utils/authErrors";
import "./Auth.css";

function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [form, setForm] = useState({
    username: "",
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

    if (!form.username.trim()) {
      setErrorMsg("Please choose a player name.");
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
      await register(form.email.trim(), form.password, form.username.trim());
      navigate("/game");
    } catch (err) {
      setErrorMsg(getFriendlyErrorMessage(err));
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
            <h1>DAVV QUEST</h1>
            <p>Campus Adventure</p>
          </div>
        </div>

        <div className="auth-card">
          <div className="card-top">
            <span className="pixel-diamond">◆</span>
            <h2>CREATE PLAYER</h2>
            <span className="pixel-diamond">◆</span>
          </div>

          <p className="auth-subtitle">
            Create your character and begin your quest.
          </p>

          {errorMsg && (
            <div className="auth-error-banner" role="alert">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-field">
              <label htmlFor="username">PLAYER NAME</label>

              <input
                id="username"
                name="username"
                type="text"
                placeholder="Choose your player name"
                value={form.username}
                onChange={handleChange}
                required
                minLength={2}
                maxLength={24}
                autoComplete="username"
                disabled={submitting}
              />

              <span className="field-hint">
                This name will appear on the leaderboard.
              </span>
            </div>

            <div className="form-field">
              <label htmlFor="email">PLAYER EMAIL</label>

              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
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
                  placeholder="Create a password (min 6 chars)"
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
                  placeholder="Enter password again"
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
              <span>{submitting ? "CREATING..." : "START ADVENTURE"}</span>
              <span className="button-arrow">▶</span>
            </button>
          </form>

          <div className="auth-divider">
            <span />
            <p>ALREADY A PLAYER?</p>
            <span />
          </div>

          <Link to="/login" className="pixel-button secondary">
            RETURN TO LOGIN
          </Link>
        </div>

        <p className="auth-footer">
          DAVV CAMPUS QUEST <span>•</span> ADVENTURE AWAITS
        </p>
      </section>
    </main>
  );
}

export default Register;
