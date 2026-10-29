const path = require("path");

function getApp() {
  const candidates = [
    "../backend/server",
    "./backend/server",
    "../../backend/server",
    "../frontend/backend/server",
    "./frontend/backend/server",
    path.join(__dirname, "../backend/server"),
    path.join(__dirname, "./backend/server"),
    path.join(__dirname, "../frontend/backend/server"),
    path.join(__dirname, "../../backend/server"),
    path.join(process.cwd(), "backend/server"),
    path.join(process.cwd(), "frontend/backend/server"),
  ];

  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (e) {
      // try next
    }
  }
  throw new Error("Could not locate backend/server module");
}

let app;
try {
  app = getApp();
} catch (err) {
  console.error("API Init Warning:", err.message);
}

module.exports = (req, res) => {
  if (!app) {
    try {
      app = getApp();
    } catch (e) {
      return res.status(500).json({
        error: "SERVERLESS_INIT_ERROR",
        message: e.message,
        cwd: process.cwd(),
      });
    }
  }
  return app(req, res);
};
