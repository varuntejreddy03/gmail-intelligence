// Production start script - runs both Next.js and Express
const { spawn } = require("child_process");

// Start Express backend
const backend = spawn("npx", ["tsx", "backend/index.ts"], {
  stdio: "inherit",
  env: { ...process.env, BACKEND_PORT: process.env.BACKEND_PORT || "4000" },
});

// Start Next.js frontend
const frontend = spawn("npx", ["next", "start", "-p", process.env.PORT || "3000"], {
  stdio: "inherit",
  env: process.env,
});

process.on("SIGTERM", () => {
  backend.kill();
  frontend.kill();
  process.exit(0);
});
