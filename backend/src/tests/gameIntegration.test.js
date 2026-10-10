require("dotenv").config();
const test = require("node:test");
const assert = require("node:assert");
const request = require("supertest");
const app = require("../app");

test("Game Integration & End-to-End API Test Suite", async (t) => {
  await t.test("1. Public /api/checkpoints returns all 10 campus checkpoints without secret answers", async () => {
    const res = await request(app).get("/api/checkpoints");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.length, 10);

    const checkpointIds = res.body.data.map((c) => c.id);
    assert.deepStrictEqual(checkpointIds, [
      "mechanical_workshop",
      "library",
      "f_block_pond",
      "cse_block",
      "central_placement_cell",
      "electronics_block_1",
      "admin_block",
      "electronics_block_2",
      "it_block",
      "mechanical_block",
    ]);

    for (const cp of res.body.data) {
      assert.ok(cp.name, "Checkpoint must have a name");
      assert.ok(cp.points > 0, "Checkpoint must have points");
      assert.strictEqual(cp.challenge?.answer, undefined, "Secret answer must NEVER be exposed!");
      if (cp.rewardItem) {
        assert.ok(cp.rewardItem.id, "Reward item must have an id");
        assert.ok(cp.rewardItem.name, "Reward item must have a name");
      }
    }
  });

  await t.test("2. Public /api/leaderboard returns sorted player array without email PII", async () => {
    const res = await request(app).get("/api/leaderboard");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));

    for (const player of res.body.data) {
      assert.strictEqual(player.email, undefined, "Player email must not be exposed on leaderboard!");
      assert.ok(player.displayName, "Player must have a display name");
      assert.ok(typeof player.score === "number", "Player must have numeric score");
    }
  });

  await t.test("3. Protected game actions require authentication", async () => {
    const endpoints = [
      { method: "get", path: "/api/game/state" },
      { method: "post", path: "/api/game/start" },
      { method: "post", path: "/api/game/checkpoints/library/claim" },
      { method: "post", path: "/api/game/checkpoints/library/challenge" },
    ];

    for (const ep of endpoints) {
      const res = await request(app)[ep.method](ep.path);
      assert.strictEqual(res.status, 401, `${ep.method.toUpperCase()} ${ep.path} must require auth`);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, "UNAUTHORIZED");
    }
  });

  await t.test("4. Server health endpoints confirm active backend", async () => {
    // Top-level Render health check
    const renderHealthRes = await request(app).get("/health");
    assert.strictEqual(renderHealthRes.status, 200);
    assert.strictEqual(renderHealthRes.body.status, "ok");
    assert.ok(typeof renderHealthRes.body.uptime === "number");
    assert.ok(renderHealthRes.body.timestamp);

    // Standard API health check
    const apiHealthRes = await request(app).get("/api/health");
    assert.strictEqual(apiHealthRes.status, 200);
    assert.strictEqual(apiHealthRes.body.data.status, "ok");
  });
});
