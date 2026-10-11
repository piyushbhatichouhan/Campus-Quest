const express = require("express");
const { requireAuth } = require("../middleware/requireAuth");
const { actionLimiter } = require("../middleware/security");
const {
  createTeam,
  joinTeam,
  getMyTeam,
  startAdventure,
  leaveTeam,
  removeMember,
  getTeamEvents,
} = require("../services/team.service");

const router = express.Router();

function asyncHandler(handler) {
  return (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);
}

// POST /api/teams/create - Leader creates a team
router.post(
  "/create",
  requireAuth,
  actionLimiter,
  asyncHandler(async (req, res) => {
    const { teamName, leaderName } = req.body;
    const data = await createTeam(req.user, { teamName, leaderName });
    res.json({ success: true, data });
  }),
);

// POST /api/teams/join - Member joins team using 6-char code
router.post(
  "/join",
  requireAuth,
  actionLimiter,
  asyncHandler(async (req, res) => {
    const { joinCode, displayName } = req.body;
    const data = await joinTeam(req.user, { joinCode, displayName });
    res.json({ success: true, data });
  }),
);

// GET /api/teams/me - Current participant's team information and lobby roster
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = await getMyTeam(req.user.uid);
    res.json({ success: true, data });
  }),
);

// POST /api/teams/start - Leader starts the adventure
router.post(
  "/start",
  requireAuth,
  actionLimiter,
  asyncHandler(async (req, res) => {
    const data = await startAdventure(req.user);
    res.json({ success: true, data });
  }),
);

// POST /api/teams/leave - Member leaves team before adventure starts
router.post(
  "/leave",
  requireAuth,
  actionLimiter,
  asyncHandler(async (req, res) => {
    const data = await leaveTeam(req.user);
    res.json({ success: true, data });
  }),
);

// POST /api/teams/members/:uid/remove - Leader removes a member before adventure starts
router.post(
  "/members/:uid/remove",
  requireAuth,
  actionLimiter,
  asyncHandler(async (req, res) => {
    const data = await removeMember(req.user, req.params.uid);
    res.json({ success: true, data });
  }),
);

// GET /api/teams/events - Team activity notification events
router.get(
  "/events",
  requireAuth,
  asyncHandler(async (req, res) => {
    const since = req.query.since || 0;
    const data = await getTeamEvents(req.user.uid, since);
    res.json({ success: true, data });
  }),
);

module.exports = router;
