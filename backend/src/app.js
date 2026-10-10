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
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://localhost:3000"
)
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, same-origin) or in allowed list
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS policy violation: Origin not allowed."));
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Payload size limit to prevent Request Body DoS
app.use(express.json({ limit: "10kb" }));

// Global rate limiting
app.use(globalLimiter);

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
