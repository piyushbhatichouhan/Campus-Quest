const express = require("express");
const { requireAuth, optionalAuth } = require("../middleware/requireAuth");
const { actionLimiter, challengeLimiter } = require("../middleware/security");

const {
  getCheckpoints,
  startGame,
  getGameState,
  claimCheckpoint,
  submitChallenge,
  getLeaderboard,
} = require("../services/game.service");

const teamRoutes = require("./team.routes");
const adminRoutes = require("./admin.routes");
const { getPublicEventStatus } = require("../services/event.service");

const router = express.Router();

function asyncHandler(handler) {
  return (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);
}

// Team management routes (/api/teams/...)
router.use("/teams", teamRoutes);

// Admin management routes (/api/admin/...)
router.use("/admin", adminRoutes);

// Public Event Status endpoint (/api/event/status)
router.get(
  "/event/status",
  asyncHandler(async (req, res) => {
    const data = await getPublicEventStatus();
    res.json({ success: true, data });
  }),
);

// Public checkpoint definitions, without correct answers.
router.get(
  "/checkpoints",
  asyncHandler(async (req, res) => {
    const data = await getCheckpoints();
    res.json({ success: true, data });
  }),
);

// Protected: Initialize or start game for authenticated user
router.post(
  "/game/start",
  requireAuth,
  actionLimiter,
  asyncHandler(async (req, res) => {
    const data = await startGame(req.user, req.body?.displayName);
    res.json({ success: true, data });
  }),
);

// Protected: Get current authenticated player's game state
router.get(
  "/game/state",
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = await getGameState(req.user.uid);
    res.json({ success: true, data });
  }),
);

// Protected: Claim active checkpoint for authenticated user
router.post(
  "/game/checkpoints/:id/claim",
  requireAuth,
  actionLimiter,
  asyncHandler(async (req, res) => {
    const { latitude, longitude } = req.body;

    const data = await claimCheckpoint(
      req.user.uid,
      req.params.id,
      latitude,
      longitude,
    );

    res.json({ success: true, data });
  }),
);

// Protected: Submit challenge answer for authenticated user (Strictly rate-limited)
router.post(
  "/game/checkpoints/:id/challenge",
  requireAuth,
  challengeLimiter,
  asyncHandler(async (req, res) => {
    const { answer } = req.body;

    const data = await submitChallenge(req.user.uid, req.params.id, answer);

    res.json({ success: true, data });
  }),
);

// Optional Auth: Get public race leaderboard
router.get(
  "/leaderboard",
  optionalAuth,
  actionLimiter,
  asyncHandler(async (req, res) => {
    const data = await getLeaderboard(req.user?.uid);
    res.json({ success: true, data });
  }),
);

const { cert } = require("firebase-admin/app");

const DEFAULT_FIREBASE_WEB_CONFIG = {
  apiKey: "AIzaSyBhoeX1soM8UFXCfs9VNb1ConGlh9LYzm0",
  authDomain: "campusquest-877f2.firebaseapp.com",
  projectId: "campusquest-877f2",
  storageBucket: "campusquest-877f2.firebasestorage.app",
  messagingSenderId: "719452934708",
  appId: "1:719452934708:web:a4e29462d405e47716b061",
};

let cachedFirebaseConfig = null;

function parseServiceAccountFromEnv() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return null;
  try {
    const parsed =
      typeof process.env.FIREBASE_SERVICE_ACCOUNT_JSON === "string"
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON.trim())
        : process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (
      typeof parsed.private_key === "string" &&
      parsed.private_key.includes("\\n")
    ) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return parsed;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 3000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function resolvePublicFirebaseConfig() {
  if (cachedFirebaseConfig && cachedFirebaseConfig.apiKey) {
    return cachedFirebaseConfig;
  }

  const serviceAccount = parseServiceAccountFromEnv();
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    serviceAccount?.project_id ||
    DEFAULT_FIREBASE_WEB_CONFIG.projectId;

  let remoteConfig = {};

  const envApiKey =
    process.env.FIREBASE_API_KEY ||
    process.env.VITE_FIREBASE_API_KEY ||
    serviceAccount?.apiKey ||
    serviceAccount?.api_key;

  // 1. If service account credentials are provided in FIREBASE_SERVICE_ACCOUNT_JSON,
  // attempt to fetch the Web App config via Firebase Management API
  if (!envApiKey && serviceAccount?.client_email && serviceAccount?.private_key) {
    try {
      const credential = cert(serviceAccount);
      const tokenObj = await credential.getAccessToken();
      if (tokenObj?.access_token) {
        const res = await fetchWithTimeout(
          `https://firebase.googleapis.com/v1beta1/projects/${encodeURIComponent(projectId)}/webApps/-/config`,
          {
            headers: {
              Authorization: `Bearer ${tokenObj.access_token}`,
            },
          },
        );
        if (res.ok) {
          remoteConfig = await res.json();
        }
      }
    } catch {
      // Fall through to Firebase Hosting init.json discovery
    }
  }

  // 2. If still no apiKey, fetch from Firebase Hosting's public init.json for the projectId
  if (!envApiKey && !remoteConfig.apiKey && process.env.NODE_ENV !== "test") {
    try {
      const res = await fetchWithTimeout(
        `https://${projectId}.web.app/__/firebase/init.json`,
      );
      if (res.ok) {
        remoteConfig = await res.json();
      }
    } catch {
      // Fall through to default project configuration
    }
  }

  const isDefaultProject = projectId === DEFAULT_FIREBASE_WEB_CONFIG.projectId;
  const fallback = isDefaultProject ? DEFAULT_FIREBASE_WEB_CONFIG : {};

  const resolved = {
    apiKey:
      envApiKey ||
      remoteConfig.apiKey ||
      fallback.apiKey ||
      "",
    authDomain:
      process.env.FIREBASE_AUTH_DOMAIN ||
      process.env.VITE_FIREBASE_AUTH_DOMAIN ||
      serviceAccount?.authDomain ||
      remoteConfig.authDomain ||
      fallback.authDomain ||
      `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket:
      process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.VITE_FIREBASE_STORAGE_BUCKET ||
      serviceAccount?.storageBucket ||
      remoteConfig.storageBucket ||
      fallback.storageBucket ||
      `${projectId}.firebasestorage.app`,
    messagingSenderId:
      process.env.FIREBASE_MESSAGING_SENDER_ID ||
      process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
      serviceAccount?.messagingSenderId ||
      remoteConfig.messagingSenderId ||
      fallback.messagingSenderId ||
      "",
    appId:
      process.env.FIREBASE_APP_ID ||
      process.env.VITE_FIREBASE_APP_ID ||
      serviceAccount?.appId ||
      remoteConfig.appId ||
      fallback.appId ||
      "",
  };

  if (resolved.apiKey) {
    cachedFirebaseConfig = resolved;
  }

  return resolved;
}

router.get(
  "/config",
  asyncHandler(async (req, res) => {
    res.set("Cache-Control", "no-store");
    const firebaseConfig = await resolvePublicFirebaseConfig();
    const apiBaseUrl =
      process.env.PUBLIC_API_BASE_URL ||
      `${req.protocol}://${req.get("host")}/api`;

    res.json({
      apiBaseUrl,
      ...firebaseConfig,
      firebaseConfig,
    });
  }),
);

module.exports = router;
