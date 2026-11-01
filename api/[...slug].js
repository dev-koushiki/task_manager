// Static requires for Vercel NFT (Node File Trace) bundling
let app = null;
let lastError = null;

function loadServer() {
  if (app) return app;

  // 1. Primary relative path from api/
  try {
    app = require("../backend/server");
    return app;
  } catch (err1) {
    lastError = err1;
  }

  // 2. Fallback relative paths
  try {
    app = require("../frontend/backend/server");
    return app;
  } catch (err2) {
    lastError = err2;
  }

  try {
    app = require("./backend/server");
    return app;
  } catch (err3) {
    lastError = err3;
  }

  try {
    app = require("./frontend/backend/server");
    return app;
  } catch (err4) {
    lastError = err4;
  }

  // 3. Absolute / cwd paths
  const path = require("path");
  const candidates = [
    path.join(process.cwd(), "backend", "server.js"),
    path.join(process.cwd(), "frontend", "backend", "server.js"),
    path.join(__dirname, "..", "backend", "server.js")
  ];

  for (const c of candidates) {
    try {
      app = require(c);
      if (app) return app;
    } catch (errC) {
      lastError = errC;
    }
  }

  return null;
}

// Initial load attempt
loadServer();

module.exports = (req, res) => {
  const handler = loadServer();
  if (!handler) {
    console.error("Server module load failure:", lastError);
    return res.status(500).json({
      error: "SERVERLESS_INIT_ERROR",
      message: lastError ? `Server module initialization failed: ${lastError.message}` : "Server module could not be initialized",
      cwd: process.cwd(),
      dirname: __dirname,
    });
  }
  return handler(req, res);
};
