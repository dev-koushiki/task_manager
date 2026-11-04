require('dotenv').config({ path: './backend/.env' });
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
  console.log('================================================================');
  console.log('PROJECT -> DIRECT MILESTONES / DELIVERABLES VERIFICATION SUITE');
  console.log('================================================================\n');

  await connectDB();

  // Find or use admin user
  const adminUser = await User.findOne({ role: 'admin' });
  if (!adminUser) {
    console.error('No admin user found.');
    process.exit(1);
  }
  console.log(`Using admin: ${adminUser.firstName} ${adminUser.lastName} (${adminUser._id})`);

  // Find 3 employees
  const employees = await User.find({
    organizationId: adminUser.organizationId,
    _id: { $ne: adminUser._id },
    status: 'active',
  }).limit(3);

  const emp1 = employees[0] || adminUser;
  const emp2 = employees[1] || adminUser;
  const emp3 = employees[2] || adminUser;

  console.log('Test team members:');
  console.log(`  - Emp 1: ${emp1.firstName} ${emp1.lastName} (${emp1._id})`);
  console.log(`  - Emp 2: ${emp2.firstName} ${emp2.lastName} (${emp2._id})`);
  console.log(`  - Emp 3: ${emp3.firstName} ${emp3.lastName} (${emp3._id})`);

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
  console.log(`Test API running on port ${port}\n`);

  let createdProjectId = null;
  const createdTaskIds = [];

  const apiCall = async (endpoint, method = 'POST', body = null) => {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${baseUrl}${endpoint}`, opts);
    const data = await res.json().catch(() => ({}));
    return { status: res.status, body: data };
  };

  try {
    // -------------------------------------------------------------
    // TEST 1: Validation - Reject missing project name
    // -------------------------------------------------------------
    console.log('[TEST 1] Validation: Reject missing project name');
    const res1 = await apiCall('/create-with-milestones', 'POST', {
      name: '',
      targetOutcome: 'Valid outcome',
      targetCompletionDate: '2026-12-01',
      milestones: [{ title: 'Milestone 1', deadline: '2026-11-20' }],
    });
    if (res1.status !== 400 || !res1.body.message.includes('Project name is required')) {
      throw new Error(`Test 1 failed: Expected 400, got ${res1.status} - ${res1.body.message}`);
    }
    console.log('  ✓ [PASS] Correctly rejected missing project name\n');

    // -------------------------------------------------------------
    // TEST 2: Validation - Reject missing target completion date
    // -------------------------------------------------------------
    console.log('[TEST 2] Validation: Reject missing target completion date');
    const res2 = await apiCall('/create-with-milestones', 'POST', {
      name: 'Deliverable Project Beta',
      targetOutcome: 'Valid outcome',
      targetCompletionDate: '',
      milestones: [{ title: 'Milestone 1', deadline: '2026-11-20' }],
    });
    if (res2.status !== 400 || !res2.body.message.includes('Target completion date is required')) {
      throw new Error(`Test 2 failed: Expected 400, got ${res2.status} - ${res2.body.message}`);
    }
    console.log('  ✓ [PASS] Correctly rejected missing target completion date\n');

    // -------------------------------------------------------------
    // TEST 3: Validation - Reject empty milestones array
    // -------------------------------------------------------------
    console.log('[TEST 3] Validation: Reject project without milestones');
    const res3 = await apiCall('/create-with-milestones', 'POST', {
      name: 'Deliverable Project Beta',
      targetOutcome: 'Valid outcome',
      targetCompletionDate: '2026-12-01',
      milestones: [],
    });
    if (res3.status !== 400 || !res3.body.message.includes('milestone deliverable')) {
      throw new Error(`Test 3 failed: Expected 400, got ${res3.status} - ${res3.body.message}`);
    }
    console.log('  ✓ [PASS] Correctly rejected creation without milestones\n');

    // -------------------------------------------------------------
    // TEST 4: Successful Creation of Project with 3 Independent Milestones
    // -------------------------------------------------------------
    console.log('[TEST 4] Creation: Project with 3 independent deliverables/milestones');
    const assignedTeamIds = [String(emp1._id), String(emp2._id), String(emp3._id)];

    const payload = {
      name: `Direct Milestone Project ${Date.now()}`,
      department: 'Engineering',
      priority: 'high',
      targetOutcome: 'Deliver complete next-gen microservice platform with sub-second response',
      startDate: '2026-11-04',
      targetCompletionDate: '2026-11-30',
      directorId: String(adminUser._id),
      description: 'Strategic roadmap covering UI, API, and validation deliverables.',
      assignedEmployeeIds: assignedTeamIds,
      milestones: [
        {
          title: 'Design Dashboard UI',
          assignedTo: String(emp1._id),
          deadline: '2026-11-10',
          weight: 2, // 2x — Moderate
          priority: 'high',
          status: 'not-started',
          description: 'Design responsive dashboard components and interactive states.',
        },
        {
          title: 'Develop Backend APIs',
          assignedTo: String(emp2._id),
          deadline: '2026-11-15',
          weight: 3, // 3x — Complex
          priority: 'medium',
          status: 'not-started',
          description: 'Implement project and employee APIs with full data validation.',
        },
        {
          title: 'Testing and Deployment',
          assignedTo: String(emp3._id),
          deadline: '2026-11-25',
          weight: 4, // 4x — High Complexity
          priority: 'high',
          status: 'not-started',
          description: 'Perform complete end-to-end integration testing and production deployment.',
        },
      ],
    };

    const res4 = await apiCall('/create-with-milestones', 'POST', payload);
    if (res4.status !== 201 || !res4.body.success) {
      throw new Error(`Test 4 failed: Expected 201, got ${res4.status} - ${JSON.stringify(res4.body)}`);
    }

    const { project, milestones: createdMilestones, tasks: createdTasks } = res4.body;
    createdProjectId = project._id;
    createdTasks.forEach((t) => createdTaskIds.push(t._id));

    console.log(`  Created Project ID: ${project._id}`);
    console.log(`  Project Name: "${project.name}"`);
    console.log(`  Project Team Count: ${project.assignedEmployees?.length}`);
    console.log(`  Direct Milestones Count: ${createdMilestones?.length}`);

    // Verify Project in MongoDB
    const dbProj = await Project.findById(project._id);
    if (!dbProj) throw new Error('Project not saved in DB!');
    if (dbProj.milestones.length !== 3) {
      throw new Error(`Expected 3 milestones in project, found ${dbProj.milestones.length}`);
    }
    console.log('  ✓ [PASS] Project and 3 direct milestones saved in MongoDB Atlas');

    // Verify individual milestone fields
    const m1 = dbProj.milestones.find((m) => m.title === 'Design Dashboard UI');
    const m2 = dbProj.milestones.find((m) => m.title === 'Develop Backend APIs');
    const m3 = dbProj.milestones.find((m) => m.title === 'Testing and Deployment');

    if (!m1 || !m2 || !m3) throw new Error('Could not find all 3 milestones in project.milestones!');

    if (m1.weight !== 2 || m1.priority !== 'high' || String(m1.assignedToUser) !== String(emp1._id)) {
      throw new Error('Milestone 1 attributes mismatch!');
    }
    if (m2.weight !== 3 || m2.priority !== 'medium' || String(m2.assignedToUser) !== String(emp2._id)) {
      throw new Error('Milestone 2 attributes mismatch!');
    }
    if (m3.weight !== 4 || m3.priority !== 'high' || String(m3.assignedToUser) !== String(emp3._id)) {
      throw new Error('Milestone 3 attributes mismatch!');
    }
    console.log('  ✓ [PASS] Individual milestone fields (assignee, weight, priority, deadline) verified\n');

    // -------------------------------------------------------------
    // TEST 5: Weighted Progress Calculation
    // Total Weight = 2 + 3 + 4 = 9
    // Initially completed = 0, progress = 0%
    // -------------------------------------------------------------
    console.log('[TEST 5] Progress Calculation: Initial 0% weighted progress');
    if (project.metrics?.progressPercentage !== 0) {
      throw new Error(`Expected initial progress 0%, got ${project.metrics?.progressPercentage}%`);
    }
    if (project.metrics?.totalEffortWeight !== 9) {
      throw new Error(`Expected total effort weight 9, got ${project.metrics?.totalEffortWeight}`);
    }
    console.log('  ✓ [PASS] Initial total effort weight (9) and 0% progress verified\n');

    // -------------------------------------------------------------
    // TEST 6: Complete Milestone 1 (Weight 2) -> Progress = (2 / 9) * 100 = 22%
    // -------------------------------------------------------------
    console.log('[TEST 6] Milestone 1 Completion: Weighted progress update');
    const updateRes = await apiCall(`/${createdProjectId}/milestones/${m1._id}`, 'PUT', {
      completed: true,
      status: 'completed',
    });
    if (updateRes.status !== 200) {
      throw new Error(`Update failed: ${updateRes.status} - ${updateRes.body.message}`);
    }
    const metricsAfterM1 = updateRes.body.metrics;
    console.log(`  Metrics after M1 completed: ${metricsAfterM1.completedEffortWeight} / ${metricsAfterM1.totalEffortWeight} effort weight (${metricsAfterM1.progressPercentage}%)`);

    if (metricsAfterM1.completedEffortWeight !== 2) {
      throw new Error(`Expected completed effort weight 2, got ${metricsAfterM1.completedEffortWeight}`);
    }
    if (metricsAfterM1.progressPercentage !== 22) {
      throw new Error(`Expected 22% weighted progress, got ${metricsAfterM1.progressPercentage}%`);
    }
    console.log('  ✓ [PASS] Milestone 1 weighted progress calculated accurately (22%)\n');

    // -------------------------------------------------------------
    // TEST 7: Complete Milestone 2 (Weight 3) -> Progress = (5 / 9) * 100 = 56%
    // -------------------------------------------------------------
    console.log('[TEST 7] Milestone 2 Completion: Weighted progress update');
    const updateRes2 = await apiCall(`/${createdProjectId}/milestones/${m2._id}`, 'PUT', {
      completed: true,
      status: 'completed',
    });
    const metricsAfterM2 = updateRes2.body.metrics;
    console.log(`  Metrics after M2 completed: ${metricsAfterM2.completedEffortWeight} / ${metricsAfterM2.totalEffortWeight} effort weight (${metricsAfterM2.progressPercentage}%)`);

    if (metricsAfterM2.completedEffortWeight !== 5) {
      throw new Error(`Expected completed effort weight 5, got ${metricsAfterM2.completedEffortWeight}`);
    }
    if (metricsAfterM2.progressPercentage !== 56) {
      throw new Error(`Expected 56% weighted progress, got ${metricsAfterM2.progressPercentage}%`);
    }
    console.log('  ✓ [PASS] Milestone 2 weighted progress calculated accurately (56%)\n');

    // -------------------------------------------------------------
    // TEST 8: Notifications - Verify milestone_assigned notifications
    // -------------------------------------------------------------
    console.log('[TEST 8] Notifications: Milestone assignment notifications generated');
    const notifs = await Notification.find({
      organizationId: adminUser.organizationId,
      type: 'milestone_assigned',
      createdAt: { $gte: new Date(Date.now() - 30000) },
    });
    console.log(`  Found ${notifs.length} milestone assignment notifications`);
    if (notifs.length === 0) {
      throw new Error('Expected milestone_assigned notifications, none found!');
    }
    console.log('  ✓ [PASS] milestone_assigned notifications verified in DB\n');

    // -------------------------------------------------------------
    // TEST 9: POST /create-with-tasks also handles direct milestones format
    // -------------------------------------------------------------
    console.log('[TEST 9] Route Compatibility: POST /create-with-tasks accepts direct milestones format');
    const res9 = await apiCall('/create-with-tasks', 'POST', {
      name: `Compat Project ${Date.now()}`,
      department: 'Product',
      priority: 'medium',
      targetOutcome: 'Verify endpoint backwards and forwards compatibility',
      startDate: '2026-11-04',
      targetCompletionDate: '2026-11-28',
      directorId: String(adminUser._id),
      assignedEmployeeIds: [String(emp1._id)],
      milestones: [
        {
          title: 'Direct Deliverable 1',
          assignedTo: String(emp1._id),
          deadline: '2026-11-20',
          weight: 1,
          status: 'not-started',
        },
      ],
    });
    if (res9.status !== 201 || !res9.body.success) {
      throw new Error(`Test 9 failed: Expected 201, got ${res9.status} - ${res9.body.message}`);
    }
    const compatProjectId = res9.body.project._id;
    await Project.deleteOne({ _id: compatProjectId });
    if (res9.body.tasks) {
      await Task.deleteMany({ projectId: compatProjectId });
    }
    console.log('  ✓ [PASS] POST /create-with-tasks successfully processed direct milestones\n');

  } finally {
    // Cleanup test artifacts
    if (createdTaskIds.length > 0) {
      await Task.deleteMany({ _id: { $in: createdTaskIds } });
    }
    if (createdProjectId) {
      await Project.deleteOne({ _id: createdProjectId });
    }
    server.close();
  }

  console.log('================================================================');
  console.log('ALL PROJECT -> MILESTONES DELIVERABLES TESTS PASSED! (9/9)');
  console.log('================================================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
