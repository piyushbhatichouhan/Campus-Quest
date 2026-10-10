import { auth } from "../config/firebase";

// Support both VITE_API_BASE_URL and VITE_API_URL with automatic /api normalization
const rawUrl =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

const trimmedUrl = rawUrl.replace(/\/+$/, "");
const API_BASE_URL = trimmedUrl.endsWith("/api")
  ? trimmedUrl
  : `${trimmedUrl}/api`;

async function request(endpoint, options = {}, requiresAuth = true) {
  let token = null;

  if (requiresAuth && auth.currentUser) {
    try {
      token = await auth.currentUser.getIdToken();
    } catch (err) {
      console.warn("Could not retrieve ID token:", err.message);
    }
  }

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      "Cannot connect to the game server. Check that the backend is running.",
    );
  }

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("The server returned an invalid response.");
  }

  if (response.status === 401) {
    throw new Error(
      result.error?.message || "Session expired. Please log in again.",
    );
  }

  if (!response.ok || !result.success) {
    throw new Error(
      result.error?.message || "Something went wrong. Please try again.",
    );
  }

  return result.data;
}

export const gameApi = {
  getCheckpoints() {
    return request("/checkpoints", {}, false);
  },

  startGame(displayName) {
    return request("/game/start", {
      method: "POST",
      body: JSON.stringify({ displayName }),
    });
  },

  getGameState() {
    return request("/game/state");
  },

  claimCheckpoint(checkpointId, latitude, longitude) {
    return request(
      `/game/checkpoints/${encodeURIComponent(checkpointId)}/claim`,
      {
        method: "POST",
        body: JSON.stringify({ latitude, longitude }),
      },
    );
  },

  submitChallenge(checkpointId, answer) {
    return request(
      `/game/checkpoints/${encodeURIComponent(checkpointId)}/challenge`,
      {
        method: "POST",
        body: JSON.stringify({ answer }),
      },
    );
  },

  getLeaderboard() {
    return request("/leaderboard", {}, true);
  },
};
