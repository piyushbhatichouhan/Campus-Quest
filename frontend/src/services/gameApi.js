import { auth } from "../config/firebase";

// Support both VITE_API_BASE_URL and VITE_API_URL with automatic /api normalization
const CONFIG_URL = "https://campus-quest-cqa8.onrender.com/api/config";

let apiBaseUrlPromise;

async function getApiBaseUrl() {
  if (!apiBaseUrlPromise) {
    apiBaseUrlPromise = fetch(CONFIG_URL)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load API configuration.");
        }

        const config = await response.json();

        if (!config.apiBaseUrl) {
          throw new Error("Backend API URL is missing.");
        }

        const trimmedUrl = config.apiBaseUrl.replace(/\/+$/, "");

        return trimmedUrl.endsWith("/api") ? trimmedUrl : `${trimmedUrl}/api`;
      })
      .catch((error) => {
        apiBaseUrlPromise = null;
        throw error;
      });
  }

  return apiBaseUrlPromise;
}

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
    const apiBaseUrl = await getApiBaseUrl();

    response = await fetch(`${apiBaseUrl}${endpoint}`, {
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
