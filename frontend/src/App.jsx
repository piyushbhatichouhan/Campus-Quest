import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Game from "./pages/Game";
import Leaderboard from "./pages/Leaderboard";
import Profile from "./pages/Profile";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        className="auth-page"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <p
          style={{
            color: "#fff",
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "12px",
            textAlign: "center",
          }}
        >
          AUTHENTICATING...
        </p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        className="auth-page"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <p
          style={{
            color: "#fff",
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "12px",
            textAlign: "center",
          }}
        >
          AUTHENTICATING...
        </p>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/game" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public Authentication */}
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
      <Route path="/" element={<Navigate to="/game" replace />} />
      <Route path="*" element={<Navigate to="/game" replace />} />
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
