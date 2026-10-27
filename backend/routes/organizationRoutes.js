const express = require("express");
const Organization = require("../models/Organization");
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// Helper to get or create organization workspace for user
const getOrCreateUserOrg = async (user) => {
  let org = null;
  if (user.organizationId) {
    org = await Organization.findById(user.organizationId);
  }
  if (!org) {
    org = await Organization.findOne({
      $or: [{ adminId: user._id || user.id }, { name: user.companyName }],
    });
  }
  if (!org) {
    org = await Organization.create({
      name: user.companyName || "Organization Workspace",
      adminId: user._id || user.id,
    });
    // Link user to this org
    await User.findByIdAndUpdate(user._id || user.id, { organizationId: org._id });
  }
  return org;
};

// GET /api/organization - Current workspace structure, departments, levels, and positions
router.get("/", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const org = await getOrCreateUserOrg(user);
    res.json(org);
  } catch (error) {
    console.error("Error fetching organization:", error);
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/organization - Update organization name or settings
router.put("/", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const org = await getOrCreateUserOrg(user);

    if (req.body.name) org.name = req.body.name.trim();
    if (req.body.code) org.code = req.body.code.trim();

    await org.save();
    res.json({ message: "Organization updated successfully", organization: org });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/organization/departments - Add department
router.post("/departments", authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Department name is required" });
    }

    const user = await User.findById(req.user.id);
    const org = await getOrCreateUserOrg(user);

    const trimmed = name.trim();
    if (!org.departments.includes(trimmed)) {
      org.departments.push(trimmed);
      await org.save();
    }

    res.status(201).json({ message: "Department added", departments: org.departments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/organization/departments/:name - Remove department
router.delete("/departments/:name", authMiddleware, async (req, res) => {
  try {
    const deptName = decodeURIComponent(req.params.name);
    const user = await User.findById(req.user.id);
    const org = await getOrCreateUserOrg(user);

    org.departments = org.departments.filter((d) => d !== deptName);
    await org.save();

    res.json({ message: "Department removed", departments: org.departments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/organization/levels - Configure custom hierarchy levels
router.put("/levels", authMiddleware, async (req, res) => {
  try {
    const { levels } = req.body;
    if (!Array.isArray(levels) || levels.length === 0) {
      return res.status(400).json({ message: "Levels must be a non-empty array" });
    }

    const user = await User.findById(req.user.id);
    const org = await getOrCreateUserOrg(user);

    org.levels = levels.map((l, index) => ({
      level: Number(l.level) || index + 1,
      name: l.name || `Level ${index + 1}`,
      description: l.description || "",
    }));

    await org.save();
    res.json({ message: "Hierarchy levels updated", levels: org.levels });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/organization/positions - Create custom position with granular permissions
router.post("/positions", authMiddleware, async (req, res) => {
  try {
    const { title, level, department, permissions } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Position title is required" });
    }

    const user = await User.findById(req.user.id);
    const org = await getOrCreateUserOrg(user);

    const newPosition = {
      id: "pos_" + Date.now(),
      title: title.trim(),
      level: Number(level) || 4,
      department: department || "General",
      permissions: {
        canCreateProjects: Boolean(permissions?.canCreateProjects),
        canAssignTasks: Boolean(permissions?.canAssignTasks),
        canApproveWork: Boolean(permissions?.canApproveWork),
        canViewExecutiveSummary: Boolean(permissions?.canViewExecutiveSummary),
        canViewTeamTasks: Boolean(permissions?.canViewTeamTasks),
        canViewAllTasks: Boolean(permissions?.canViewAllTasks),
        canManageStructure: Boolean(permissions?.canManageStructure),
      },
    };

    org.positions.push(newPosition);
    await org.save();

    res.status(201).json({ message: "Custom position created", position: newPosition, positions: org.positions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/organization/positions/:id - Edit custom position
router.put("/positions/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, level, department, permissions } = req.body;

    const user = await User.findById(req.user.id);
    const org = await getOrCreateUserOrg(user);

    const posIndex = org.positions.findIndex((p) => p.id === id);
    if (posIndex === -1) {
      return res.status(404).json({ message: "Position not found" });
    }

    if (title) org.positions[posIndex].title = title.trim();
    if (level !== undefined) org.positions[posIndex].level = Number(level);
    if (department) org.positions[posIndex].department = department.trim();
    if (permissions) {
      org.positions[posIndex].permissions = {
        canCreateProjects: Boolean(permissions.canCreateProjects),
        canAssignTasks: Boolean(permissions.canAssignTasks),
        canApproveWork: Boolean(permissions.canApproveWork),
        canViewExecutiveSummary: Boolean(permissions.canViewExecutiveSummary),
        canViewTeamTasks: Boolean(permissions.canViewTeamTasks),
        canViewAllTasks: Boolean(permissions.canViewAllTasks),
        canManageStructure: Boolean(permissions.canManageStructure),
      };
    }

    await org.save();
    res.json({ message: "Position updated", position: org.positions[posIndex], positions: org.positions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/organization/positions/:id - Delete position
router.delete("/positions/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(req.user.id);
    const org = await getOrCreateUserOrg(user);

    org.positions = org.positions.filter((p) => p.id !== id);
    await org.save();

    res.json({ message: "Position deleted", positions: org.positions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/organization/apply-template - Load industry hierarchy template
router.post("/apply-template", authMiddleware, async (req, res) => {
  try {
    const { templateType } = req.body;
    const user = await User.findById(req.user.id);
    const org = await getOrCreateUserOrg(user);

    if (templateType === "tech_startup") {
      org.levels = [
        { level: 1, name: "Founders & Executive", description: "Strategic direction and company vision" },
        { level: 2, name: "Engineering & Product Leads", description: "Architecture, sprint milestones, and roadmaps" },
        { level: 3, name: "Senior Engineers & Designers", description: "Feature development and code/design reviews" },
        { level: 4, name: "Associates & Interns", description: "Sprint tickets and component execution" },
      ];
      org.departments = ["Product & Engineering", "UI/UX Design", "Growth & Marketing", "Customer Success", "Operations"];
      org.positions = [
        {
          id: "pos_startup_1",
          title: "Chief Technology Officer / Co-Founder",
          level: 1,
          department: "Product & Engineering",
          permissions: { canCreateProjects: true, canAssignTasks: true, canApproveWork: true, canViewExecutiveSummary: true, canViewTeamTasks: true, canViewAllTasks: true, canManageStructure: true },
        },
        {
          id: "pos_startup_2",
          title: "Engineering Lead / Architect",
          level: 2,
          department: "Product & Engineering",
          permissions: { canCreateProjects: true, canAssignTasks: true, canApproveWork: true, canViewExecutiveSummary: true, canViewTeamTasks: true, canViewAllTasks: false, canManageStructure: false },
        },
        {
          id: "pos_startup_3",
          title: "Senior Full-Stack Engineer",
          level: 3,
          department: "Product & Engineering",
          permissions: { canCreateProjects: false, canAssignTasks: true, canApproveWork: true, canViewExecutiveSummary: false, canViewTeamTasks: true, canViewAllTasks: false, canManageStructure: false },
        },
        {
          id: "pos_startup_4",
          title: "Software Developer",
          level: 4,
          department: "Product & Engineering",
          permissions: { canCreateProjects: false, canAssignTasks: false, canApproveWork: false, canViewExecutiveSummary: false, canViewTeamTasks: false, canViewAllTasks: false, canManageStructure: false },
        },
      ];
    } else if (templateType === "academic") {
      org.levels = [
        { level: 1, name: "Chancellor & Deans", description: "Institution governance and institutional milestones" },
        { level: 2, name: "Department Chairs", description: "Curriculum oversight and department programs" },
        { level: 3, name: "Principal Investigators / Professors", description: "Research labs and course coordination" },
        { level: 4, name: "Lecturers & Research Assistants", description: "Course instruction and lab deliverables" },
      ];
      org.departments = ["Computer Science", "Biological Sciences", "Dean of Students", "Research Administration", "Finance & Grants"];
      org.positions = [
        {
          id: "pos_acad_1",
          title: "Dean of Faculty",
          level: 1,
          department: "Dean of Students",
          permissions: { canCreateProjects: true, canAssignTasks: true, canApproveWork: true, canViewExecutiveSummary: true, canViewTeamTasks: true, canViewAllTasks: true, canManageStructure: true },
        },
        {
          id: "pos_acad_2",
          title: "Department Chair",
          level: 2,
          department: "Computer Science",
          permissions: { canCreateProjects: true, canAssignTasks: true, canApproveWork: true, canViewExecutiveSummary: true, canViewTeamTasks: true, canViewAllTasks: false, canManageStructure: false },
        },
        {
          id: "pos_acad_3",
          title: "Principal Investigator / Professor",
          level: 3,
          department: "Computer Science",
          permissions: { canCreateProjects: false, canAssignTasks: true, canApproveWork: true, canViewExecutiveSummary: false, canViewTeamTasks: true, canViewAllTasks: false, canManageStructure: false },
        },
        {
          id: "pos_acad_4",
          title: "Research Assistant",
          level: 4,
          department: "Computer Science",
          permissions: { canCreateProjects: false, canAssignTasks: false, canApproveWork: false, canViewExecutiveSummary: false, canViewTeamTasks: false, canViewAllTasks: false, canManageStructure: false },
        },
      ];
    } else {
      // Default Corporate Enterprise
      org.levels = [
        { level: 1, name: "Executive / C-Suite", description: "Strategic direction and enterprise KPIs" },
        { level: 2, name: "Vice Presidents & Directors", description: "Business unit governance and major projects" },
        { level: 3, name: "Managers & Team Leaders", description: "Operational execution and quality review" },
        { level: 4, name: "Specialists & Associates", description: "Task fulfillment and delivery" },
      ];
      org.departments = ["Executive Leadership", "Project Management Office", "Information Technology", "Sales & Marketing", "Human Resources", "Finance"];
      org.positions = [
        {
          id: "pos_corp_1",
          title: "Chief Executive Officer / General Manager",
          level: 1,
          department: "Executive Leadership",
          permissions: { canCreateProjects: true, canAssignTasks: true, canApproveWork: true, canViewExecutiveSummary: true, canViewTeamTasks: true, canViewAllTasks: true, canManageStructure: true },
        },
        {
          id: "pos_corp_2",
          title: "Director of Operations",
          level: 2,
          department: "Project Management Office",
          permissions: { canCreateProjects: true, canAssignTasks: true, canApproveWork: true, canViewExecutiveSummary: true, canViewTeamTasks: true, canViewAllTasks: false, canManageStructure: false },
        },
        {
          id: "pos_corp_3",
          title: "Operations Team Lead",
          level: 3,
          department: "Operations",
          permissions: { canCreateProjects: false, canAssignTasks: true, canApproveWork: true, canViewExecutiveSummary: false, canViewTeamTasks: true, canViewAllTasks: false, canManageStructure: false },
        },
        {
          id: "pos_corp_4",
          title: "Operations Associate",
          level: 4,
          department: "Operations",
          permissions: { canCreateProjects: false, canAssignTasks: false, canApproveWork: false, canViewExecutiveSummary: false, canViewTeamTasks: false, canViewAllTasks: false, canManageStructure: false },
        },
      ];
    }

    await org.save();
    res.json({ message: "Organization structure template applied", organization: org });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
