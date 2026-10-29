// Static requires for Vercel NFT (Node File Trace) bundling
let app;
try {
  app = require("../backend/server");
} catch (e1) {
  try {
    app = require("./backend/server");
  } catch (e2) {
    try {
      app = require("../frontend/backend/server");
    } catch (e3) {
      try {
        app = require("./frontend/backend/server");
      } catch (e4) {
        console.error("Server module load error:", e1.message);
      }
    }
  }
}

module.exports = (req, res) => {
  if (!app) {
    return res.status(500).json({
      error: "SERVERLESS_INIT_ERROR",
      message: "Server module could not be initialized",
      cwd: process.cwd(),
      dirname: __dirname,
    });
  }
  return app(req, res);
};
