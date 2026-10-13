const rateLimit = require("express-rate-limit");

// ============================================================
// GLOBAL RATE LIMITER
// 2000 requests per 15 minutes per IP
// ============================================================

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,

  standardHeaders: true,
  legacyHeaders: false,

  // Never rate-limit Render health checks
  skip: (req) => {
    return req.path === "/health" || req.path === "/api/health";
  },

  message: {
    success: false,
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Too many requests. Please try again shortly.",
    },
  },
});

// ============================================================
// ACTION RATE LIMITER
// 150 state-changing requests per 15 minutes per IP
// ============================================================

const actionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,

  standardHeaders: true,
  legacyHeaders: false,

  message: {
    success: false,
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Too many game actions. Please slow down.",
    },
  },
});

// ============================================================
// CHALLENGE RATE LIMITER
// 20 attempts per minute per IP
// ============================================================

const challengeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,

  standardHeaders: true,
  legacyHeaders: false,

  message: {
    success: false,
    error: {
      code: "TOO_MANY_ATTEMPTS",
      message: "Too many challenge attempts. Please wait a minute.",
    },
  },
});

// ============================================================
// INPUT SANITIZATION
// ============================================================

function sanitizeString(input, maxLength = 100) {
  if (typeof input !== "string") return "";

  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>&"']/g, "")
    .replace(/[\x00-\x1F\x7F]/g, "");
}

// ============================================================
// COORDINATE VALIDATION
// ============================================================

function isValidCoordinate(lat, lon) {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

module.exports = {
  globalLimiter,
  actionLimiter,
  challengeLimiter,
  sanitizeString,
  isValidCoordinate,
};
