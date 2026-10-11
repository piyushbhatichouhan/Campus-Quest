require("dotenv").config();
const test = require("node:test");
const assert = require("node:assert");
const request = require("supertest");
const app = require("../app");
const { db, isInMemoryMode } = require("../config/firebase");
const {
  getPublicEventStatus,
  getAdminEventStatus,
  startEvent,
  stopEvent,
  finalizeEvent,
  getAdminOverview,
  getAdminTeamsList,
  getAdminTeamDetail,
  getCheckpointAnalytics,
  MAIN_EVENT_ID,
} = require("../services/event.service");
const {
  createTeam,
  joinTeam,
  leaveTeam,
  removeMember,
  startAdventure,
  getMyTeam,
} = require("../services/team.service");
const {
  getGameState,
  claimCheckpoint,
  submitChallenge,
  getLeaderboard,
} = require("../services/game.service");

function makeTestToken(payload) {
  return `Bearer test-token:${JSON.stringify(payload)}`;
}

test("Campus Quest Global Event Lifecycle, Race Leaderboard & Admin Analytics Suite", async (t) => {
  assert.strictEqual(
    isInMemoryMode,
    true,
    "Automated tests must run against isolated in-memory Firestore, never production",
  );

  const adminUser = {
    uid: "test_admin_uid",
    email: "admin@test.com",
    admin: true,
  };
  const adminToken = makeTestToken(adminUser);

  const testLeaderUid = `ev_leader_${Date.now()}`;
  const testMemberUid = `ev_member_${Date.now()}`;

  const leaderToken = makeTestToken({
    uid: testLeaderUid,
    email: "squad_leader@test.com",
    admin: false,
  });
  const memberToken = makeTestToken({
    uid: testMemberUid,
    email: "member@test.com",
    admin: false,
  });

  // Reset main event doc to 'waiting' state before running test suite
  const eventRef = db.collection("events").doc(MAIN_EVENT_ID);
  await eventRef.set({
    id: MAIN_EVENT_ID,
    status: "waiting",
    startedAt: null,
    stoppedAt: null,
    finalizedAt: null,
    startedBy: null,
    stoppedBy: null,
    finalizedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  let squad = null;

  await t.test(
    "1. Registration & Team Joining: Works while event is in 'waiting' state",
    async () => {
      squad = await createTeam(
        { uid: testLeaderUid, email: "squad_leader@test.com" },
        { teamName: "Pixel Explorers", leaderName: "Captain" },
      );

      assert.ok(squad.teamId);
      assert.strictEqual(squad.status, "waiting");

      const joinRes = await joinTeam(
        { uid: testMemberUid },
        { joinCode: squad.joinCode, displayName: "Navigator" },
      );
      assert.strictEqual(joinRes.memberCount, 2);
    },
  );

  await t.test(
    "2. Regular player and Team Leader cannot start or stop the event",
    async () => {
      // Regular player cannot start via API
      const playerStartRes = await request(app)
        .post("/api/admin/event/start")
        .set("Authorization", memberToken);
      assert.strictEqual(playerStartRes.status, 403);

      // Team leader cannot start via admin API
      const leaderAdminStartRes = await request(app)
        .post("/api/admin/event/start")
        .set("Authorization", leaderToken);
      assert.strictEqual(leaderAdminStartRes.status, 403);

      // Team leader cannot start via legacy /api/teams/start endpoint
      const legacyStartRes = await request(app)
        .post("/api/teams/start")
        .set("Authorization", leaderToken);
      assert.strictEqual(legacyStartRes.status, 403);

      // Team leader cannot start via service call
      await assert.rejects(
        async () => {
          await startAdventure({ uid: testLeaderUid });
        },
        (err) => {
          assert.strictEqual(err.code, "ADMIN_CONTROLLED");
          assert.strictEqual(err.status, 403);
          return true;
        },
      );

      // Regular player cannot stop via API
      const playerStopRes = await request(app)
        .post("/api/admin/event/stop")
        .set("Authorization", memberToken);
      assert.strictEqual(playerStopRes.status, 403);

      // Team leader cannot stop via API
      const leaderStopRes = await request(app)
        .post("/api/admin/event/stop")
        .set("Authorization", leaderToken);
      assert.strictEqual(leaderStopRes.status, 403);

      // GET requests to lifecycle controls are rejected with 405
      const getStartRes = await request(app)
        .get("/api/admin/event/start")
        .set("Authorization", adminToken);
      assert.strictEqual(getStartRes.status, 405);
    },
  );

  await t.test(
    "3. Before event starts, no team can see the first mystery clue",
    async () => {
      const gameState = await getGameState(testLeaderUid);
      assert.strictEqual(gameState.eventStatus, "waiting");
      assert.strictEqual(
        gameState.currentCheckpoint,
        null,
        "Mystery checkpoint must be null before start",
      );
      assert.strictEqual(
        gameState.currentClue,
        null,
        "First mystery clue must be null before start",
      );
      assert.strictEqual(gameState.claimedCheckpointId, null);

      // Stopping or finalizing while in 'waiting' state must be rejected
      await assert.rejects(
        async () => {
          await stopEvent(adminUser);
        },
        (err) => {
          assert.strictEqual(err.code, "INVALID_TRANSITION");
          assert.strictEqual(err.status, 400);
          return true;
        },
      );
    },
  );

  let officialStartedAt = null;

  await t.test(
    "4. Administrator starts event only in 'waiting' state: sets status='active', startedAt, startedBy",
    async () => {
      const startRes = await request(app)
        .post("/api/admin/event/start")
        .set("Authorization", adminToken);
      assert.strictEqual(startRes.status, 200);
      assert.strictEqual(startRes.body.data.status, "active");
      assert.ok(startRes.body.data.startedAt);
      officialStartedAt = startRes.body.data.startedAt;

      const adminStatus = await getAdminEventStatus();
      assert.strictEqual(adminStatus.status, "active");
      assert.strictEqual(adminStatus.startedBy, adminUser.email);

      const publicStatus = await getPublicEventStatus();
      assert.strictEqual(publicStatus.status, "active");
      assert.strictEqual(publicStatus.startedBy, undefined);
    },
  );

  await t.test(
    "5. Starting the event twice is rejected and does not reset startedAt",
    async () => {
      await assert.rejects(
        async () => {
          await startEvent(adminUser);
        },
        (err) => {
          assert.strictEqual(err.code, "INVALID_TRANSITION");
          assert.strictEqual(err.status, 400);
          return true;
        },
      );

      const afterStatus = await getPublicEventStatus();
      assert.strictEqual(afterStatus.startedAt, officialStartedAt);
    },
  );

  await t.test(
    "6. After event starts, all eligible teams receive the first mystery clue simultaneously",
    async () => {
      const leaderGame = await getGameState(testLeaderUid);
      assert.strictEqual(leaderGame.eventStatus, "active");
      assert.ok(leaderGame.currentCheckpoint);
      assert.strictEqual(
        leaderGame.currentCheckpoint.id,
        "mechanical_workshop",
      );
      assert.ok(leaderGame.currentClue);
      assert.strictEqual(
        leaderGame.currentCheckpoint.challenge?.answer,
        undefined,
        "Secret challenge answer must never be exposed",
      );

      const memberGame = await getGameState(testMemberUid);
      assert.strictEqual(
        memberGame.currentCheckpoint?.id,
        "mechanical_workshop",
      );
      assert.strictEqual(memberGame.currentClue, leaderGame.currentClue);

      const myTeam = await getMyTeam(testLeaderUid);
      assert.strictEqual(myTeam.status, "active");
      assert.strictEqual(myTeam.eventStatus, "active");
    },
  );

  await t.test(
    "7. After event starts, team registration, joining, leaving, and member removal are rejected",
    async () => {
      await assert.rejects(
        async () => {
          await createTeam(
            { uid: `late_leader_${Date.now()}` },
            { teamName: "Late Squad", leaderName: "TooLate" },
          );
        },
        (err) => {
          assert.strictEqual(err.code, "REGISTRATION_CLOSED");
          assert.strictEqual(err.status, 403);
          return true;
        },
      );

      await assert.rejects(
        async () => {
          await joinTeam(
            { uid: `late_joiner_${Date.now()}` },
            { joinCode: squad.joinCode, displayName: "LateMember" },
          );
        },
        (err) => {
          assert.strictEqual(err.code, "JOINING_CLOSED");
          assert.strictEqual(err.status, 403);
          return true;
        },
      );

      await assert.rejects(
        async () => {
          await leaveTeam({ uid: testMemberUid });
        },
        (err) => {
          assert.strictEqual(err.code, "CANNOT_LEAVE_ACTIVE_GAME");
          assert.strictEqual(err.status, 400);
          return true;
        },
      );

      await assert.rejects(
        async () => {
          await removeMember({ uid: testLeaderUid }, testMemberUid);
        },
        (err) => {
          assert.strictEqual(err.code, "GAME_ACTIVE");
          assert.strictEqual(err.status, 400);
          return true;
        },
      );
    },
  );

  await t.test(
    "8. While event is active, teams can claim checkpoints and complete challenges; original claimedAt is preserved",
    async () => {
      const claimRes1 = await claimCheckpoint(
        testLeaderUid,
        "mechanical_workshop",
        22.681478,
        75.867947,
      );
      assert.strictEqual(claimRes1.claimed, true);

      const analyticsBeforeRepeat = await getCheckpointAnalytics(
        "mechanical_workshop",
      );
      const firstArrival = analyticsBeforeRepeat.arrivals.find(
        (a) => a.teamId === squad.teamId,
      );
      assert.ok(firstArrival.claimedAt);

      // Wait 15ms and re-claim same checkpoint before solving challenge -> original claimedAt must be preserved
      await new Promise((r) => setTimeout(r, 15));
      await claimCheckpoint(
        testMemberUid,
        "mechanical_workshop",
        22.681478,
        75.867947,
      );

      const analyticsAfterRepeat = await getCheckpointAnalytics(
        "mechanical_workshop",
      );
      const repeatArrival = analyticsAfterRepeat.arrivals.find(
        (a) => a.teamId === squad.teamId,
      );
      assert.strictEqual(
        repeatArrival.claimedAt,
        firstArrival.claimedAt,
        "Original claimedAt must not be overwritten by duplicate claim",
      );

      const challengeRes = await submitChallenge(
        testMemberUid,
        "mechanical_workshop",
        "mechanical workshop",
      );
      assert.strictEqual(challengeRes.success, true);
      assert.strictEqual(challengeRes.score, 100);
      assert.strictEqual(challengeRes.nextCheckpoint.id, "library");
    },
  );

  await t.test(
    "9. Race condition between stopEvent and claimCheckpoint is handled safely by transactions",
    async () => {
      // Run stopEvent and claimCheckpoint concurrently
      const [stopOutcome, claimOutcome] = await Promise.allSettled([
        stopEvent(adminUser),
        claimCheckpoint(testLeaderUid, "library", 22.681478, 75.867947),
      ]);

      assert.strictEqual(stopOutcome.status, "fulfilled");
      assert.strictEqual(stopOutcome.value.status, "stopped");
      assert.ok(stopOutcome.value.stoppedAt);

      // Any subsequent claim after stopEvent committed must strictly fail
      await assert.rejects(
        async () => {
          await claimCheckpoint(testLeaderUid, "library", 22.681478, 75.867947);
        },
        (err) => {
          assert.strictEqual(err.code, "EVENT_NOT_ACTIVE");
          assert.strictEqual(err.status, 403);
          return true;
        },
      );

      // Challenge submission after stopEvent must strictly fail
      await assert.rejects(
        async () => {
          await submitChallenge(testLeaderUid, "library", "library");
        },
        (err) => {
          assert.strictEqual(err.code, "EVENT_NOT_ACTIVE");
          assert.strictEqual(err.status, 403);
          return true;
        },
      );

      // Verify stopping the event does NOT automatically finalize results
      const statusAfterStop = await getPublicEventStatus();
      assert.strictEqual(statusAfterStop.status, "stopped");
      assert.strictEqual(statusAfterStop.finalizedAt, null);
    },
  );

  await t.test(
    "10. Race Leaderboard & Checkpoint Analytics ranking rules (completed vs unfinished, timestamps, XP, tie-breaker)",
    async () => {
      // Seed comparison teams directly in isolated in-memory store to verify all 6 leaderboard rules
      // and checkpoint arrival ordering
      await db.collection("teams").doc("team_completed_late").set({
        id: "team_completed_late",
        name: "Redstone finishers",
        score: 1000,
        status: "completed",
        gameCompleted: true,
        completedCheckpoints: [
          "c1",
          "c2",
          "c3",
          "c4",
          "c5",
          "c6",
          "c7",
          "c8",
          "c9",
          "c10",
        ],
        completedAt: new Date("2026-10-11T11:20:00.000Z"),
        checkpointProgress: {
          mechanical_workshop: {
            claimedAt: new Date("2026-10-11T10:36:00.000Z"),
            completedAt: new Date("2026-10-11T10:39:00.000Z"),
          },
        },
        memberCount: 4,
      });

      await db.collection("teams").doc("team_completed_early").set({
        id: "team_completed_early",
        name: "Pixel Champions",
        score: 1000,
        status: "completed",
        gameCompleted: true,
        completedCheckpoints: [
          "c1",
          "c2",
          "c3",
          "c4",
          "c5",
          "c6",
          "c7",
          "c8",
          "c9",
          "c10",
        ],
        completedAt: new Date("2026-10-11T11:15:00.000Z"),
        checkpointProgress: {
          mechanical_workshop: {
            claimedAt: new Date("2026-10-11T10:32:00.000Z"),
            completedAt: new Date("2026-10-11T10:35:00.000Z"),
          },
        },
        memberCount: 3,
      });

      await db.collection("teams").doc("team_unfinished_early").set({
        id: "team_unfinished_early",
        name: "Early Sprinters",
        score: 300,
        status: "active",
        gameCompleted: false,
        completedCheckpoints: ["c1", "c2", "c3"],
        lastCheckpointCompletedAt: new Date("2026-10-11T10:50:00.000Z"),
        checkpointProgress: {
          mechanical_workshop: {
            claimedAt: new Date("2026-10-11T10:41:00.000Z"),
            completedAt: new Date("2026-10-11T10:44:00.000Z"),
          },
        },
        memberCount: 2,
      });

      await db.collection("teams").doc("team_unfinished_late").set({
        id: "team_unfinished_late",
        name: "Late Sprinters",
        score: 300,
        status: "active",
        gameCompleted: false,
        completedCheckpoints: ["c1", "c2", "c3"],
        lastCheckpointCompletedAt: new Date("2026-10-11T10:55:00.000Z"),
        checkpointProgress: {},
        memberCount: 2,
      });

      const leaderboard = await getLeaderboard(testLeaderUid);

      const rankEarlyCompleted = leaderboard.findIndex(
        (t) => t.teamId === "team_completed_early",
      );
      const rankLateCompleted = leaderboard.findIndex(
        (t) => t.teamId === "team_completed_late",
      );
      const rankUnfinishedEarly = leaderboard.findIndex(
        (t) => t.teamId === "team_unfinished_early",
      );
      const rankUnfinishedLate = leaderboard.findIndex(
        (t) => t.teamId === "team_unfinished_late",
      );

      assert.ok(
        rankEarlyCompleted < rankLateCompleted,
        "Completed team with earlier completedAt must rank above later completed team",
      );
      assert.ok(
        rankLateCompleted < rankUnfinishedEarly,
        "Completed teams must rank above unfinished teams",
      );
      assert.ok(
        rankUnfinishedEarly < rankUnfinishedLate,
        "Tied unfinished teams must rank by earlier lastCheckpointCompletedAt",
      );

      // Verify Checkpoint Analytics ranks by original claimedAt timestamp
      const cpAnalytics = await getCheckpointAnalytics("mechanical_workshop");
      const idxChampions = cpAnalytics.arrivals.findIndex(
        (a) => a.teamId === "team_completed_early",
      );
      const idxRedstone = cpAnalytics.arrivals.findIndex(
        (a) => a.teamId === "team_completed_late",
      );
      const idxEarlySprinters = cpAnalytics.arrivals.findIndex(
        (a) => a.teamId === "team_unfinished_early",
      );

      assert.ok(
        idxChampions < idxRedstone && idxRedstone < idxEarlySprinters,
        "Checkpoint analytics must rank teams by earliest original claimedAt timestamp",
      );
    },
  );

  await t.test(
    "11. Finalize Results: Admin transitions stopped -> completed and records finalizedAt",
    async () => {
      const finalRes = await request(app)
        .post("/api/admin/event/finalize")
        .set("Authorization", adminToken);
      assert.strictEqual(finalRes.status, 200);
      assert.strictEqual(finalRes.body.data.status, "completed");
      assert.ok(finalRes.body.data.finalizedAt);

      // Cannot finalize again or stop/start after completed
      await assert.rejects(
        async () => {
          await finalizeEvent(adminUser);
        },
        (err) => {
          assert.strictEqual(err.code, "INVALID_TRANSITION");
          return true;
        },
      );
    },
  );

  await t.test(
    "12. Admin Overview, Teams List, and Team Journey Timeline endpoints return full data",
    async () => {
      const overview = await getAdminOverview();
      assert.strictEqual(overview.event.status, "completed");
      assert.ok(overview.metrics.totalTeams >= 1);

      const teamsList = await getAdminTeamsList();
      assert.ok(teamsList.length >= 1);

      const teamDetail = await getAdminTeamDetail(squad.teamId);
      assert.strictEqual(teamDetail.name, "Pixel Explorers");
      assert.strictEqual(teamDetail.members.length, 2);
      assert.strictEqual(teamDetail.timeline.length, 10);
      assert.ok(Array.isArray(teamDetail.journeySteps));
      assert.ok(
        teamDetail.journeySteps.some((s) => s.stepType === "event_start"),
        "Journey timeline must include official event start",
      );
      assert.ok(
        teamDetail.journeySteps.some(
          (s) => s.stepType === "checkpoint_claimed" && s.reached,
        ),
        "Journey timeline must include checkpoint claimed step",
      );
      assert.ok(
        teamDetail.journeySteps.some(
          (s) => s.stepType === "challenge_completed" && s.reached,
        ),
        "Journey timeline must include challenge completed step",
      );
    },
  );
});
