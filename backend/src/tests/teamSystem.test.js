require("dotenv").config();
const test = require("node:test");
const assert = require("node:assert");
const request = require("supertest");
const app = require("../app");
const {
  createTeam,
  joinTeam,
  getMyTeam,
  startAdventure,
  leaveTeam,
  removeMember,
  getTeamEvents,
} = require("../services/team.service");
const {
  getGameState,
  claimCheckpoint,
  submitChallenge,
  getLeaderboard,
} = require("../services/game.service");

test("Campus Quest Team System & Shared Multiplayer Test Suite", async (t) => {
  const testLeaderUid = `test_leader_${Date.now()}`;
  const testMember1Uid = `test_member1_${Date.now()}`;
  const testMember2Uid = `test_member2_${Date.now()}`;
  const testMember3Uid = `test_member3_${Date.now()}`;
  const testExtraMemberUid = `test_extra_${Date.now()}`;

  let createdTeam = null;

  await t.test("1. Team Creation: Leader creates team, receives unique 6-char code, and is set as leader", async () => {
    createdTeam = await createTeam(
      { uid: testLeaderUid, email: "leader@test.com" },
      { teamName: "Pixel Pioneers", leaderName: "Alex" },
    );

    assert.ok(createdTeam.teamId, "Must have teamId");
    assert.strictEqual(createdTeam.name, "Pixel Pioneers");
    assert.strictEqual(createdTeam.role, "leader");
    assert.strictEqual(createdTeam.isLeader, true);
    assert.strictEqual(createdTeam.status, "waiting");
    assert.strictEqual(createdTeam.memberCount, 1);
    assert.strictEqual(createdTeam.maxMembers, 4);
    assert.ok(createdTeam.joinCode, "Must have joinCode");
    assert.strictEqual(createdTeam.joinCode.length, 6, "Join code must be exactly 6 characters");
    assert.strictEqual(createdTeam.joinCode, createdTeam.joinCode.toUpperCase());
  });

  await t.test("2. Team Creation Idempotency: Repeated call for same leader returns existing team", async () => {
    const repeatTeam = await createTeam(
      { uid: testLeaderUid, email: "leader@test.com" },
      { teamName: "Pixel Pioneers", leaderName: "Alex" },
    );

    assert.strictEqual(repeatTeam.teamId, createdTeam.teamId);
    assert.strictEqual(repeatTeam.joinCode, createdTeam.joinCode);
  });

  await t.test("3. Member Joining: Up to 3 additional members join via 6-char code", async () => {
    // Member 1 joins
    const m1Result = await joinTeam(
      { uid: testMember1Uid },
      { joinCode: createdTeam.joinCode, displayName: "Sam" },
    );
    assert.strictEqual(m1Result.memberCount, 2);
    assert.strictEqual(m1Result.role, "member");

    // Member 2 joins
    const m2Result = await joinTeam(
      { uid: testMember2Uid },
      { joinCode: createdTeam.joinCode, displayName: "Jordan" },
    );
    assert.strictEqual(m2Result.memberCount, 3);

    // Member 3 joins (now at max 4)
    const m3Result = await joinTeam(
      { uid: testMember3Uid },
      { joinCode: createdTeam.joinCode, displayName: "Taylor" },
    );
    assert.strictEqual(m3Result.memberCount, 4);

    // Check roster from leader's perspective
    const leaderTeam = await getMyTeam(testLeaderUid);
    assert.strictEqual(leaderTeam.members.length, 4);
    const names = leaderTeam.members.map((m) => m.displayName);
    assert.ok(names.includes("Alex"));
    assert.ok(names.includes("Sam"));
    assert.ok(names.includes("Jordan"));
    assert.ok(names.includes("Taylor"));
  });

  await t.test("4. Capacity Enforcement: 5th member cannot join full team (max 4)", async () => {
    await assert.rejects(
      async () => {
        await joinTeam(
          { uid: testExtraMemberUid },
          { joinCode: createdTeam.joinCode, displayName: "Extra" },
        );
      },
      (err) => {
        assert.strictEqual(err.code, "TEAM_FULL");
        assert.strictEqual(err.status, 409);
        return true;
      },
    );
  });

  await t.test("5. Join Code Validation: Invalid code returns 404", async () => {
    await assert.rejects(
      async () => {
        await joinTeam(
          { uid: `random_user_${Date.now()}` },
          { joinCode: "ZZZZZZ", displayName: "Stranger" },
        );
      },
      (err) => {
        assert.strictEqual(err.code, "TEAM_NOT_FOUND");
        assert.strictEqual(err.status, 404);
        return true;
      },
    );
  });

  await t.test("6. Authorization: Only leader can start adventure; members are rejected", async () => {
    // Non-leader attempts to start
    await assert.rejects(
      async () => {
        await startAdventure({ uid: testMember1Uid });
      },
      (err) => {
        assert.strictEqual(err.code, "NOT_LEADER");
        assert.strictEqual(err.status, 403);
        return true;
      },
    );

    // Leader starts
    const startResult = await startAdventure({ uid: testLeaderUid });
    assert.strictEqual(startResult.status, "active");

    // Check status via getMyTeam
    const teamState = await getMyTeam(testMember1Uid);
    assert.strictEqual(teamState.status, "active");
  });

  await t.test("7. Team Locking: New members cannot join once adventure is active", async () => {
    const lateJoinerUid = `late_${Date.now()}`;
    await assert.rejects(
      async () => {
        await joinTeam(
          { uid: lateJoinerUid },
          { joinCode: createdTeam.joinCode, displayName: "Latecomer" },
        );
      },
      (err) => {
        assert.strictEqual(err.code, "TEAM_LOCKED");
        return true;
      },
    );
  });

  await t.test("8. Shared Progress: Member claims checkpoint within geofence, and all members see it claimed", async () => {
    // Mechanical workshop coordinates: 22.681478702822382, 75.86794773833824
    const claimRes = await claimCheckpoint(
      testMember2Uid,
      "mechanical_workshop",
      22.681478,
      75.867947,
    );
    assert.strictEqual(claimRes.claimed, true);

    // Leader sees it claimed
    const leaderGame = await getGameState(testLeaderUid);
    assert.strictEqual(leaderGame.claimedCheckpointId, "mechanical_workshop");

    // Member 3 sees it claimed
    const member3Game = await getGameState(testMember3Uid);
    assert.strictEqual(member3Game.claimedCheckpointId, "mechanical_workshop");
  });

  await t.test("9. Shared Challenge Completion: Different member completes challenge, team gets XP, next checkpoint unlocks", async () => {
    // Member 1 answers the riddle for mechanical workshop: "mechanical workshop"
    const challengeRes = await submitChallenge(
      testMember1Uid,
      "mechanical_workshop",
      "mechanical workshop",
    );
    assert.strictEqual(challengeRes.success, true);
    assert.strictEqual(challengeRes.pointsAwarded, 100);
    assert.strictEqual(challengeRes.score, 100);
    assert.strictEqual(challengeRes.currentCheckpointIndex, 1);
    assert.strictEqual(challengeRes.nextCheckpoint.id, "library");

    // Concurrency / Duplicate check: Second submission cannot award XP again
    await assert.rejects(
      async () => {
        await submitChallenge(
          testMember2Uid,
          "mechanical_workshop",
          "mechanical workshop",
        );
      },
      (err) => {
        assert.strictEqual(err.code, "ALREADY_COMPLETED");
        return true;
      },
    );

    // All members now share 100 XP and are at checkpoint 1 (Library)
    const leaderGame = await getGameState(testLeaderUid);
    assert.strictEqual(leaderGame.score, 100);
    assert.strictEqual(leaderGame.currentCheckpointIndex, 1);
    assert.strictEqual(leaderGame.claimedCheckpointId, null);
    assert.ok(leaderGame.completedCheckpoints.includes("mechanical_workshop"));
  });

  await t.test("10. Activity Events: Recorded events include actor names, timestamps, and types", async () => {
    const events = await getTeamEvents(testLeaderUid);
    assert.ok(events.length >= 3, "Should have member_joined, game_started, checkpoint_claimed, challenge_completed");

    const types = events.map((e) => e.type);
    assert.ok(types.includes("checkpoint_claimed"));
    assert.ok(types.includes("challenge_completed"));
    assert.ok(types.includes("checkpoint_unlocked"));

    const claimEvent = events.find((e) => e.type === "checkpoint_claimed");
    assert.strictEqual(claimEvent.actorName, "Jordan");
    assert.strictEqual(claimEvent.checkpointId, "mechanical_workshop");
  });

  await t.test("11. Team Leaderboard: Ranks team with accurate score and completed checkpoints count", async () => {
    const leaderboard = await getLeaderboard(testLeaderUid);
    assert.ok(Array.isArray(leaderboard));
    assert.ok(leaderboard.length > 0);

    const ourTeamEntry = leaderboard.find((t) => t.teamId === createdTeam.teamId);
    assert.ok(ourTeamEntry, "Our team must appear on leaderboard");
    assert.strictEqual(ourTeamEntry.name, "Pixel Pioneers");
    assert.strictEqual(ourTeamEntry.score, 100);
    assert.strictEqual(ourTeamEntry.completedCount, 1);
    assert.strictEqual(ourTeamEntry.isCurrentTeam, true);
    assert.strictEqual(ourTeamEntry.joinCode, undefined, "Join code must NOT be leaked on leaderboard!");
  });
});
