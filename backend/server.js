const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");

// Load .env relative to this file's directory and project root
require("dotenv").config({ path: path.join(__dirname, ".env") });
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const projectRoutes = require("./routes/projectRoutes");
const taskRoutes = require("./routes/taskRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const adminRoutes = require("./routes/adminRoutes");
const organizationRoutes = require("./routes/organizationRoutes");
const meetingRoutes = require("./routes/meetingRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

const app = express();

// Middlewares
app.use(cors());
app.use((req, res, next) => {
  if (req.body !== undefined && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    return next();
  }
  express.json({ limit: "15mb" })(req, res, (err) => {
    if (err) return next(err);
    express.urlencoded({ limit: "15mb", extended: true })(req, res, next);
  });
});

// MongoDB connection handling with cloud Atlas fallback and serverless connection caching
const DEFAULT_MONGODB_URI =
  "mongodb+srv://koushikiudemy_db_user:koushiki123@cluster0.emsh8jh.mongodb.net/task_manager?retryWrites=true&w=majority";
const MONGODB_URI = process.env.MONGODB_URI || DEFAULT_MONGODB_URI;

let dbConnectPromise = null;
const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  if (dbConnectPromise) {
    return dbConnectPromise;
  }
  dbConnectPromise = mongoose
    .connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    })
    .then(() => {
      console.log("MongoDB connected successfully!");
    })
    .catch((error) => {
      console.warn("MongoDB connection warning:", error.message);
    })
    .finally(() => {
      dbConnectPromise = null;
    });
  return dbConnectPromise;
};

// Immediate connect attempt
connectDB();

// Middleware to ensure DB connection on every serverless or local request
app.use(async (req, res, next) => {
  if (mongoose.connection.readyState < 1) {
    await connectDB();
  }
  next();
});

// Dual-bind routes to support both /api/* and root /* (for local and Vercel serverless rewrites)
const routePairs = [
  ["/auth", authRoutes],
  ["/projects", projectRoutes],
  ["/tasks", taskRoutes],
  ["/employees", employeeRoutes],
  ["/admin", adminRoutes],
  ["/organization", organizationRoutes],
  ["/meetings", meetingRoutes],
  ["/notifications", notificationRoutes],
];

routePairs.forEach(([prefix, handler]) => {
  app.use(`/api${prefix}`, handler);
  app.use(prefix, handler);
});

// Health check endpoint
const healthHandler = (req, res) => {
  res.json({
    status: "online",
    message: "Hierarchical Task Manager & Progress Monitoring API is running!",
    endpoints: {
      auth: "/api/auth",
      projects: "/api/projects",
      tasks: "/api/tasks",
      adminSummary: "/api/admin/summary",
      hierarchy: "/api/admin/hierarchy",
      employees: "/api/employees",
    },
  });
};

app.get("/api", healthHandler);
app.get("/", healthHandler);

// Only start the HTTP listener when NOT running inside Vercel serverless environment
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is already in use by another process. Please stop it or change PORT in .env.`);
    } else {
      console.error("Server error:", error.message);
    }
  });
}

module.exports = app;
