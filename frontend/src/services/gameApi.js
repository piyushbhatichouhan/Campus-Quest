import { auth, initializeFirebase } from "../config/firebase";
import { getConfig, normalizeApiUrl } from "../config";

async function getApiBaseUrl() {
  const envUrl =
    import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_API_URL;
  if (envUrl && String(envUrl).trim()) {
    return normalizeApiUrl(envUrl);
  }

  const config = await getConfig();
  return normalizeApiUrl(config.apiBaseUrl);
}

async function request(endpoint, options = {}, requiresAuth = true) {
  let token = null;

  if (requiresAuth) {
    try {
      const { auth: firebaseAuth } = await initializeFirebase();
      const activeUser = firebaseAuth?.currentUser || auth?.currentUser;
      if (activeUser) {
        token = await activeUser.getIdToken();
      }
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
    const err = new Error(
      result.error?.message || "Session expired. Please log in again.",
    );
    err.status = 401;
    err.code = result.error?.code || "UNAUTHORIZED";
    throw err;
  }

  if (!response.ok || !result.success) {
    const err = new Error(
      result.error?.message || "Something went wrong. Please try again.",
    );
    err.status = response.status;
    err.code = result.error?.code || "API_ERROR";
    throw err;
  }

  return result.data;
}

export const gameApi = {
  // Public Event Status
  getEventStatus() {
    return request("/event/status", {}, false);
  },

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

  createTeam(teamName, leaderName) {
    return request("/teams/create", {
      method: "POST",
      body: JSON.stringify({ teamName, leaderName }),
    });
  },

  joinTeam(joinCode, displayName) {
    return request("/teams/join", {
      method: "POST",
      body: JSON.stringify({ joinCode, displayName }),
    });
  },

  getMyTeam() {
    return request("/teams/me");
  },

  leaveTeam() {
    return request("/teams/leave", {
      method: "POST",
    });
  },

  removeMember(memberUid) {
    return request(`/teams/members/${encodeURIComponent(memberUid)}/remove`, {
      method: "POST",
    });
  },

  getTeamEvents(since = 0) {
    return request(`/teams/events?since=${encodeURIComponent(since)}`);
  },

  // Administrator Event Control & Analytics APIs
  getAdminEvent() {
    return request("/admin/event");
  },

  adminStartEvent() {
    return request("/admin/event/start", {
      method: "POST",
    });
  },

  adminStopEvent() {
    return request("/admin/event/stop", {
      method: "POST",
    });
  },

  adminFinalizeEvent() {
    return request("/admin/event/finalize", {
      method: "POST",
    });
  },

  adminStartNewEvent({ startImmediately = false, clearTeams = false } = {}) {
    return request("/admin/event/new", {
      method: "POST",
      body: JSON.stringify({ startImmediately, clearTeams }),
    });
  },

  getAdminOverview() {
    return request("/admin/overview");
  },

  getAdminTeams() {
    return request("/admin/teams");
  },

  getAdminTeamDetail(teamId) {
    return request(`/admin/teams/${encodeURIComponent(teamId)}`);
  },

  getAdminLeaderboard() {
    return request("/admin/leaderboard");
  },

  getCheckpointAnalytics(checkpointId) {
    return request(
      `/admin/checkpoints/${encodeURIComponent(checkpointId)}/leaderboard`,
    );
  },
};
