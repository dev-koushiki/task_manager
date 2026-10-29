// Static requires for Vercel NFT bundling
let app;
try {
  app = require("./backend/server");
} catch (e1) {
  try {
    app = require("../backend/server");
  } catch (e2) {
    try {
      app = require("../../backend/server");
    } catch (e3) {
      console.error("Frontend server module load error:", e1.message);
    }
  }
}

module.exports = (req, res) => {
  if (!app) {
    return res.status(500).json({
      error: "SERVERLESS_INIT_ERROR",
      message: "Frontend server module could not be initialized",
      cwd: process.cwd(),
      dirname: __dirname,
    });
  }
  return app(req, res);
};
