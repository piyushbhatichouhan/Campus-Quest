const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const { globalLimiter } = require("./middleware/security");
const gameRoutes = require("./routes/game.routes");

const app = express();

// Trust proxy if deployed behind reverse proxy (e.g., NGINX, Cloudflare, Heroku)
app.set("trust proxy", 1);

// HTTP Security Headers
app.use(helmet());

// Restrict CORS origins to trusted origins

app.use(
  cors({
    origin: [
      "https://campusquest-877f2.web.app",
      "https://campusquest-877f2.firebaseapp.com",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Payload size limit to prevent Request Body DoS
app.use(express.json({ limit: "10kb" }));

// Global rate limiting
app.use(globalLimiter);

// Lightweight Render and load-balancer health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    data: {
      status: "ok",
      message: "DAVV Quest backend is running",
    },
  });
});

// API Routes
app.use("/api", gameRoutes);

// Centralized safe error handler
app.use((err, req, res, next) => {
  if (process.env.NODE_ENV !== "production") {
    console.error("App error handler:", err.message);
  }

  const status = err.status || 500;
  const message =
    status < 500 ? err.message : "An unexpected server error occurred.";

  res.status(status).json({
    success: false,
    error: {
      code: err.code || "INTERNAL_SERVER_ERROR",
      message,
    },
  });
});

module.exports = app;
