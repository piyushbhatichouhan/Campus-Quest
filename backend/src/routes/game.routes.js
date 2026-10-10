const express = require("express");
const { requireAuth, optionalAuth } = require("../middleware/requireAuth");
const { requireAdmin } = require("../middleware/requireAdmin");
const { actionLimiter, challengeLimiter } = require("../middleware/security");

const {
  getCheckpoints,
  startGame,
  getGameState,
  claimCheckpoint,
  submitChallenge,
  getLeaderboard,
  adminGetPlayersList,
  adminResetPlayerProgress,
} = require("../services/game.service");

const router = express.Router();

function asyncHandler(handler) {
  return (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);
}

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

// Optional Auth: Get public leaderboard
router.get(
  "/leaderboard",
  optionalAuth,
  actionLimiter,
  asyncHandler(async (req, res) => {
    const data = await getLeaderboard(req.user?.uid);
    res.json({ success: true, data });
  }),
);

// =========================================================================
// ADMIN ROUTES (Protected by requireAuth and requireAdmin)
// =========================================================================

router.get(
  "/admin/players",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = await adminGetPlayersList();
    res.json({ success: true, data });
  }),
);

router.post(
  "/admin/players/:uid/reset",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = await adminResetPlayerProgress(req.params.uid);
    res.json({ success: true, data });
  }),
);

module.exports = router;
