const rateLimit = require("express-rate-limit");

// Global rate limiter for all API routes (100 requests per 15 minutes per IP)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Too many requests from this IP. Please try again after 15 minutes.",
    },
  },
});

// Action limiter for state-changing endpoints (30 requests per 15 minutes)
const actionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Rate limit exceeded for game actions. Please slow down.",
    },
  },
});

// Strict challenge submission limiter (10 attempts per minute per IP to prevent brute forcing)
const challengeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "TOO_MANY_ATTEMPTS",
      message: "Too many challenge attempts in a short time. Please wait a minute before trying again.",
    },
  },
});

/**
 * Sanitizes user input string by trimming, enforcing maximum length,
 * and stripping HTML tags / control characters.
 */
function sanitizeString(input, maxLength = 100) {
  if (typeof input !== "string") return "";

  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>&"']/g, "") // Strip HTML special characters
    .replace(/[\x00-\x1F\x7F]/g, ""); // Strip control characters
}

/**
 * Validates latitude and longitude coordinate inputs.
 */
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
