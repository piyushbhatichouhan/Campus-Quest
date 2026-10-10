require("dotenv").config();
const test = require("node:test");
const assert = require("node:assert");
const request = require("supertest");
const app = require("../app");

test("Security Audit Test Suite - Authentication & Authorization Controls", async (t) => {
  await t.test("1. Unauthenticated request to protected route should be rejected with 401", async () => {
    const res = await request(app).get("/api/game/state");
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, "UNAUTHORIZED");
  });

  await t.test("2. Malformed token in Authorization header should be rejected with 401", async () => {
    const res = await request(app)
      .get("/api/game/state")
      .set("Authorization", "Bearer bogus_token_12345");
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, "UNAUTHORIZED");
  });

  await t.test("3. Unauthenticated access to admin routes should be rejected with 401", async () => {
    const res = await request(app).get("/api/admin/players");
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
  });

  await t.test("4. Public checkpoints endpoint should return 200 and NEVER leak challenge answers", async () => {
    const res = await request(app).get("/api/checkpoints");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));

    // Verify no checkpoint exposes challenge.answer
    for (const cp of res.body.data) {
      assert.strictEqual(cp.challenge?.answer, undefined, `Checkpoint ${cp.id} leaked answer!`);
    }
  });

  await t.test("5. HTTP Security Headers (Helmet) should be present in responses", async () => {
    const res = await request(app).get("/api/health");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers["x-content-type-options"], "nosniff");
    assert.ok(res.headers["content-security-policy"] !== undefined || res.headers["x-frame-options"] !== undefined);
  });

  await t.test("6. Request body exceeding 10kb size limit should be rejected with 413", async () => {
    const hugePayload = { displayName: "A".repeat(20000) };
    const res = await request(app)
      .post("/api/game/start")
      .set("Authorization", "Bearer mock_token")
      .send(hugePayload);

    assert.ok(res.status === 413 || res.status === 400);
  });

  await t.test("7. CORS preflight / request from disallowed origin should be rejected", async () => {
    const res = await request(app)
      .get("/api/health")
      .set("Origin", "http://malicious-attacker-site.com");

    // Express CORS throws or fails origin match
    assert.ok(res.status === 500 || res.status === 403 || res.headers["access-control-allow-origin"] === undefined);
  });
});
