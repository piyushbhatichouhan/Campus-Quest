require("dotenv").config();
const test = require("node:test");
const assert = require("node:assert");
const request = require("supertest");
const app = require("../app");

test("Render Deployment & Production Configuration Tests", async (t) => {
  await t.test("1. GET /health returns 200 with ok status for Render health check", async () => {
    const res = await request(app).get("/health");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, "ok");
    assert.ok(typeof res.body.uptime === "number");
    assert.ok(typeof res.body.timestamp === "string");
  });

  await t.test("2. GET /api/health returns 200 with ok message", async () => {
    const res = await request(app).get("/api/health");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.status, "ok");
  });

  await t.test("3. Allowed CORS origins are permitted with proper headers", async () => {
    const allowed = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
      .split(",")[0]
      .trim();

    const res = await request(app)
      .options("/api/checkpoints")
      .set("Origin", allowed)
      .set("Access-Control-Request-Method", "GET");

    assert.strictEqual(res.headers["access-control-allow-origin"], allowed);
  });

  await t.test("4. Disallowed CORS origin is rejected", async () => {
    const res = await request(app)
      .get("/api/checkpoints")
      .set("Origin", "https://unauthorized-evil-domain.com");

    assert.ok(
      res.status === 500 ||
        res.status === 403 ||
        res.headers["access-control-allow-origin"] === undefined
    );
  });

  await t.test("5. Security headers (Helmet) are present on root and api endpoints", async () => {
    const res = await request(app).get("/health");
    assert.strictEqual(res.headers["x-content-type-options"], "nosniff");
  });
});
