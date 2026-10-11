require("dotenv").config();
const test = require("node:test");
const assert = require("node:assert");
const request = require("supertest");
const app = require("../app");
const { db } = require("../config/firebase");
const {
  getOrCreateEventDoc,
  getPublicEventStatus,
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
  startAdventure,
  getMyTeam,
} = require("../services/team.service");
const {
  getGameState,
  claimCheckpoint,
  submitChallenge,
  getLeaderboard,
} = require("../services/game.service");

test("Campus Quest Global Event Lifecycle & Admin Analytics Test Suite", async (t) => {
  const adminUser = { uid: "test_admin_uid", email: "admin@test.com", admin: true };
  const regularUser = { uid: "test_regular_uid", email: "player@test.com" };

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

  const testLeaderUid = `ev_leader_${Date.now()}`;
  const testMemberUid = `ev_member_${Date.now()}`;
  let squad = null;

  await t.test("1. Registration & Team Joining: Works while event is in 'waiting' state", async () => {
    squad = await createTeam(
      { uid: testLeaderUid, email: "squad_leader@test.com" },
      { teamName: "Speedy Sprinters", leaderName: "Captain" },
    );

    assert.ok(squad.teamId);
    assert.strictEqual(squad.status, "waiting");

    const joinRes = await joinTeam(
      { uid: testMemberUid },
      { joinCode: squad.joinCode, displayName: "Navigator" },
    );
    assert.strictEqual(joinRes.memberCount, 2);
  });

  await t.test("2. Mystery Clue Concealment: First mystery clue is hidden while event is 'waiting'", async () => {
    const gameState = await getGameState(testLeaderUid);
    assert.strictEqual(gameState.eventStatus, "waiting");
    assert.strictEqual(gameState.currentCheckpoint, null, "Mystery clue must be null before start");
    assert.strictEqual(gameState.claimedCheckpointId, null);
  });

  await t.test("3. Team Leader cannot start the event (architectural enforcement)", async () => {
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
  });

  await t.test("4. Non-admin cannot start event via API", async () => {
    const res = await request(app).post("/api/admin/event/start");
    assert.strictEqual(res.status, 401, "Unauthenticated request must be 401");
  });

  await t.test("5. Administrator starts event: Transitions waiting -> active, sets startedAt", async () => {
    const startResult = await startEvent(adminUser);
    assert.strictEqual(startResult.status, "active");
    assert.ok(startResult.startedAt);

    const publicStatus = await getPublicEventStatus();
    assert.strictEqual(publicStatus.status, "active");
    assert.ok(publicStatus.startedAt);
  });

  await t.test("6. Idempotency: Duplicate start request returns active status safely without double start", async () => {
    const secondStart = await startEvent(adminUser);
    assert.strictEqual(secondStart.status, "active");
  });

  await t.test("7. Mystery Clue Unlocked: All teams now receive first clue simultaneously", async () => {
    const leaderGame = await getGameState(testLeaderUid);
    assert.strictEqual(leaderGame.eventStatus, "active");
    assert.ok(leaderGame.currentCheckpoint, "First mystery clue must be revealed");
    assert.strictEqual(leaderGame.currentCheckpoint.id, "mechanical_workshop");
    assert.strictEqual(leaderGame.currentCheckpoint.challenge?.answer, undefined, "Secret answer must not leak");

    const memberGame = await getGameState(testMemberUid);
    assert.strictEqual(memberGame.currentCheckpoint?.id, "mechanical_workshop");
  });

  await t.test("8. Registration closes: New teams cannot be created once event is active", async () => {
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
  });

  await t.test("9. Team joining closes: New members cannot join once event is active", async () => {
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
  });

  await t.test("10. Shared Checkpoint Claim & Challenge: Arrival timestamps recorded in checkpointProgress", async () => {
    const claimRes = await claimCheckpoint(
      testLeaderUid,
      "mechanical_workshop",
      22.681478,
      75.867947,
    );
    assert.strictEqual(claimRes.claimed, true);

    const challengeRes = await submitChallenge(
      testMemberUid,
      "mechanical_workshop",
      "mechanical workshop",
    );
    assert.strictEqual(challengeRes.success, true);
    assert.strictEqual(challengeRes.score, 100);
    assert.strictEqual(challengeRes.nextCheckpoint.id, "library");

    // Checkpoint analytics inspection
    const analytics = await getCheckpointAnalytics("mechanical_workshop");
    assert.strictEqual(analytics.checkpointId, "mechanical_workshop");
    assert.ok(analytics.arrivals.length >= 1);

    const arrival = analytics.arrivals.find((a) => a.teamId === squad.teamId);
    assert.ok(arrival, "Team arrival must be recorded");
    assert.ok(arrival.claimedAt);
    assert.ok(arrival.completedAt);
  });

  await t.test("11. Administrator stops event: Transitions active -> stopped, freezes gameplay", async () => {
    const stopResult = await stopEvent(adminUser);
    assert.strictEqual(stopResult.status, "stopped");
    assert.ok(stopResult.stoppedAt);

    const publicStatus = await getPublicEventStatus();
    assert.strictEqual(publicStatus.status, "stopped");
  });

  await t.test("12. Gameplay disabled when stopped: Checkpoint claims and challenges are rejected", async () => {
    // Attempt claim on next checkpoint (library)
    await assert.rejects(
      async () => {
        await claimCheckpoint(testMemberUid, "library", 22.681478, 75.867947);
      },
      (err) => {
        assert.strictEqual(err.code, "EVENT_NOT_ACTIVE");
        assert.strictEqual(err.status, 403);
        return true;
      },
    );

    // Attempt challenge submission
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
  });

  await t.test("13. Race Leaderboard rankings: Ranks teams deterministically", async () => {
    const leaderboard = await getLeaderboard(testLeaderUid);
    assert.ok(Array.isArray(leaderboard));

    const ourTeam = leaderboard.find((t) => t.teamId === squad.teamId);
    assert.ok(ourTeam);
    assert.strictEqual(ourTeam.name, "Speedy Sprinters");
    assert.strictEqual(ourTeam.completedCount, 1);
    assert.strictEqual(ourTeam.score, 100);
    assert.strictEqual(ourTeam.isCurrentTeam, true);
    assert.strictEqual(ourTeam.progress, "1/10");
  });

  await t.test("14. Finalize Results: Admin transitions stopped -> completed", async () => {
    const finalResult = await finalizeEvent(adminUser);
    assert.strictEqual(finalResult.status, "completed");
    assert.ok(finalResult.finalizedAt);

    const publicStatus = await getPublicEventStatus();
    assert.strictEqual(publicStatus.status, "completed");
  });

  await t.test("15. Admin Overview and Team Details endpoints provide accurate data", async () => {
    const overview = await getAdminOverview();
    assert.strictEqual(overview.event.status, "completed");
    assert.ok(overview.metrics.totalTeams >= 1);

    const teamDetail = await getAdminTeamDetail(squad.teamId);
    assert.strictEqual(teamDetail.name, "Speedy Sprinters");
    assert.strictEqual(teamDetail.members.length, 2);
    assert.strictEqual(teamDetail.timeline.length, 10);
    assert.strictEqual(teamDetail.timeline[0].claimed, true);
    assert.strictEqual(teamDetail.timeline[0].completed, true);
  });
});
