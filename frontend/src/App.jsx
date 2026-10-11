import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";

import Login from "./pages/Login";
import Register from "./pages/Register";
import JoinTeam from "./pages/JoinTeam";
import Lobby from "./pages/Lobby";
import Game from "./pages/Game";
import Leaderboard from "./pages/Leaderboard";
import Profile from "./pages/Profile";

function LoadingScreen() {
  return (
    <div
      className="auth-page"
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "#1a1c1e",
      }}
    >
      <p
        style={{
          color: "#fff",
          fontFamily: "'Press Start 2P', monospace",
          fontSize: "12px",
          textAlign: "center",
          letterSpacing: "1px",
        }}
      >
        AUTHENTICATING CAMPUS QUEST...
      </p>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading, team, teamLoading } = useAuth();

  if (loading || teamLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If user is logged in but has no team, route to appropriate team setup/join
  if (!team || !team.hasTeam) {
    if (user.isAnonymous) {
      return <Navigate to="/join" replace />;
    }
    return <Navigate to="/register" replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { user, loading, team, teamLoading } = useAuth();

  if (loading || teamLoading) {
    return <LoadingScreen />;
  }

  if (user && team && team.hasTeam) {
    if (team.status === "waiting") {
      return <Navigate to="/lobby" replace />;
    }
    return <Navigate to="/game" replace />;
  }

  return children;
}

function RootRedirect() {
  const { user, loading, team, teamLoading } = useAuth();

  if (loading || teamLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!team || !team.hasTeam) {
    if (user.isAnonymous) {
      return <Navigate to="/join" replace />;
    }
    return <Navigate to="/register" replace />;
  }

  if (team.status === "waiting") {
    return <Navigate to="/lobby" replace />;
  }

  return <Navigate to="/game" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public Authentication & Join Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />
      <Route
        path="/join"
        element={
          <PublicRoute>
            <JoinTeam />
          </PublicRoute>
        }
      />

      {/* Team Lobby */}
      <Route
        path="/lobby"
        element={
          <ProtectedRoute>
            <Lobby />
          </ProtectedRoute>
        }
      />

      {/* Protected Gameplay & Player pages */}
      <Route
        path="/game"
        element={
          <ProtectedRoute>
            <Game />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leaderboard"
        element={
          <ProtectedRoute>
            <Leaderboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />

      {/* Default & Fallback */}
      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
