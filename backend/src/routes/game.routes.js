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

router.get("/config", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({
    apiBaseUrl: process.env.PUBLIC_API_BASE_URL,
  });
});

module.exports = router;
