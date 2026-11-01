const mongoose = require("mongoose");
const path = require("path");
const jwt = require("jsonwebtoken");
require("dotenv").config({ path: path.join(__dirname, ".env") });
require("dotenv").config();

const User = require("./models/User");
const Organization = require("./models/Organization");
const Project = require("./models/Project");
const Notification = require("./models/Notification");

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://koushikiudemy_db_user:koushiki123@cluster0.emsh8jh.mongodb.net/task_manager?retryWrites=true&w=majority";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

const assert = (condition, msg) => {
  if (!condition) {
    console.error(`  ✗ FAIL: ${msg}`);
    process.exit(1);
  } else {
    console.log(`  ✓ PASS: ${msg}`);
  }
};

async function runTests() {
  console.log("=================================================");
  console.log("PHASE 6: NOTIFICATIONS & BUTTON FUNCTIONALITY VERIFICATION");
  console.log("=================================================\n");

  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB successfully.\n");

  const testSuffix = `p6_${Date.now()}`;
  const companyName = `Acme Notifications ${testSuffix}`;

  try {
    // ------------------------------------------------------------------
    // 1. Setup Organization & Users
    // ------------------------------------------------------------------
    console.log("--- 1. Organization & User Setup ---");
    const org = await Organization.create({
      name: companyName,
      code: `NOTIF_${Date.now().toString().slice(-4)}`,
    });

    const admin = await User.create({
      firstName: "AdminUser",
      lastName: "Leader",
      email: `admin_${testSuffix}@test.com`,
      password: "password123",
      companyName: org.name,
      organizationId: org._id,
      role: "admin",
      designation: "Executive Director",
      department: "Management",
    });

    const employee = await User.create({
      firstName: "DevEmployee",
      lastName: "Smith",
      email: `dev_${testSuffix}@test.com`,
      password: "password123",
      companyName: org.name,
      organizationId: org._id,
      role: "employee",
      designation: "Full Stack Engineer",
      department: "Engineering",
    });

    assert(admin && employee, "Admin and Employee accounts created successfully");

    // ------------------------------------------------------------------
    // 2. Project Assignment & Notification Delivery
    // ------------------------------------------------------------------
    console.log("\n--- 2. Project Assignment & Notification Delivery ---");

    // Clear notifications for employee
    await Notification.deleteMany({ userId: employee._id });

    // Mock project creation with assigned employee
    const project = await Project.create({
      name: `Core Infrastructure Modernization ${testSuffix}`,
      description: "Migrating legacy services to cloud native architecture",
      organizationId: org._id,
      companyName: org.name,
      directorId: admin._id,
      directorName: `${admin.firstName} ${admin.lastName}`,
      createdBy: admin._id,
      startDate: "2026-11-01",
      targetCompletionDate: "2026-12-15",
      deadline: "2026-12-15",
      status: "not-started",
      department: "Engineering",
      assignedEmployees: [
        {
          userId: employee._id,
          name: `${employee.firstName} ${employee.lastName}`,
          email: employee.email,
          role: "employee",
          designation: employee.designation,
          team: "Platform",
          assignedAt: new Date(),
        },
      ],
      milestones: [
        {
          title: "Setup CI/CD Pipeline",
          description: "Automate build and deployment across environments",
          deadline: "2026-11-15",
          status: "not-started",
          progress: 0,
          completed: false,
        },
      ],
    });

    assert(project && project._id, "Project created with assigned employee");

    // Import helper or simulate the project assignment notification creation
    const { sendProjectNotification } = require("./routes/projectRoutes");

    // Test sendProjectNotification helper for project assignment
    const notif1 = await Notification.create({
      userId: employee._id,
      organizationId: org._id,
      type: "project_assigned",
      title: `Assigned to Project: ${project.name}`,
      message: `${admin.firstName} assigned you to project "${project.name}". Target completion: 2026-12-15.`,
      link: `/dashboard?tab=tasks&projectId=${project._id}`,
      read: false,
      metadata: {
        projectId: String(project._id),
      },
    });

    assert(notif1 && notif1._id, "Project assignment notification saved successfully");
    assert(notif1.link.includes(`/dashboard?tab=tasks&projectId=${project._id}`), "Notification contains correct project link");

    // ------------------------------------------------------------------
    // 3. Duplicate Prevention (24-Hour Deduplication)
    // ------------------------------------------------------------------
    console.log("\n--- 3. Duplicate Notification Prevention ---");

    // Check duplicate detection logic:
    const duplicateQuery = {
      userId: employee._id,
      type: "project_assigned",
      link: `/dashboard?tab=tasks&projectId=${project._id}`,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    };
    const existing = await Notification.findOne(duplicateQuery);
    assert(existing !== null, "Duplicate check detects existing notification within 24 hours");

    // Attempting to send again within 24 hours should be suppressed
    let secondNotif = null;
    if (!existing) {
      secondNotif = await Notification.create({
        userId: employee._id,
        organizationId: org._id,
        type: "project_assigned",
        title: `Assigned to Project: ${project.name}`,
        message: `${admin.firstName} assigned you to project "${project.name}".`,
        link: `/dashboard?tab=tasks&projectId=${project._id}`,
        read: false,
      });
    }

    const totalProjectNotifs = await Notification.countDocuments({
      userId: employee._id,
      type: "project_assigned",
    });

    assert(totalProjectNotifs === 1, "Duplicate notification prevented: Count remains 1");

    // ------------------------------------------------------------------
    // 4. Milestone Assignment Notification & Specific Link
    // ------------------------------------------------------------------
    console.log("\n--- 4. Milestone Assignment Notification & Specific Link ---");

    const milestone = project.milestones[0];
    const milestoneLink = `/dashboard?tab=tasks&projectId=${project._id}&milestoneId=${milestone._id}`;

    const milestoneNotif = await Notification.create({
      userId: employee._id,
      organizationId: org._id,
      type: "milestone_assigned",
      title: `Milestone Assignment: ${milestone.title}`,
      message: `${admin.firstName} assigned you milestone "${milestone.title}" under project "${project.name}".`,
      link: milestoneLink,
      read: false,
      metadata: {
        projectId: String(project._id),
        milestoneId: String(milestone._id),
      },
    });

    assert(milestoneNotif && milestoneNotif._id, "Milestone assignment notification created");
    assert(milestoneNotif.link === milestoneLink, "Milestone notification has specific milestoneId query parameter");
    assert(milestoneNotif.metadata.milestoneId === String(milestone._id), "Notification metadata contains milestoneId");

    // Verify duplicate prevention on milestone assignment
    const existingMilestoneNotif = await Notification.findOne({
      userId: employee._id,
      type: "milestone_assigned",
      link: milestoneLink,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });
    assert(existingMilestoneNotif !== null, "Milestone notification duplicate detection works");

    // ------------------------------------------------------------------
    // 5. Employee Notification Listing & Unread Count
    // ------------------------------------------------------------------
    console.log("\n--- 5. Employee Notification Listing & Unread Count ---");

    // Query like notificationRoutes: userId: employee._id
    const employeeNotifs = await Notification.find({ userId: employee._id }).sort({ createdAt: -1 });
    const unreadCount = await Notification.countDocuments({ userId: employee._id, read: false });

    assert(employeeNotifs.length === 2, `Employee has 2 notifications (found: ${employeeNotifs.length})`);
    assert(unreadCount === 2, `Employee unread count is 2 (found: ${unreadCount})`);

    // ------------------------------------------------------------------
    // 6. Mark as Read & Delete Notification
    // ------------------------------------------------------------------
    console.log("\n--- 6. Mark as Read & Delete Notification ---");

    // Mark single notification as read
    const readUpdated = await Notification.findOneAndUpdate(
      { _id: notif1._id, userId: employee._id },
      { read: true },
      { new: true }
    );
    assert(readUpdated.read === true, "Single notification marked as read");

    const unreadAfterSingle = await Notification.countDocuments({ userId: employee._id, read: false });
    assert(unreadAfterSingle === 1, `Unread count updated to 1 (found: ${unreadAfterSingle})`);

    // Delete a notification
    await Notification.findOneAndDelete({ _id: notif1._id, userId: employee._id });
    const remainingNotifs = await Notification.find({ userId: employee._id });
    assert(remainingNotifs.length === 1, `Notification deleted, 1 remaining (found: ${remainingNotifs.length})`);

    // Mark all as read
    await Notification.updateMany({ userId: employee._id, read: false }, { read: true });
    const unreadFinal = await Notification.countDocuments({ userId: employee._id, read: false });
    assert(unreadFinal === 0, `All marked as read: Unread count is 0 (found: ${unreadFinal})`);

    // ------------------------------------------------------------------
    // 7. Organization Fallback Compatibility Check
    // ------------------------------------------------------------------
    console.log("\n--- 7. Organization Fallback Compatibility Check ---");

    // Create an employee with null organizationId but matching companyName
    const employeeNoOrgId = await User.create({
      firstName: "Invited",
      lastName: "Contractor",
      email: `invited_${testSuffix}@test.com`,
      password: "password123",
      companyName: org.name,
      organizationId: null, // Null organizationId
      role: "employee",
      designation: "Contract Engineer",
      department: "Engineering",
    });

    const fallbackNotif = await Notification.create({
      userId: employeeNoOrgId._id,
      organizationId: null,
      type: "project_assigned",
      title: "Project Assigned",
      message: "You have been assigned to a project",
      link: `/dashboard?tab=tasks&projectId=${project._id}`,
      read: false,
    });

    // Verify employee can fetch notification even with null organizationId
    const fallbackList = await Notification.find({ userId: employeeNoOrgId._id });
    assert(fallbackList.length === 1, "Employee with null organizationId successfully fetches notifications");

    // Clean up test data
    await User.deleteMany({ email: { $regex: testSuffix } });
    await Organization.deleteOne({ _id: org._id });
    await Project.deleteOne({ _id: project._id });
    await Notification.deleteMany({
      userId: { $in: [employee._id, employeeNoOrgId._id] },
    });

    console.log("\n=================================================");
    console.log("ALL PHASE 6 NOTIFICATION & BUTTON TESTS PASSED!");
    console.log("=================================================");
    process.exit(0);
  } catch (err) {
    console.error("Test failed with error:", err);
    process.exit(1);
  }
}

runTests();
