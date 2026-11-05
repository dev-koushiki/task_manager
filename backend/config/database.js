const mongoose = require("mongoose");
const path = require("path");

// Ensure environment variables are loaded
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
require("dotenv").config();

// Supported connection pool & timeout options optimized for MongoDB Atlas M0 (Free Tier)
const getMongoOptions = () => {
  return {
    maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || process.env.MONGODB_MAX_POOL_SIZE || "5", 10),
    minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE || process.env.MONGODB_MIN_POOL_SIZE || "0", 10),
    maxIdleTimeMS: parseInt(process.env.MONGO_MAX_IDLE_TIME_MS || "30000", 10),
    serverSelectionTimeoutMS: parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || "5000", 10),
    waitQueueTimeoutMS: parseInt(process.env.MONGO_WAIT_QUEUE_TIMEOUT_MS || "5000", 10),
    connectTimeoutMS: parseInt(process.env.MONGO_CONNECT_TIMEOUT_MS || "10000", 10),
    socketTimeoutMS: parseInt(process.env.MONGO_SOCKET_TIMEOUT_MS || "45000", 10),
    autoIndex: process.env.NODE_ENV !== "production",
  };
};

const DEFAULT_MONGODB_URI =
  "mongodb+srv://koushikiudemy_db_user:koushiki123@cluster0.emsh8jh.mongodb.net/task_manager?retryWrites=true&w=majority";

// Retrieve URI from environment variables with safe fallback to production Atlas cluster
const getMongoURI = () => {
  return process.env.MONGODB_URI || process.env.MONGO_URI || DEFAULT_MONGODB_URI;
};

// Sanitize connection URI for safe logging (removes password/credentials)
const sanitizeURI = (uri) => {
  if (!uri || typeof uri !== "string") return "unknown-uri";
  return uri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@");
};

// Single shared connection promise to prevent duplicate concurrent connection attempts
let connectionPromise = null;
let listenersRegistered = false;

// Register connection lifecycle listeners once
const registerConnectionEvents = () => {
  if (listenersRegistered) return;
  listenersRegistered = true;

  mongoose.connection.on("connected", () => {
    const host = mongoose.connection.host || "unknown-host";
    const dbName = mongoose.connection.name || "unknown-db";
    const opts = getMongoOptions();
    console.log(
      `[MongoDB] Successfully connected to database "${dbName}" on host "${host}". Pool config: maxPoolSize=${opts.maxPoolSize}, minPoolSize=${opts.minPoolSize}, maxIdleTimeMS=${opts.maxIdleTimeMS}ms`
    );
  });

  mongoose.connection.on("error", (err) => {
    console.error("[MongoDB] Connection error event:", err.message);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("[MongoDB] Connection disconnected. MongoDB driver will automatically attempt reconnection...");
  });

  mongoose.connection.on("reconnected", () => {
    console.log("[MongoDB] Connection re-established successfully.");
  });

  mongoose.connection.on("close", () => {
    console.log("[MongoDB] Connection closed.");
  });
};

/**
 * Connect to MongoDB or return existing connection.
 * Reuses active connection and returns existing promise if a connection attempt is in-flight.
 */
const connectDB = async () => {
  // If already connected (readyState 1), reuse the active connection
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // If already connecting (readyState 2) and connection promise is active, wait for it
  if (connectionPromise) {
    return connectionPromise;
  }

  if (mongoose.connection.readyState === 2) {
    await new Promise((resolve) => {
      mongoose.connection.once("connected", resolve);
      mongoose.connection.once("error", resolve);
      setTimeout(resolve, 4000);
    });
    if (mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }
  }

  registerConnectionEvents();

  const uri = getMongoURI();
  const options = getMongoOptions();

  // Allow Mongoose command buffering during connection to prevent cold-start failures
  mongoose.set("bufferCommands", true);

  connectionPromise = mongoose
    .connect(uri, options)
    .then(() => {
      connectionPromise = null;
      return mongoose.connection;
    })
    .catch((err) => {
      connectionPromise = null;
      console.error(`[MongoDB] Connection failed (${sanitizeURI(uri)}):`, err.message);
      throw err;
    });

  return connectionPromise;
};

/**
 * Gracefully disconnect from MongoDB (used during SIGTERM / SIGINT shutdown).
 */
const disconnectDB = async () => {
  // If a connection attempt is in progress, wait for it to settle before closing
  if (connectionPromise) {
    try {
      await connectionPromise;
    } catch (_) {
      // Ignore initial connection failure
    }
  }

  if (mongoose.connection.readyState === 0) {
    return;
  }

  console.log("[MongoDB] Gracefully closing Mongoose connection pool...");
  // false parameter prevents force-closing and allows in-flight operations to complete
  await mongoose.connection.close(false);
  console.log("[MongoDB] Mongoose connection closed successfully.");
};

/**
 * Returns safe health and readiness details for monitoring endpoints.
 */
const getConnectionStatus = () => {
  const readyState = mongoose.connection.readyState;
  const stateLabels = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
    99: "uninitialized",
  };

  const opts = getMongoOptions();

  return {
    isConnected: readyState === 1,
    readyState,
    status: stateLabels[readyState] || "unknown",
    host: readyState === 1 ? mongoose.connection.host : null,
    dbName: readyState === 1 ? mongoose.connection.name : null,
    pool: {
      maxPoolSize: opts.maxPoolSize,
      minPoolSize: opts.minPoolSize,
      maxIdleTimeMS: opts.maxIdleTimeMS,
    },
  };
};

module.exports = {
  connectDB,
  disconnectDB,
  getConnectionStatus,
  getMongoOptions,
  mongoose,
};
