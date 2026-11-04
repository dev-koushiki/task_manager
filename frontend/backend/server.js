const express = require("express");
const cors = require("cors");
const path = require("path");

// Load .env relative to this file's directory and project root
require("dotenv").config({ path: path.join(__dirname, ".env") });
require("dotenv").config();

// Centralized database connection manager
const {
  connectDB,
  disconnectDB,
  getConnectionStatus,
  mongoose,
} = require("./config/database");

const authRoutes = require("./routes/authRoutes");
const projectRoutes = require("./routes/projectRoutes");
const taskRoutes = require("./routes/taskRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const adminRoutes = require("./routes/adminRoutes");
const organizationRoutes = require("./routes/organizationRoutes");
const meetingRoutes = require("./routes/meetingRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const groupRoutes = require("./routes/groupRoutes");
const performanceRoutes = require("./routes/performanceRoutes");
const searchRoutes = require("./routes/searchRoutes");
const { router: workConnectRoutes, setWorkConnectIO } = require("./routes/workConnectRoutes");
const helpDeskRoutes = require("./routes/helpDeskRoutes");

const app = express();

let isShuttingDown = false;

// Middlewares
app.use(cors());
app.use((req, res, next) => {
  if (req.body !== undefined && typeof req.body === "object" && Object.keys(req.body).length > 0) {
    return next();
  }
  express.json({ limit: "15mb" })(req, res, (err) => {
    if (err) return next(err);
    express.urlencoded({ limit: "15mb", extended: true })(req, res, next);
  });
});

// Production connection and shutdown guard middleware
app.use(async (req, res, next) => {
  // If server is actively shutting down, notify router to close connection
  if (isShuttingDown) {
    res.setHeader("Connection", "close");
    return res.status(503).json({
      status: "shutting_down",
      message: "Server is currently terminating. Please retry shortly.",
    });
  }

  // Health checks bypass connection blocking so monitoring services get accurate status
  if (req.path === "/health" || req.path === "/api/health") {
    return next();
  }

  // Ensure DB connection is active (handles serverless cold starts or temporary driver reconnects)
  if (mongoose.connection.readyState < 1) {
    try {
      await connectDB();
    } catch (dbErr) {
      console.error("[Middleware] Database connection unavailable for request:", dbErr.message);
      return res.status(503).json({
        error: "DATABASE_UNAVAILABLE",
        message: "Database service is temporarily unavailable. Please retry shortly.",
      });
    }
  }

  next();
});

// Production Health Check Endpoints (GET /health and GET /api/health)
const healthHandler = (req, res) => {
  const dbStatus = getConnectionStatus();
  const isHealthy = dbStatus.isConnected && !isShuttingDown;

  const payload = {
    status: isHealthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || "development",
    database: dbStatus,
  };

  return res.status(isHealthy ? 200 : 503).json(payload);
};

app.get("/health", healthHandler);
app.get("/api/health", healthHandler);

// Dual-bind routes to support both /api/* and root /* (for local, Render, and Vercel rewrites)
const routePairs = [
  ["/auth", authRoutes],
  ["/projects", projectRoutes],
  ["/tasks", taskRoutes],
  ["/employees", employeeRoutes],
  ["/admin", adminRoutes],
  ["/organization", organizationRoutes],
  ["/meetings", meetingRoutes],
  ["/notifications", notificationRoutes],
  ["/groups", groupRoutes],
  ["/performance", performanceRoutes],
  ["/search", searchRoutes],
  ["/workconnect", workConnectRoutes],
  ["/helpdesk", helpDeskRoutes],
];

routePairs.forEach(([prefix, handler]) => {
  app.use(`/api${prefix}`, handler);
  app.use(prefix, handler);
});

// General Root Information Endpoint
const rootHandler = (req, res) => {
  res.json({
    status: "online",
    message: "Hierarchical Task Manager & Progress Monitoring API is running!",
    endpoints: {
      health: "/health",
      auth: "/api/auth",
      projects: "/api/projects",
      tasks: "/api/tasks",
      adminSummary: "/api/admin/summary",
      hierarchy: "/api/admin/hierarchy",
      employees: "/api/employees",
    },
  });
};

app.get("/api", rootHandler);
app.get("/", rootHandler);

// Helper to initialize WorkConnect Socket.IO
const initializeSocketIO = (httpServer) => {
  try {
    const { Server } = require("socket.io");
    const io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      },
    });
    setWorkConnectIO(io);

    io.on("connection", (socket) => {
      socket.on("register_user", (userId) => {
        if (userId) {
          socket.join(`user:${userId}`);
        }
      });

      socket.on("join_session", (sessionId) => {
        if (sessionId) {
          socket.join(`session:${sessionId}`);
        }
      });

      socket.on("leave_session", (sessionId) => {
        if (sessionId) {
          socket.leave(`session:${sessionId}`);
        }
      });

      socket.on("signal", (data) => {
        if (data && data.sessionId) {
          socket.to(`session:${data.sessionId}`).emit("signal", data);
        }
      });

      socket.on("status_change", (data) => {
        if (data && data.userId && data.status) {
          io.emit("employee_status_update", data);
        }
      });
    });
    console.log("[Socket.IO] WorkConnect Socket.IO initialized successfully.");
  } catch (ioErr) {
    console.warn("[Socket.IO] Socket.IO initialization skipped:", ioErr.message);
  }
};

// Graceful Shutdown Handler for Render deployments & process lifecycle
let httpServer = null;
let isStarting = false;

const setupGracefulShutdown = (serverInstance) => {
  const shutdown = async (signal) => {
    if (isShuttingDown) {
      console.log(`[Shutdown] Graceful shutdown already in progress. Ignoring duplicate ${signal} signal.`);
      return;
    }
    isShuttingDown = true;
    console.log(`[Shutdown] Received ${signal}. Starting graceful shutdown procedure...`);

    // Safety timeout to prevent hung processes (Render allows up to 30s before SIGKILL)
    const forceExitTimeout = setTimeout(() => {
      console.error("[Shutdown] Graceful shutdown timed out after 15s. Forcing exit.");
      process.exit(1);
    }, 15000);
    forceExitTimeout.unref();

    try {
      // 1. Stop receiving new HTTP requests
      if (serverInstance && serverInstance.listening) {
        console.log("[Shutdown] Closing HTTP server listener...");
        await new Promise((resolve) => {
          serverInstance.close((err) => {
            if (err) {
              console.warn("[Shutdown] HTTP server close notification:", err.message);
            }
            resolve();
          });
        });
        console.log("[Shutdown] HTTP server successfully closed. In-flight requests drained.");
      }

      // 2. Close MongoDB connection pool to release Atlas sockets
      await disconnectDB();

      clearTimeout(forceExitTimeout);
      console.log("[Shutdown] All resources released cleanly. Exiting process.");
      process.exit(0);
    } catch (shutdownErr) {
      console.error("[Shutdown] Error during graceful shutdown:", shutdownErr.message);
      clearTimeout(forceExitTimeout);
      process.exit(1);
    }
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
};

// Server Startup Function
const startServer = async () => {
  if (httpServer || isStarting) {
    return httpServer;
  }
  isStarting = true;

  try {
    // 1. Establish MongoDB connection BEFORE starting Express HTTP listener
    console.log("[Startup] Initializing MongoDB connection...");
    try {
      await connectDB();
    } catch (dbErr) {
      console.warn("[Startup] Initial DB connect warning (will retry on incoming requests):", dbErr.message);
      console.log("[Startup] Server will still start to bind port and allow health check probing.");
    }

    // 2. Start HTTP listener on configured Render PORT and 0.0.0.0 host
    const PORT = process.env.PORT || 5000;
    const HOST = process.env.HOST || "0.0.0.0";

    httpServer = app.listen(PORT, HOST, () => {
      console.log(`[Server] Running in ${process.env.NODE_ENV || "development"} mode on http://${HOST}:${PORT}`);
      console.log(`[Server] Health Check available at http://${HOST}:${PORT}/health`);
    });

    // 3. Initialize Socket.IO
    initializeSocketIO(httpServer);

    // 4. Server error listeners
    httpServer.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(`[Server] Port ${PORT} is already in use by another process. Please stop it or change PORT in .env.`);
      } else {
        console.error("[Server] Server error:", error.message);
      }
    });

    // 5. Register Graceful Shutdown handlers
    setupGracefulShutdown(httpServer);

    return httpServer;
  } catch (err) {
    console.error("[Startup] Server startup error:", err.message);
    const PORT = process.env.PORT || 5000;
    if (!httpServer) {
      httpServer = app.listen(PORT, "0.0.0.0", () => {
        console.log(`[Server] Fallback listener running on port ${PORT}`);
      });
    }
    return httpServer;
  } finally {
    isStarting = false;
  }
};

// Only start the HTTP listener when this file is executed directly (not when required by tests or serverless handlers)
if (require.main === module && !process.env.VERCEL) {
  startServer();
}

module.exports = app;
module.exports.startServer = startServer;
module.exports.setupGracefulShutdown = setupGracefulShutdown;
