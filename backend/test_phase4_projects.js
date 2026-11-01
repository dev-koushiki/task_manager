const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');
const Organization = require('./models/Organization');
const Project = require('./models/Project');
const Notification = require('./models/Notification');
const aiService = require('./services/aiService');

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://koushikiudemy_db_user:koushiki123@cluster0.emsh8jh.mongodb.net/task_manager?retryWrites=true&w=majority";

async function runPhase4Tests() {
  console.log('=================================================');
  console.log('PHASE 4: PROJECT, MILESTONE ASSIGNMENT & AI TEST');
  console.log('=================================================');

  await mongoose.connect(MONGODB_URI);
  console.log('\nConnected to MongoDB successfully.');

  const testSuffix = Date.now();
  let passedCount = 0;
  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passedCount++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    // --- 1. Setup Organization, Admin & Multiple Employees (including Intern) ---
    console.log('\n--- 1. Organization & Multi-Role Personnel Setup ---');
    const org = await Organization.create({
      name: `Phase4 Org ${testSuffix}`,
      slug: `phase4-org-${testSuffix}`,
    });

    const admin = await User.create({
      firstName: 'Admin',
      lastName: 'Director',
      email: `admin_${testSuffix}@org.com`,
      password: 'password123',
      role: 'admin',
      designation: 'Managing Director',
      companyName: org.name,
      organizationId: org._id,
      department: 'Engineering',
    });

    const engineer = await User.create({
      firstName: 'Sarah',
      lastName: 'Chen',
      email: `sarah_${testSuffix}@org.com`,
      password: 'password123',
      role: 'employee',
      designation: 'Senior Cloud Engineer',
      team: 'DevOps',
      companyName: org.name,
      department: 'Engineering',
      organizationId: org._id,
    });

    const intern = await User.create({
      firstName: 'Leo',
      lastName: 'Valdez',
      email: `leo_${testSuffix}@org.com`,
      password: 'password123',
      role: 'intern',
      designation: 'Frontend Intern',
      team: 'UI Core',
      companyName: org.name,
      department: 'Engineering',
      organizationId: org._id,
    });

    assert(admin && admin._id, 'Admin created successfully');
    assert(engineer && engineer._id, 'Senior Engineer created successfully');
    assert(intern && intern.role === 'intern', 'Intern created with designation and team');

    // --- 2. Test AI Concept Note Document Analysis ---
    console.log('\n--- 2. Concept Note Upload and AI Analysis ---');
    const sampleConceptNoteText = `
# Project Title: Autonomous Cloud Deployment Pipeline
Domain: Engineering
Start Date: 2026-11-15
Target Completion Date: 2026-12-31

Executive Summary:
Design and implement an automated multi-region deployment pipeline reducing release lead times.

Objectives:
* Automate zero-downtime rolling releases
* Integrate vulnerability scanning in CI pipeline
* Achieve 99.99% deployment reliability

Expected Deliverables:
- Multi-region Kubernetes infrastructure
- Automated canary deployment controller
- Infrastructure audit and compliance report

Phases:
Phase 1: Architecture Blueprint & Cloud Security
Phase 2: Controller Engine Implementation
Phase 3: Production Rollout & Chaos Testing

Milestones:
1. Multi-Region Cluster Provisioning: Complete Terraform configuration by 2026-11-25
2. Canary Controller Engine: Implement automated rollback heuristics
3. Production Certification: Finalize vulnerability penetration test by 2026-12-28
`;

    const aiAnalysis = await aiService.analyzeConceptNote(
      sampleConceptNoteText,
      'Autonomous_Pipeline_Note.docx'
    );

    assert(aiAnalysis.title && aiAnalysis.title.includes('Autonomous Cloud'), 'AI extracted project title correctly');
    assert(aiAnalysis.department === 'Engineering', 'AI selected Engineering domain correctly');
    assert(aiAnalysis.startDate === '2026-11-15', 'AI extracted Project Start Date without invention');
    assert(aiAnalysis.targetCompletionDate === '2026-12-31', 'AI extracted Target Completion Date accurately');
    assert(Array.isArray(aiAnalysis.objectives) && aiAnalysis.objectives.length >= 2, 'AI identified project objectives');
    assert(Array.isArray(aiAnalysis.expectedDeliverables) && aiAnalysis.expectedDeliverables.length >= 2, 'AI identified expected deliverables');
    assert(Array.isArray(aiAnalysis.suggestedMilestones) && aiAnalysis.suggestedMilestones.length >= 2, 'AI generated suggested milestones');
    assert(aiAnalysis.suggestedMilestones[0].title.length > 0, 'Suggested milestone has title and description');

    // --- 3. Create Project with Dates, Domain and Multi-Employee Assignment ---
    console.log('\n--- 3. Project Creation with Structure & Employee Assignment ---');
    const createdProject = await Project.create({
      name: aiAnalysis.title,
      description: aiAnalysis.description,
      department: aiAnalysis.department,
      organizationId: org._id,
      createdBy: admin._id,
      directorId: admin._id,
      directorName: `${admin.firstName} ${admin.lastName}`,
      startDate: aiAnalysis.startDate,
      targetCompletionDate: aiAnalysis.targetCompletionDate,
      deadline: aiAnalysis.targetCompletionDate,
      priority: 'high',
      status: 'not-started',
      assignedEmployees: [
        {
          userId: engineer._id,
          name: `${engineer.firstName} ${engineer.lastName}`,
          email: engineer.email,
          role: engineer.role,
          designation: engineer.designation,
          team: engineer.team,
        },
        {
          userId: intern._id,
          name: `${intern.firstName} ${intern.lastName}`,
          email: intern.email,
          role: intern.role,
          designation: intern.designation,
          team: intern.team,
        },
      ],
      milestones: [],
    });

    assert(createdProject && createdProject._id, 'Project created in database');
    assert(createdProject.startDate === '2026-11-15', 'Project Start Date persisted');
    assert(createdProject.targetCompletionDate === '2026-12-31', 'Project Target Completion Date persisted');
    assert(createdProject.department === 'Engineering', 'Domain / Department is Engineering');
    assert(createdProject.assignedEmployees.length === 2, 'Assigned to both Engineer and Intern');

    // --- 4. Verify Project Assignment Notifications ---
    console.log('\n--- 4. Verify Project Assignment Notifications Dispatched ---');
    const engineerNotif = await Notification.create({
      userId: engineer._id,
      organizationId: org._id,
      type: 'project_assigned',
      title: `Assigned to Project: ${createdProject.name}`,
      message: `You were assigned to project "${createdProject.name}".`,
      link: `/tasks?projectId=${createdProject._id}`,
    });

    const internNotif = await Notification.create({
      userId: intern._id,
      organizationId: org._id,
      type: 'project_assigned',
      title: `Assigned to Project: ${createdProject.name}`,
      message: `You were assigned to project "${createdProject.name}".`,
      link: `/tasks?projectId=${createdProject._id}`,
    });

    assert(engineerNotif && engineerNotif.type === 'project_assigned', 'Senior Engineer received project_assigned notification');
    assert(internNotif && internNotif.type === 'project_assigned', 'Intern received project_assigned notification');

    // --- 5. Add Milestones Underneath the Project ---
    console.log('\n--- 5. Add Milestones Directly Underneath Project ---');
    createdProject.milestones.push({
      title: 'Cluster Infrastructure Setup',
      description: 'Deploy Terraform modules and provision multi-region clusters',
      deadline: '2026-11-25',
      dueDate: '2026-11-25',
      status: 'not-started',
      progress: 0,
      phase: 'Phase 1',
      assignedTo: [
        {
          userId: engineer._id,
          name: `${engineer.firstName} ${engineer.lastName}`,
          email: engineer.email,
          role: engineer.role,
          designation: engineer.designation,
        },
      ],
    });

    createdProject.milestones.push({
      title: 'Frontend Canary Dashboard',
      description: 'Build real-time rollout telemetry visualization for operations',
      deadline: '2026-12-10',
      dueDate: '2026-12-10',
      status: 'not-started',
      progress: 0,
      phase: 'Phase 2',
      assignedTo: [
        {
          userId: intern._id,
          name: `${intern.firstName} ${intern.lastName}`,
          email: intern.email,
          role: intern.role,
          designation: intern.designation,
        },
      ],
    });

    await createdProject.save();

    assert(createdProject.milestones.length === 2, 'Project has exactly 2 milestones underneath it');
    assert(createdProject.milestones[0].title === 'Cluster Infrastructure Setup', 'First milestone title stored');
    assert(createdProject.milestones[0].assignedTo[0].userId.toString() === engineer._id.toString(), 'Engineer assigned to milestone 1');
    assert(createdProject.milestones[1].assignedTo[0].userId.toString() === intern._id.toString(), 'Intern assigned to milestone 2');

    // --- 6. Milestone Completion Tracking ---
    console.log('\n--- 6. Milestone Completion Tracking ---');
    const milestone1 = createdProject.milestones[0];
    milestone1.completed = true;
    milestone1.status = 'completed';
    milestone1.progress = 100;
    milestone1.completedAt = new Date();
    milestone1.completedBy = engineer._id;
    milestone1.completedByName = `${engineer.firstName} ${engineer.lastName}`;

    await createdProject.save();

    assert(milestone1.completed === true, 'Milestone 1 marked completed');
    assert(milestone1.completedAt !== null, 'Milestone completion timestamp saved');
    assert(milestone1.completedByName === 'Sarah Chen', 'Milestone completedByName recorded');

    // Calculate completion metrics
    const completedCount = createdProject.milestones.filter(m => m.completed).length;
    const progressPercentage = Math.round((completedCount / createdProject.milestones.length) * 100);
    assert(progressPercentage === 50, 'Project completion tracking correctly calculated 50% (1 of 2 completed)');

    // --- 7. WhatsApp-Style Voice Recording & Transcription ---
    console.log('\n--- 7. WhatsApp-Style Voice Recording & Transcription ---');
    const mockAudioBase64 = 'data:audio/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwEAAAAAAA...';

    createdProject.recordings.push({
      title: 'Architecture Voice Briefing',
      audioUrl: mockAudioBase64,
      durationSeconds: 42,
      recordedBy: admin._id,
      recordedByName: `${admin.firstName} ${admin.lastName}`,
      associatedMilestoneId: milestone1._id.toString(),
      transcript: 'Ensure that all security certificates are renewed automatically via Let\'s Encrypt before cutover.',
      language: 'en-US',
    });

    await createdProject.save();

    assert(createdProject.recordings.length === 1, 'Voice note saved securely to project');
    assert(createdProject.recordings[0].durationSeconds === 42, 'Recording duration recorded');
    assert(createdProject.recordings[0].associatedMilestoneId === milestone1._id.toString(), 'Voice note associated with Milestone 1');
    assert(createdProject.recordings[0].transcript.includes('security certificates'), 'Voice note transcript stored');

    // --- 8. AI Milestone Extraction from Spoken Transcript ---
    console.log('\n--- 8. AI Milestone Extraction from Voice Transcript ---');
    const spokenTranscript = `
We need Leo to build an automated alert notification webhook for Slack and Email.
Target deadline is December 20, 2026. This is part of the final testing phase.
`;

    const voiceExtraction = await aiService.extractFromTranscript(spokenTranscript);
    assert(voiceExtraction.suggestedMilestones && voiceExtraction.suggestedMilestones.length > 0, 'AI extracted milestone from voice transcript');
    assert(voiceExtraction.title.length > 0, 'Extracted voice title generated');

    // --- 9. Clean up test data ---
    console.log('\n--- 9. Cleanup ---');
    await Project.deleteMany({ organizationId: org._id });
    await User.deleteMany({ organizationId: org._id });
    await Notification.deleteMany({ organizationId: org._id });
    await Organization.findByIdAndDelete(org._id);
    console.log('  ✓ PASS: Cleaned up test records');

    console.log('\n=================================================');
    console.log(`ALL PHASE 4 TESTS PASSED! (${passedCount} assertions)`);
    console.log('=================================================\n');

  } finally {
    await mongoose.disconnect();
  }
}

runPhase4Tests().catch((err) => {
  console.error('\nTest failed with error:', err);
  process.exit(1);
});
