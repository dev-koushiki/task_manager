const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const projectRoutes = require("./routes/projectRoutes");
const taskRoutes = require("./routes/taskRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const adminRoutes = require("./routes/adminRoutes");
const organizationRoutes = require("./routes/organizationRoutes");

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/organization", organizationRoutes);

// Test & Health route
app.get("/", (req, res) => {
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
});

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/task_manager";

mongoose
  .connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  })
  .then(() => {
    console.log("MongoDB connected successfully!");
  })
  .catch((error) => {
    console.warn("MongoDB connection warning:", error.message);
    console.warn("Note: Ensure your IP is whitelisted on MongoDB Atlas or a local MongoDB server is running.");
  });

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
