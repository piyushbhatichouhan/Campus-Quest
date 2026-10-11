require("dotenv").config();

const app = require("./app");

const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";

const server = app.listen(PORT, HOST, () => {
  console.log(`DAVV Quest backend running on port ${PORT} (host: ${HOST})`);
});

// Graceful shutdown handling for Render and container environments
function gracefulShutdown(signal) {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log("HTTP server closed. Exiting process.");
    process.exit(0);
  });

  // Force exit if connections take too long to close
  setTimeout(() => {
    console.error("Graceful shutdown timeout exceeded. Forcing exit.");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  console.error(
    "Unhandled Promise Rejection:",
    reason instanceof Error ? reason.message : reason,
  );
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error.message);
  process.exit(1);
});
