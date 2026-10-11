const express = require("express");
const { requireAuth } = require("../middleware/requireAuth");
const { requireAdmin } = require("../middleware/requireAdmin");
const { actionLimiter } = require("../middleware/security");
const {
  getPublicEventStatus,
  startEvent,
  stopEvent,
  finalizeEvent,
  getAdminOverview,
  getAdminTeamsList,
  getAdminTeamDetail,
  getCheckpointAnalytics,
} = require("../services/event.service");
const {
  getLeaderboard,
  adminGetPlayersList,
  adminResetPlayerProgress,
} = require("../services/game.service");

const router = express.Router();

function asyncHandler(handler) {
  return (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);
}

// All admin routes require authentication AND admin privileges
router.use(requireAuth, requireAdmin);

// GET /api/admin/event - Current event lifecycle state and timestamps
router.get(
  "/event",
  asyncHandler(async (req, res) => {
    const data = await getPublicEventStatus();
    res.json({ success: true, data });
  }),
);

// POST /api/admin/event/start - Start event across all teams (waiting -> active)
router.post(
  "/event/start",
  actionLimiter,
  asyncHandler(async (req, res) => {
    const data = await startEvent(req.user);
    res.json({ success: true, data });
  }),
);

// POST /api/admin/event/stop - Stop event and freeze gameplay (active -> stopped)
router.post(
  "/event/stop",
  actionLimiter,
  asyncHandler(async (req, res) => {
    const data = await stopEvent(req.user);
    res.json({ success: true, data });
  }),
);

// POST /api/admin/event/finalize - Finalize official competition standings (stopped -> completed)
router.post(
  "/event/finalize",
  actionLimiter,
  asyncHandler(async (req, res) => {
    const data = await finalizeEvent(req.user);
    res.json({ success: true, data });
  }),
);

// GET /api/admin/overview - Overall event metrics
router.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const data = await getAdminOverview();
    res.json({ success: true, data });
  }),
);

// GET /api/admin/teams - List all participating squads
router.get(
  "/teams",
  asyncHandler(async (req, res) => {
    const data = await getAdminTeamsList();
    res.json({ success: true, data });
  }),
);

// GET /api/admin/teams/:teamId - Inspect squad detail and checkpoint timeline
router.get(
  "/teams/:teamId",
  asyncHandler(async (req, res) => {
    const data = await getAdminTeamDetail(req.params.teamId);
    res.json({ success: true, data });
  }),
);

// GET /api/admin/leaderboard - Official race standings
router.get(
  "/leaderboard",
  asyncHandler(async (req, res) => {
    const data = await getLeaderboard(null);
    res.json({ success: true, data });
  }),
);

// GET /api/admin/checkpoints/:checkpointId/leaderboard - Checkpoint arrival analytics
router.get(
  "/checkpoints/:checkpointId/leaderboard",
  asyncHandler(async (req, res) => {
    const data = await getCheckpointAnalytics(req.params.checkpointId);
    res.json({ success: true, data });
  }),
);

// Preserved admin routes
router.get(
  "/players",
  asyncHandler(async (req, res) => {
    const data = await adminGetPlayersList();
    res.json({ success: true, data });
  }),
);

router.post(
  "/players/:uid/reset",
  asyncHandler(async (req, res) => {
    const data = await adminResetPlayerProgress(req.params.uid);
    res.json({ success: true, data });
  }),
);

module.exports = router;
