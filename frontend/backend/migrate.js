const mongoose = require("mongoose");
require("dotenv").config();

const User = require("./models/User");
const Organization = require("./models/Organization");
const Invitation = require("./models/Invitation");
const Project = require("./models/Project");
const Task = require("./models/Task");

async function migrate() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/task_manager";
  console.log("Connecting to MongoDB for migration...");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  console.log("Connected.");

  const users = await User.find();
  console.log(`Found ${users.length} users.`);

  for (const user of users) {
    let org = null;
    if (user.organizationId) {
      org = await Organization.findById(user.organizationId);
    }
    if (!org) {
      org = await Organization.findOne({
        $or: [{ adminId: user._id }, { name: user.companyName }],
      });
    }
    if (!org) {
      console.log(`Creating Organization for company: ${user.companyName}...`);
      org = await Organization.create({
        name: user.companyName || "Organization Workspace",
        adminId: user._id,
      });
    }

    user.organizationId = org._id;
    if (!user.role) {
      user.role = "admin";
    }

    if (user.role === "admin") {
      user.permissions = {
        canCreateTasks: true,
        canAssignTasks: true,
        canEditTasks: true,
        canApproveTasks: true,
        canDeleteTasks: true,
        canViewTasks: true,
        canManageEmployees: true,
        canCreateProjects: true,
        canEditProjects: true,
        canDeleteProjects: true,
        canViewProjects: true,
        canManageStructure: true,
        canViewExecutiveSummary: true,
        canApproveWork: true,
        canViewTeamTasks: true,
        canViewAllTasks: true,
      };
      user.accessScopes = {
        taskScope: "company",
        projectScope: "company",
        employeeScope: "company",
        reportScope: "company",
      };
    } else {
      if (!user.permissions || Object.keys(user.permissions).length === 0) {
        user.permissions = {
          canCreateTasks: user.role === "director" || user.role === "manager",
          canAssignTasks: user.role === "director" || user.role === "manager",
          canEditTasks: user.role === "director" || user.role === "manager",
          canApproveTasks: user.role === "director" || user.role === "manager",
          canDeleteTasks: false,
          canViewTasks: true,
          canManageEmployees: false,
          canCreateProjects: user.role === "director",
          canEditProjects: user.role === "director",
          canDeleteProjects: false,
          canViewProjects: true,
          canManageStructure: false,
          canViewExecutiveSummary: user.role === "director",
          canApproveWork: user.role === "director" || user.role === "manager",
          canViewTeamTasks: user.role === "director" || user.role === "manager",
          canViewAllTasks: false,
        };
      }
      if (!user.accessScopes || Object.keys(user.accessScopes).length === 0) {
        user.accessScopes = {
          taskScope: user.role === "director" ? "project" : user.role === "manager" ? "team" : "own",
          projectScope: "project",
          employeeScope: user.role === "director" ? "department" : user.role === "manager" ? "team" : "own",
          reportScope: "own",
        };
      }
    }

    if (!Array.isArray(user.reportingRelationships)) {
      user.reportingRelationships = [];
      if (user.reportsTo) {
        user.reportingRelationships.push({
          managerId: user.reportsTo,
          relationshipType: "direct",
        });
      }
    }

    await user.save();
    console.log(`Migrated user: ${user.email} -> org ${org._id}`);

    // Migrate invitations matching user's company
    const invites = await Invitation.find({
      $or: [{ organizationId: null }, { organizationId: { $exists: false } }],
      companyName: user.companyName,
    });
    for (const inv of invites) {
      inv.organizationId = org._id;
      await inv.save();
      console.log(`Migrated invitation: ${inv.email} -> org ${org._id}`);
    }

    // Migrate projects matching user
    const projects = await Project.find({
      $or: [{ organizationId: null }, { organizationId: { $exists: false } }],
      $or: [{ createdBy: user._id }, { directorId: user._id }],
    });
    for (const proj of projects) {
      proj.organizationId = org._id;
      await proj.save();
      console.log(`Migrated project: ${proj.name} -> org ${org._id}`);
    }

    // Migrate tasks matching user
    const tasks = await Task.find({
      $or: [{ organizationId: null }, { organizationId: { $exists: false } }],
      $or: [{ user: user._id }, { assignedTo: user._id }, { assignedBy: user._id }],
    });
    for (const t of tasks) {
      t.organizationId = org._id;
      await t.save();
      console.log(`Migrated task: ${t.title} -> org ${org._id}`);
    }
  }

  console.log("Migration complete!");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
