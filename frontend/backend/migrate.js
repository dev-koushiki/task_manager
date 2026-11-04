const { connectDB, disconnectDB } = require("./config/database");
require("dotenv").config();

const User = require("./models/User");
const Organization = require("./models/Organization");
const Invitation = require("./models/Invitation");
const Project = require("./models/Project");
const Task = require("./models/Task");

async function migrate() {
  console.log("Connecting to MongoDB for migration...");
  await connectDB();
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
        canManageProjects: true,
        canManageOrganization: true,
      };
    } else if (user.role === "manager") {
      user.permissions = {
        canCreateTasks: true,
        canAssignTasks: true,
        canEditTasks: true,
        canApproveTasks: true,
        canDeleteTasks: false,
        canViewTasks: true,
        canManageEmployees: true,
        canManageProjects: true,
        canManageOrganization: false,
      };
    } else {
      user.permissions = {
        canCreateTasks: false,
        canAssignTasks: false,
        canEditTasks: false,
        canApproveTasks: false,
        canDeleteTasks: false,
        canViewTasks: true,
        canManageEmployees: false,
        canManageProjects: false,
        canManageOrganization: false,
      };
    }
    await user.save();
    console.log(`Updated user: ${user.email} -> org ${org._id}`);

    // Update invitations sent by or for this user
    await Invitation.updateMany(
      { inviter: user._id, organizationId: { $exists: false } },
      { $set: { organizationId: org._id } }
    );
    await Invitation.updateMany(
      { email: user.email, organizationId: { $exists: false } },
      { $set: { organizationId: org._id } }
    );

    // Update projects created by this user
    const projects = await Project.find({
      $or: [{ owner: user._id }, { createdBy: user._id }],
    });
    for (const p of projects) {
      p.organizationId = org._id;
      await p.save();
      console.log(`Migrated project: ${p.title} -> org ${org._id}`);
    }

    // Update tasks created or assigned to this user
    const tasks = await Task.find({
      $or: [{ user: user._id }, { assignedTo: user._id }, { assignedBy: user._id }],
    });
    for (const t of tasks) {
      t.organizationId = org._id;
      await t.save();
      console.log(`Migrated task: ${t.title} -> org ${org._id}`);
    }
  }

  console.log("Migration complete!");
  await disconnectDB();
  process.exit(0);
}

migrate().catch(async (err) => {
  console.error("Migration error:", err);
  try {
    await disconnectDB();
  } catch (_) {}
  process.exit(1);
});
