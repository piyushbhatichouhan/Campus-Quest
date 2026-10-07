import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Auth.css";

function Login() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Temporary authentication.
    // Firebase Authentication will replace this later.
    console.log("Login:", form);

    navigate("/game");
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
            <h1>DAVV QUEST</h1>
            <p>Campus Adventure</p>
          </div>
        </div>

        <div className="auth-card">
          <div className="card-top">
            <span className="pixel-diamond">◆</span>
            <h2>WELCOME BACK</h2>
            <span className="pixel-diamond">◆</span>
          </div>

          <p className="auth-subtitle">Return to your adventure.</p>

          <form onSubmit={handleSubmit} className="auth-form">
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
              />
            </div>

            <div className="form-field">
              <label htmlFor="password">PASSWORD</label>

              <div className="password-wrapper">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "HIDE" : "SHOW"}
                </button>
              </div>
            </div>

            <div className="form-options">
              <label className="remember-option">
                <input type="checkbox" />
                <span className="pixel-checkbox" />
                Remember me
              </label>

              <button type="button" className="text-button">
                Forgot password?
              </button>
            </div>

            <button type="submit" className="pixel-button primary">
              <span>ENTER WORLD</span>
              <span className="button-arrow">▶</span>
            </button>
          </form>

          <div className="auth-divider">
            <span />
            <p>NEW PLAYER?</p>
            <span />
          </div>

          <Link to="/register" className="pixel-button secondary">
            CREATE ACCOUNT
          </Link>
        </div>

        <p className="auth-footer">
          DAVV CAMPUS QUEST <span>•</span> ADVENTURE AWAITS
        </p>
      </section>
    </main>
  );
}

export default Login;
