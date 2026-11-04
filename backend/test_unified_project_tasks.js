require('dotenv').config();
const { connectDB } = require('./config/database');
const Project = require('./models/Project');
const Task = require('./models/Task');
const User = require('./models/User');
const Notification = require('./models/Notification');
const projectRoutes = require('./routes/projectRoutes');
const express = require('express');
const jwt = require('jsonwebtoken');

async function runTests() {
  console.log('=== STARTING UNIFIED PROJECT & TASKS CREATION TEST SUITE ===\n');
  await connectDB();

  // Find an admin user
  const adminUser = await User.findOne({ role: 'admin' });
  if (!adminUser) {
    console.error('No admin user found to test with.');
    process.exit(1);
  }
  console.log(`Using admin user: ${adminUser.firstName} ${adminUser.lastName} (${adminUser._id})`);

  // Find other active employees
  const employees = await User.find({
    organizationId: adminUser.organizationId,
    _id: { $ne: adminUser._id },
    status: 'active',
  }).limit(3);

  console.log(`Found ${employees.length} employees for team assignment:`);
  employees.forEach((e) => console.log(`  - ${e.firstName} ${e.lastName} (${e.role}, ${e.designation})`));

  const token = jwt.sign(
    { id: adminUser._id, role: adminUser.role, email: adminUser.email, organizationId: adminUser.organizationId },
    process.env.JWT_SECRET || 'taskflow-secret-key-production-2026',
    { expiresIn: '1h' }
  );

  const app = express();
  app.use(express.json());
  app.use('/api/projects', projectRoutes);

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/projects`;
  console.log(`Test server running on port ${port}`);

  let createdProjectId = null;
  const createdTaskIds = [];

  const apiCall = async (endpoint, body) => {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, body: data };
  };

  try {
    // TEST 1: Validation - Missing Project Name
    console.log('\n[TEST 1] Validation: Reject missing project name');
    const res1 = await apiCall('/create-with-tasks', {
      name: '',
      targetOutcome: 'Test outcome',
      targetCompletionDate: '2026-12-01',
      tasks: [{ title: 'Task 1', deadline: '2026-11-20' }],
    });
    console.log(`  Response status: ${res1.status}, message: "${res1.body.message}"`);
    if (res1.status !== 400 || !res1.body.message.includes('Project name is required')) {
      throw new Error('Test 1 failed: Expected 400 for missing project name');
    }
    console.log('  ✓ TEST 1 PASSED');

    // TEST 2: Validation - Missing Target Completion Date
    console.log('\n[TEST 2] Validation: Reject missing target completion date');
    const res2 = await apiCall('/create-with-tasks', {
      name: 'Test Project Alpha',
      targetOutcome: 'Test outcome',
      targetCompletionDate: '',
      tasks: [{ title: 'Task 1', deadline: '2026-11-20' }],
    });
    console.log(`  Response status: ${res2.status}, message: "${res2.body.message}"`);
    if (res2.status !== 400 || !res2.body.message.includes('Target completion date is required')) {
      throw new Error('Test 2 failed: Expected 400 for missing completion date');
    }
    console.log('  ✓ TEST 2 PASSED');

    // TEST 3: Validation - Start date later than Target Completion Date
    console.log('\n[TEST 3] Validation: Reject start date later than completion date');
    const res3 = await apiCall('/create-with-tasks', {
      name: 'Test Project Alpha',
      targetOutcome: 'Test outcome',
      startDate: '2026-12-10',
      targetCompletionDate: '2026-11-20',
      tasks: [{ title: 'Task 1', deadline: '2026-11-20' }],
    });
    console.log(`  Response status: ${res3.status}, message: "${res3.body.message}"`);
    if (res3.status !== 400 || !res3.body.message.includes('cannot be earlier')) {
      throw new Error('Test 3 failed: Expected 400 for invalid date range');
    }
    console.log('  ✓ TEST 3 PASSED');

    // TEST 4: Validation - Tasks with missing titles
    console.log('\n[TEST 4] Validation: Reject task with empty title');
    const res4 = await apiCall('/create-with-tasks', {
      name: 'Test Project Alpha',
      targetOutcome: 'Test outcome',
      startDate: '2026-11-01',
      targetCompletionDate: '2026-11-30',
      tasks: [{ title: '   ', deadline: '2026-11-20' }],
    });
    console.log(`  Response status: ${res4.status}, message: "${res4.body.message}"`);
    if (res4.status !== 400 || !res4.body.message.includes('requires a title')) {
      throw new Error('Test 4 failed: Expected 400 for task with empty title');
    }
    console.log('  ✓ TEST 4 PASSED');

    // TEST 5: Success - Unified Project + Team + Multiple Tasks + Independent Milestones
    console.log('\n[TEST 5] Success: Create project with team and 2 tasks with milestones');
    const assignedIds = employees.map((e) => String(e._id));
    const emp1 = employees[0] || adminUser;
    const emp2 = employees[1] || adminUser;

    const testPayload = {
      name: `Unified Portal Initiative ${Date.now()}`,
      department: 'Engineering',
      priority: 'high',
      targetOutcome: 'Deploy customer portal with sub-second response time and full offline sync',
      startDate: '2026-11-04',
      targetCompletionDate: '2026-11-30',
      directorId: String(adminUser._id),
      description: 'High-level multi-service architecture with micro-frontends and MongoDB Atlas.',
      assignedEmployeeIds: assignedIds,
      tasks: [
        {
          title: 'Design UI Component System & Theme Tokens',
          assignedTo: String(emp1._id),
          description: 'Build Figma tokens, accessibility-checked color palettes, and responsive layouts.',
          deadline: '2026-11-15',
          weight: 2,
          priority: 'high',
          status: 'in-progress',
          milestones: [
            { title: 'Create layout grid & typography tokens' },
            { title: 'Build responsive modal components' },
            { title: 'Conduct dark mode accessibility check' },
          ],
        },
        {
          title: 'Backend API Integration & End-to-End Validation',
          assignedTo: String(emp2._id),
          description: 'Implement atomic transactional routes and link with notification webhooks.',
          deadline: '2026-11-25',
          weight: 3,
          priority: 'urgent',
          status: 'not-started',
          milestones: [
            { title: 'Implement POST /create-with-tasks' },
            { title: 'Write integration test suite' },
          ],
        },
      ],
    };

    const res5 = await apiCall('/create-with-tasks', testPayload);

    console.log(`  Response status: ${res5.status}`);
    console.log(`  Response message: "${res5.body.message}"`);

    if (res5.status !== 201 || !res5.body.success) {
      console.error('Response body:', res5.body);
      throw new Error(`Test 5 failed with status ${res5.status}`);
    }

    const { project, tasks: createdTasks } = res5.body;
    createdProjectId = project._id;
    createdTasks.forEach((t) => createdTaskIds.push(t._id));

    console.log(`  Created Project ID: ${project._id}`);
    console.log(`  Project Name: "${project.name}"`);
    console.log(`  Assigned Employees count in Project: ${project.assignedEmployees?.length}`);
    console.log(`  Created Tasks count: ${createdTasks?.length}`);

    // Verify Project in MongoDB
    const dbProj = await Project.findById(project._id);
    if (!dbProj) throw new Error('Project was not saved to MongoDB!');
    if (dbProj.assignedEmployees.length < assignedIds.length) {
      throw new Error('Project team members were not saved properly!');
    }
    console.log('  ✓ Project verified in MongoDB Atlas');

    // Verify Tasks in MongoDB
    const dbTasks = await Task.find({ projectId: project._id });
    if (dbTasks.length !== 2) {
      throw new Error(`Expected 2 tasks in DB, found ${dbTasks.length}`);
    }

    const task1 = dbTasks.find((t) => t.title.includes('UI Component'));
    const task2 = dbTasks.find((t) => t.title.includes('Backend API'));

    if (!task1 || !task2) throw new Error('Created tasks could not be matched by title!');
    if (task1.milestones.length !== 3) {
      throw new Error(`Task 1 expected 3 milestones, found ${task1.milestones.length}`);
    }
    if (task2.milestones.length !== 2) {
      throw new Error(`Task 2 expected 2 milestones, found ${task2.milestones.length}`);
    }
    console.log('  ✓ Tasks and independent milestones verified in MongoDB Atlas');

    // Verify Notifications were sent
    const notifs = await Notification.find({
      organizationId: adminUser.organizationId,
      createdAt: { $gte: new Date(Date.now() - 30000) },
    });
    console.log(`  ✓ Found ${notifs.length} notifications generated during creation`);

    console.log('  ✓ TEST 5 PASSED');

  } finally {
    // Cleanup test artifacts
    if (createdTaskIds.length > 0) {
      console.log(`\nCleaning up ${createdTaskIds.length} test tasks...`);
      await Task.deleteMany({ _id: { $in: createdTaskIds } });
    }
    if (createdProjectId) {
      console.log(`Cleaning up test project ${createdProjectId}...`);
      await Project.deleteOne({ _id: createdProjectId });
    }
    server.close();
  }

  console.log('\n=== ALL UNIFIED PROJECT & TASK TESTS PASSED SUCCESSFULLY! ===\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
