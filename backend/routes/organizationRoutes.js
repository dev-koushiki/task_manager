const express = require("express");
const Organization = require("../models/Organization");
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");
const { requirePermission } = require("../middleware/rbac");

const router = express.Router();

// Helper to get user's organization
const getUserOrg = async (user) => {
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
    await User.findByIdAndUpdate(user._id || user.id, { organizationId: org._id });
  }
  return org;
};

// GET /api/organization - Current workspace structure
router.get("/", authMiddleware, async (req, res) => {
  try {
    const org = await getUserOrg(req.user);
    res.json(org);
  } catch (error) {
    console.error("Error fetching organization:", error);
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/organization - Update organization name or settings
router.put("/", authMiddleware, requirePermission("canManageStructure"), async (req, res) => {
  try {
    const org = await getUserOrg(req.user);

    if (req.body.name) org.name = req.body.name.trim();
    if (req.body.code) org.code = req.body.code.trim();

    await org.save();
    res.json({ message: "Organization updated successfully", organization: org });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ======================== DEPARTMENTS ========================

// POST /api/organization/departments - Add department
router.post("/departments", authMiddleware, requirePermission("canManageStructure"), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Department name is required" });
    }

    const org = await getUserOrg(req.user);
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
router.delete("/departments/:name", authMiddleware, requirePermission("canManageStructure"), async (req, res) => {
  try {
    const deptName = decodeURIComponent(req.params.name);
    const org = await getUserOrg(req.user);

    org.departments = org.departments.filter((d) => d !== deptName);
    await org.save();

    res.json({ message: "Department removed", departments: org.departments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ======================== TEAMS ========================

// GET /api/organization/teams - Get all teams in company
router.get("/teams", authMiddleware, async (req, res) => {
  try {
    const org = await getUserOrg(req.user);
    res.json(org.teams || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/organization/teams - Create a team
router.post("/teams", authMiddleware, requirePermission("canManageStructure"), async (req, res) => {
  try {
    const { name, department, description, leadId, leadName, memberIds } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Team name is required." });
    }

    const org = await getUserOrg(req.user);

    const newTeam = {
      id: "team_" + Date.now(),
      name: name.trim(),
      department: department ? department.trim() : (org.departments[0] || "General"),
      description: description ? description.trim() : "",
      leadId: leadId || null,
      leadName: leadName ? leadName.trim() : "",
      memberIds: Array.isArray(memberIds) ? memberIds : [],
    };

    org.teams.push(newTeam);
    await org.save();

    // If members provided, update their team field
    if (newTeam.memberIds.length > 0) {
      await User.updateMany(
        { _id: { $in: newTeam.memberIds }, organizationId: org._id },
        { team: newTeam.name, teamId: newTeam.id }
      );
    }
    if (leadId) {
      await User.findOneAndUpdate(
        { _id: leadId, organizationId: org._id },
        { team: newTeam.name, teamId: newTeam.id }
      );
    }

    res.status(201).json({ message: "Team created successfully", team: newTeam, teams: org.teams });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/organization/teams/:id - Update team
router.put("/teams/:id", authMiddleware, requirePermission("canManageStructure"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, department, description, leadId, leadName, memberIds } = req.body;

    const org = await getUserOrg(req.user);
    const teamIndex = org.teams.findIndex((t) => t.id === id);
    if (teamIndex === -1) {
      return res.status(404).json({ message: "Team not found" });
    }

    const team = org.teams[teamIndex];
    if (name) team.name = name.trim();
    if (department) team.department = department.trim();
    if (description !== undefined) team.description = description.trim();
    if (leadId !== undefined) team.leadId = leadId || null;
    if (leadName !== undefined) team.leadName = leadName.trim();
    if (Array.isArray(memberIds)) team.memberIds = memberIds;

    await org.save();

    // Sync member teams
    if (team.memberIds.length > 0) {
      await User.updateMany(
        { _id: { $in: team.memberIds }, organizationId: org._id },
        { team: team.name, teamId: team.id }
      );
    }

    res.json({ message: "Team updated successfully", team, teams: org.teams });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/organization/teams/:id - Remove team
router.delete("/teams/:id", authMiddleware, requirePermission("canManageStructure"), async (req, res) => {
  try {
    const { id } = req.params;
    const org = await getUserOrg(req.user);

    org.teams = org.teams.filter((t) => t.id !== id);
    await org.save();

    // Clear team reference from users in this team
    await User.updateMany({ teamId: id, organizationId: org._id }, { team: "", teamId: "" });

    res.json({ message: "Team removed successfully", teams: org.teams });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ======================== HIERARCHY LEVELS ========================

// PUT /api/organization/levels - Configure custom hierarchy levels
router.put("/levels", authMiddleware, requirePermission("canManageStructure"), async (req, res) => {
  try {
    const { levels } = req.body;
    if (!Array.isArray(levels) || levels.length === 0) {
      return res.status(400).json({ message: "Levels must be a non-empty array" });
    }

    const org = await getUserOrg(req.user);

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

// ======================== JOB ROLES / POSITIONS & RBAC ========================

// POST /api/organization/positions - Create custom position with granular permissions & scopes
router.post("/positions", authMiddleware, requirePermission("canManageStructure"), async (req, res) => {
  try {
    const { title, level, department, permissions, accessScopes } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Job role / position title is required" });
    }

    const org = await getUserOrg(req.user);

    const newPosition = {
      id: "pos_" + Date.now(),
      title: title.trim(),
      level: Number(level) || 4,
      department: department || (org.departments[0] || "General"),
      permissions: {
        canCreateTasks: Boolean(permissions?.canCreateTasks),
        canAssignTasks: Boolean(permissions?.canAssignTasks),
        canEditTasks: Boolean(permissions?.canEditTasks),
        canApproveTasks: Boolean(permissions?.canApproveTasks || permissions?.canApproveWork),
        canDeleteTasks: Boolean(permissions?.canDeleteTasks),
        canViewTasks: permissions?.canViewTasks !== undefined ? Boolean(permissions.canViewTasks) : true,
        canManageEmployees: Boolean(permissions?.canManageEmployees),
        canCreateProjects: Boolean(permissions?.canCreateProjects),
        canEditProjects: Boolean(permissions?.canEditProjects),
        canDeleteProjects: Boolean(permissions?.canDeleteProjects),
        canViewProjects: permissions?.canViewProjects !== undefined ? Boolean(permissions.canViewProjects) : true,
        canManageStructure: Boolean(permissions?.canManageStructure),
        canViewExecutiveSummary: Boolean(permissions?.canViewExecutiveSummary),
        // Legacy compatibility
        canApproveWork: Boolean(permissions?.canApproveTasks || permissions?.canApproveWork),
        canViewTeamTasks: Boolean(permissions?.canViewTeamTasks),
        canViewAllTasks: Boolean(permissions?.canViewAllTasks),
      },
      accessScopes: {
        taskScope: accessScopes?.taskScope || "own",
        projectScope: accessScopes?.projectScope || "project",
        employeeScope: accessScopes?.employeeScope || "own",
        reportScope: accessScopes?.reportScope || "own",
      },
    };

    org.positions.push(newPosition);
    await org.save();

    res.status(201).json({
      message: "Custom job role / position created",
      position: newPosition,
      positions: org.positions,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/organization/positions/:id - Edit custom position
router.put("/positions/:id", authMiddleware, requirePermission("canManageStructure"), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, level, department, permissions, accessScopes } = req.body;

    const org = await getUserOrg(req.user);
    const posIndex = org.positions.findIndex((p) => p.id === id);
    if (posIndex === -1) {
      return res.status(404).json({ message: "Position not found" });
    }

    if (title) org.positions[posIndex].title = title.trim();
    if (level !== undefined) org.positions[posIndex].level = Number(level);
    if (department) org.positions[posIndex].department = department.trim();

    if (permissions) {
      org.positions[posIndex].permissions = {
        canCreateTasks: Boolean(permissions.canCreateTasks),
        canAssignTasks: Boolean(permissions.canAssignTasks),
        canEditTasks: Boolean(permissions.canEditTasks),
        canApproveTasks: Boolean(permissions.canApproveTasks || permissions.canApproveWork),
        canDeleteTasks: Boolean(permissions.canDeleteTasks),
        canViewTasks: permissions.canViewTasks !== undefined ? Boolean(permissions.canViewTasks) : true,
        canManageEmployees: Boolean(permissions.canManageEmployees),
        canCreateProjects: Boolean(permissions.canCreateProjects),
        canEditProjects: Boolean(permissions.canEditProjects),
        canDeleteProjects: Boolean(permissions.canDeleteProjects),
        canViewProjects: permissions.canViewProjects !== undefined ? Boolean(permissions.canViewProjects) : true,
        canManageStructure: Boolean(permissions.canManageStructure),
        canViewExecutiveSummary: Boolean(permissions.canViewExecutiveSummary),
        canApproveWork: Boolean(permissions.canApproveTasks || permissions.canApproveWork),
        canViewTeamTasks: Boolean(permissions.canViewTeamTasks),
        canViewAllTasks: Boolean(permissions.canViewAllTasks),
      };
    }

    if (accessScopes) {
      org.positions[posIndex].accessScopes = {
        taskScope: accessScopes.taskScope || org.positions[posIndex].accessScopes?.taskScope || "own",
        projectScope: accessScopes.projectScope || org.positions[posIndex].accessScopes?.projectScope || "project",
        employeeScope: accessScopes.employeeScope || org.positions[posIndex].accessScopes?.employeeScope || "own",
        reportScope: accessScopes.reportScope || org.positions[posIndex].accessScopes?.reportScope || "own",
      };
    }

    await org.save();
    res.json({
      message: "Position updated",
      position: org.positions[posIndex],
      positions: org.positions,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/organization/positions/:id - Delete position
router.delete("/positions/:id", authMiddleware, requirePermission("canManageStructure"), async (req, res) => {
  try {
    const { id } = req.params;
    const org = await getUserOrg(req.user);

    org.positions = org.positions.filter((p) => p.id !== id);
    await org.save();

    res.json({ message: "Position deleted", positions: org.positions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ======================== RELATIONSHIP TYPES ========================

// GET /api/organization/relationship-types
router.get("/relationship-types", authMiddleware, async (req, res) => {
  try {
    const org = await getUserOrg(req.user);
    res.json(org.relationshipTypes || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/organization/relationship-types - Add custom relationship type
router.post("/relationship-types", authMiddleware, requirePermission("canManageStructure"), async (req, res) => {
  try {
    const { id, name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Relationship type name is required." });
    }

    const org = await getUserOrg(req.user);
    const key = (id || name.trim().toLowerCase().replace(/\s+/g, "_")).replace(/[^a-z0-9_]/g, "");

    const exists = org.relationshipTypes.some((r) => r.id === key);
    if (!exists) {
      org.relationshipTypes.push({
        id: key,
        name: name.trim(),
        description: description ? description.trim() : "",
      });
      await org.save();
    }

    res.status(201).json({
      message: "Relationship type added",
      relationshipTypes: org.relationshipTypes,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ======================== TEMPLATES ========================

// POST /api/organization/apply-template - Load industry hierarchy template
router.post("/apply-template", authMiddleware, requirePermission("canManageStructure"), async (req, res) => {
  try {
    const { templateType } = req.body;
    const org = await getUserOrg(req.user);

    if (templateType === "tech_startup") {
      org.levels = [
        { level: 1, name: "Founders & Executive", description: "Strategic direction and company vision" },
        { level: 2, name: "Engineering & Product Leads", description: "Architecture, sprint milestones, and roadmaps" },
        { level: 3, name: "Senior Engineers & Designers", description: "Feature development and code/design reviews" },
        { level: 4, name: "Associates & Interns", description: "Sprint tickets and component execution" },
      ];
      org.departments = ["Product & Engineering", "UI/UX Design", "Growth & Marketing", "Customer Success", "Operations"];
      org.teams = [
        { id: "team_eng", name: "Full-Stack Squad", department: "Product & Engineering", description: "Product features & API", memberIds: [] },
        { id: "team_growth", name: "Growth Squad", department: "Growth & Marketing", description: "Funnels and acquisition", memberIds: [] },
      ];
      org.positions = [
        {
          id: "pos_startup_1",
          title: "Chief Technology Officer / Co-Founder",
          level: 1,
          department: "Product & Engineering",
          permissions: {
            canCreateTasks: true, canAssignTasks: true, canEditTasks: true, canApproveTasks: true,
            canDeleteTasks: true, canViewTasks: true, canManageEmployees: true, canCreateProjects: true,
            canEditProjects: true, canDeleteProjects: true, canViewProjects: true, canManageStructure: true,
            canViewExecutiveSummary: true, canApproveWork: true, canViewTeamTasks: true, canViewAllTasks: true,
          },
          accessScopes: { taskScope: "company", projectScope: "company", employeeScope: "company", reportScope: "company" },
        },
        {
          id: "pos_startup_2",
          title: "Engineering Lead / Architect",
          level: 2,
          department: "Product & Engineering",
          permissions: {
            canCreateTasks: true, canAssignTasks: true, canEditTasks: true, canApproveTasks: true,
            canDeleteTasks: false, canViewTasks: true, canManageEmployees: false, canCreateProjects: true,
            canEditProjects: true, canDeleteProjects: false, canViewProjects: true, canManageStructure: false,
            canViewExecutiveSummary: true, canApproveWork: true, canViewTeamTasks: true, canViewAllTasks: false,
          },
          accessScopes: { taskScope: "department", projectScope: "department", employeeScope: "department", reportScope: "department" },
        },
        {
          id: "pos_startup_3",
          title: "Senior Full-Stack Engineer",
          level: 3,
          department: "Product & Engineering",
          permissions: {
            canCreateTasks: true, canAssignTasks: true, canEditTasks: true, canApproveTasks: true,
            canDeleteTasks: false, canViewTasks: true, canManageEmployees: false, canCreateProjects: false,
            canEditProjects: false, canDeleteProjects: false, canViewProjects: true, canManageStructure: false,
            canViewExecutiveSummary: false, canApproveWork: true, canViewTeamTasks: true, canViewAllTasks: false,
          },
          accessScopes: { taskScope: "team", projectScope: "project", employeeScope: "team", reportScope: "team" },
        },
        {
          id: "pos_startup_4",
          title: "Software Developer",
          level: 4,
          department: "Product & Engineering",
          permissions: {
            canCreateTasks: false, canAssignTasks: false, canEditTasks: false, canApproveTasks: false,
            canDeleteTasks: false, canViewTasks: true, canManageEmployees: false, canCreateProjects: false,
            canEditProjects: false, canDeleteProjects: false, canViewProjects: true, canManageStructure: false,
            canViewExecutiveSummary: false, canApproveWork: false, canViewTeamTasks: false, canViewAllTasks: false,
          },
          accessScopes: { taskScope: "own", projectScope: "project", employeeScope: "own", reportScope: "own" },
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
      org.teams = [
        { id: "team_corp_1", name: "Operations Squad", department: "Information Technology", description: "Core enterprise ops", memberIds: [] },
      ];
      org.positions = [
        {
          id: "pos_corp_1",
          title: "Chief Executive Officer / General Manager",
          level: 1,
          department: "Executive Leadership",
          permissions: {
            canCreateTasks: true, canAssignTasks: true, canEditTasks: true, canApproveTasks: true,
            canDeleteTasks: true, canViewTasks: true, canManageEmployees: true, canCreateProjects: true,
            canEditProjects: true, canDeleteProjects: true, canViewProjects: true, canManageStructure: true,
            canViewExecutiveSummary: true, canApproveWork: true, canViewTeamTasks: true, canViewAllTasks: true,
          },
          accessScopes: { taskScope: "company", projectScope: "company", employeeScope: "company", reportScope: "company" },
        },
        {
          id: "pos_corp_2",
          title: "Director of Operations",
          level: 2,
          department: "Project Management Office",
          permissions: {
            canCreateTasks: true, canAssignTasks: true, canEditTasks: true, canApproveTasks: true,
            canDeleteTasks: false, canViewTasks: true, canManageEmployees: false, canCreateProjects: true,
            canEditProjects: true, canDeleteProjects: false, canViewProjects: true, canManageStructure: false,
            canViewExecutiveSummary: true, canApproveWork: true, canViewTeamTasks: true, canViewAllTasks: false,
          },
          accessScopes: { taskScope: "project", projectScope: "project", employeeScope: "department", reportScope: "department" },
        },
        {
          id: "pos_corp_3",
          title: "Operations Team Lead",
          level: 3,
          department: "Operations",
          permissions: {
            canCreateTasks: true, canAssignTasks: true, canEditTasks: true, canApproveTasks: true,
            canDeleteTasks: false, canViewTasks: true, canManageEmployees: false, canCreateProjects: false,
            canEditProjects: false, canDeleteProjects: false, canViewProjects: true, canManageStructure: false,
            canViewExecutiveSummary: false, canApproveWork: true, canViewTeamTasks: true, canViewAllTasks: false,
          },
          accessScopes: { taskScope: "team", projectScope: "project", employeeScope: "team", reportScope: "team" },
        },
        {
          id: "pos_corp_4",
          title: "Operations Associate",
          level: 4,
          department: "Operations",
          permissions: {
            canCreateTasks: false, canAssignTasks: false, canEditTasks: false, canApproveTasks: false,
            canDeleteTasks: false, canViewTasks: true, canManageEmployees: false, canCreateProjects: false,
            canEditProjects: false, canDeleteProjects: false, canViewProjects: true, canManageStructure: false,
            canViewExecutiveSummary: false, canApproveWork: false, canViewTeamTasks: false, canViewAllTasks: false,
          },
          accessScopes: { taskScope: "own", projectScope: "project", employeeScope: "own", reportScope: "own" },
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
