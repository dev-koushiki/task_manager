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

// Ensure default tree exists for an organization
const ensureDefaultTree = async (org, user) => {
  if (!org.treeNodes || org.treeNodes.length === 0) {
    const adminId = org.adminId || user?._id || user?.id;
    let adminUser = null;
    if (adminId) {
      adminUser = await User.findById(adminId);
    }
    const adminTitle = adminUser?.designation || "Main Admin";
    const adminCode = adminUser?.employeeId || "EMP-001";
    if (adminUser && !adminUser.employeeId) {
      adminUser.employeeId = adminCode;
      await adminUser.save();
    }

    org.treeNodes = [
      {
        id: "node_root",
        title: adminTitle,
        parentId: null,
        employeeId: adminId || null,
        employeeCode: adminCode,
        department: adminUser?.department || "Executive Leadership",
        order: 0,
      },
      {
        id: "node_b",
        title: "Role B",
        parentId: "node_root",
        employeeId: null,
        employeeCode: "",
        department: "Operations",
        order: 0,
      },
      {
        id: "node_c",
        title: "Role C",
        parentId: "node_root",
        employeeId: null,
        employeeCode: "",
        department: "Engineering",
        order: 1,
      },
      {
        id: "node_d",
        title: "Role D",
        parentId: "node_c",
        employeeId: null,
        employeeCode: "",
        department: "Engineering",
        order: 0,
      },
      {
        id: "node_e",
        title: "Role E",
        parentId: "node_c",
        employeeId: null,
        employeeCode: "",
        department: "Engineering",
        order: 1,
      },
    ];
    org.markModified("treeNodes");
    await org.save();
  }
};

// Synchronize reporting relationships based on organizational tree
const syncTreeReportingRelationships = async (orgId) => {
  if (!orgId) return;
  const org = await Organization.findById(orgId);
  if (!org || !Array.isArray(org.treeNodes) || org.treeNodes.length === 0) return;

  const nodesById = new Map();
  org.treeNodes.forEach((node) => {
    nodesById.set(node.id, node);
  });

  const assignedUserIds = new Set();

  for (const node of org.treeNodes) {
    if (!node.employeeId) continue;
    const empIdStr = node.employeeId.toString();
    assignedUserIds.add(empIdStr);

    // Walk up the tree to find nearest ancestor with an employee assigned
    let managerEmployeeId = null;
    let curr = node;
    const visited = new Set([node.id]);

    while (curr && curr.parentId) {
      if (visited.has(curr.parentId)) break; // Prevent cycle
      visited.add(curr.parentId);
      curr = nodesById.get(curr.parentId);
      if (!curr) break;

      if (curr.employeeId && curr.employeeId.toString() !== empIdStr) {
        managerEmployeeId = curr.employeeId;
        break;
      }
    }

    const updateFields = {};
    if (node.employeeCode) {
      updateFields.employeeId = node.employeeCode;
    }

    if (managerEmployeeId) {
      updateFields.reportsTo = managerEmployeeId;
      updateFields.reportingRelationships = [
        { managerId: managerEmployeeId, relationshipType: "direct", assignedAt: new Date() },
      ];
    } else {
      updateFields.reportsTo = null;
      updateFields.reportingRelationships = [];
    }

    await User.findByIdAndUpdate(node.employeeId, { $set: updateFields });
  }

  // Clear reporting relationships for users in this org not in the tree
  const unassignedUsers = await User.find({
    organizationId: orgId,
    _id: { $nin: Array.from(assignedUserIds) },
    role: { $ne: "admin" },
  });

  for (const u of unassignedUsers) {
    if (u.reportsTo || (u.reportingRelationships && u.reportingRelationships.length > 0)) {
      u.reportsTo = null;
      u.reportingRelationships = [];
      await u.save();
    }
  }
};

const wouldCreateTreeCycle = (treeNodes, nodeId, newParentId) => {
  if (!newParentId) return false;
  if (nodeId === newParentId) return true;
  const nodesById = new Map(treeNodes.map((n) => [n.id, n]));
  let curr = nodesById.get(newParentId);
  const visited = new Set();
  while (curr) {
    if (curr.id === nodeId) return true;
    if (visited.has(curr.id)) break;
    visited.add(curr.id);
    curr = curr.parentId ? nodesById.get(curr.parentId) : null;
  }
  return false;
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

// ======================== ORGANIZATIONAL TREE ========================

// GET /api/organization/tree - Get full tree with populated employees and active profiles
router.get("/tree", authMiddleware, async (req, res) => {
  try {
    const org = await getUserOrg(req.user);
    await ensureDefaultTree(org, req.user);

    // Fetch all active employees in this organization
    const activeUsers = await User.find({
      organizationId: org._id,
      status: "active",
    }).select("firstName lastName email role designation department employeeId status");

    const assignedEmployeeMap = new Map();
    org.treeNodes.forEach((n) => {
      if (n.employeeId) {
        assignedEmployeeMap.set(n.employeeId.toString(), {
          nodeId: n.id,
          nodeTitle: n.title,
          employeeCode: n.employeeCode,
        });
      }
    });

    const activeEmployees = activeUsers.map((u) => {
      const assigned = assignedEmployeeMap.get(u._id.toString());
      return {
        _id: u._id,
        id: u._id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
        designation: u.designation,
        department: u.department,
        employeeId: u.employeeId || assigned?.employeeCode || "",
        isAssigned: Boolean(assigned),
        assignedNodeId: assigned?.nodeId || null,
        assignedNodeTitle: assigned?.nodeTitle || null,
      };
    });

    // Populate employee details onto treeNodes
    const userMap = new Map(activeUsers.map((u) => [u._id.toString(), u]));
    const populatedTreeNodes = org.treeNodes.map((n) => {
      const nodeObj = n.toObject ? n.toObject() : { ...n };
      if (n.employeeId) {
        const u = userMap.get(n.employeeId.toString());
        nodeObj.employee = u
          ? {
              _id: u._id,
              firstName: u.firstName,
              lastName: u.lastName,
              email: u.email,
              role: u.role,
              designation: u.designation,
              department: u.department,
              employeeId: u.employeeId || n.employeeCode || "",
            }
          : null;
      } else {
        nodeObj.employee = null;
      }
      return nodeObj;
    });

    res.json({
      organization: {
        _id: org._id,
        name: org.name,
        code: org.code,
        adminId: org.adminId,
      },
      treeNodes: populatedTreeNodes,
      activeEmployees,
    });
  } catch (error) {
    console.error("Error fetching organizational tree:", error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/organization/tree/nodes - Add new node
router.post("/tree/nodes", authMiddleware, requirePermission("canManageStructure"), async (req, res) => {
  try {
    const { title, parentId, department } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Position / Node title is required." });
    }

    const org = await getUserOrg(req.user);
    await ensureDefaultTree(org, req.user);

    let resolvedParentId = parentId || null;
    if (!resolvedParentId) {
      const rootNode = org.treeNodes.find((n) => !n.parentId);
      resolvedParentId = rootNode ? rootNode.id : null;
    } else {
      const parentExists = org.treeNodes.some((n) => n.id === resolvedParentId);
      if (!parentExists) {
        return res.status(400).json({ message: "Parent node does not exist in this organization." });
      }
    }

    const newNodeId = `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const siblingCount = org.treeNodes.filter((n) => n.parentId === resolvedParentId).length;

    const newNode = {
      id: newNodeId,
      title: title.trim(),
      parentId: resolvedParentId,
      employeeId: null,
      employeeCode: "",
      department: department ? department.trim() : "General",
      order: siblingCount,
    };

    org.treeNodes.push(newNode);
    org.markModified("treeNodes");
    await org.save();

    res.status(201).json({
      message: "Tree node created successfully",
      node: newNode,
      organization: org,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/organization/tree/nodes/:id - Update node details or change parent
router.put("/tree/nodes/:id", authMiddleware, requirePermission("canManageStructure"), async (req, res) => {
  try {
    const nodeId = req.params.id;
    const { title, department, parentId, order } = req.body;

    const org = await getUserOrg(req.user);
    await ensureDefaultTree(org, req.user);

    const nodeIndex = org.treeNodes.findIndex((n) => n.id === nodeId);
    if (nodeIndex === -1) {
      return res.status(404).json({ message: "Tree node not found." });
    }

    const targetNode = org.treeNodes[nodeIndex];

    if (title && title.trim()) targetNode.title = title.trim();
    if (department !== undefined) targetNode.department = department.trim();
    if (order !== undefined) targetNode.order = Number(order);

    if (parentId !== undefined && parentId !== targetNode.parentId) {
      if (targetNode.parentId === null) {
        return res.status(400).json({ message: "Cannot change parent of root node." });
      }
      if (wouldCreateTreeCycle(org.treeNodes, nodeId, parentId)) {
        return res.status(400).json({ message: "Moving this node would create a circular hierarchy." });
      }
      targetNode.parentId = parentId;
    }

    org.treeNodes[nodeIndex] = targetNode;
    org.markModified("treeNodes");
    await org.save();

    await syncTreeReportingRelationships(org._id);

    res.json({
      message: "Tree node updated successfully",
      node: targetNode,
      organization: org,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/organization/tree/nodes/:id - Delete node and re-parent children
router.delete("/tree/nodes/:id", authMiddleware, requirePermission("canManageStructure"), async (req, res) => {
  try {
    const nodeId = req.params.id;
    const org = await getUserOrg(req.user);
    await ensureDefaultTree(org, req.user);

    const targetNode = org.treeNodes.find((n) => n.id === nodeId);
    if (!targetNode) {
      return res.status(404).json({ message: "Tree node not found." });
    }

    if (!targetNode.parentId) {
      return res.status(400).json({ message: "Cannot delete the root organization node." });
    }

    const parentId = targetNode.parentId;

    // Re-parent children of this node to the deleted node's parent
    org.treeNodes.forEach((n) => {
      if (n.parentId === nodeId) {
        n.parentId = parentId;
      }
    });

    // Remove the node
    org.treeNodes = org.treeNodes.filter((n) => n.id !== nodeId);
    org.markModified("treeNodes");
    await org.save();

    await syncTreeReportingRelationships(org._id);

    res.json({
      message: "Tree node deleted and subordinate relationships reorganized successfully",
      organization: org,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/organization/tree/nodes/:id/assign - Map activated employee to node
router.post("/tree/nodes/:id/assign", authMiddleware, requirePermission("canManageStructure"), async (req, res) => {
  try {
    const nodeId = req.params.id;
    const { userId, employeeCode } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required for node assignment." });
    }

    const org = await getUserOrg(req.user);
    await ensureDefaultTree(org, req.user);

    const targetNode = org.treeNodes.find((n) => n.id === nodeId);
    if (!targetNode) {
      return res.status(404).json({ message: "Tree node not found." });
    }

    // Verify employee belongs to this organization and is activated
    const employee = await User.findOne({ _id: userId, organizationId: org._id });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found in your organization." });
    }

    if (employee.status !== "active") {
      return res.status(400).json({
        message: "Only activated employees can be assigned to organizational nodes.",
      });
    }

    // Prevent duplicate assignment: unassign employee from any other node in this organization
    org.treeNodes.forEach((n) => {
      if (n.employeeId && n.employeeId.toString() === userId.toString() && n.id !== nodeId) {
        n.employeeId = null;
        n.employeeCode = "";
      }
    });

    // Determine Employee Code / ID
    let finalCode = (employeeCode && employeeCode.trim()) || employee.employeeId;
    if (!finalCode) {
      const assignedCount = org.treeNodes.filter((n) => n.employeeId).length + 1;
      finalCode = `EMP-${String(assignedCount).padStart(3, "0")}`;
    }

    targetNode.employeeId = employee._id;
    targetNode.employeeCode = finalCode;

    employee.employeeId = finalCode;
    await employee.save();

    org.markModified("treeNodes");
    await org.save();

    await syncTreeReportingRelationships(org._id);

    res.json({
      message: `Employee ${employee.firstName} ${employee.lastName} (${finalCode}) mapped to node successfully.`,
      node: targetNode,
      employee,
      organization: org,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/organization/tree/nodes/:id/unassign - Unmap employee from node
router.post("/tree/nodes/:id/unassign", authMiddleware, requirePermission("canManageStructure"), async (req, res) => {
  try {
    const nodeId = req.params.id;
    const org = await getUserOrg(req.user);
    await ensureDefaultTree(org, req.user);

    const targetNode = org.treeNodes.find((n) => n.id === nodeId);
    if (!targetNode) {
      return res.status(404).json({ message: "Tree node not found." });
    }

    if (!targetNode.parentId && req.user.role === "admin" && targetNode.employeeId?.toString() === req.user.id.toString()) {
      return res.status(400).json({ message: "Cannot unassign Main Admin from the root organization node." });
    }

    targetNode.employeeId = null;
    targetNode.employeeCode = "";

    org.markModified("treeNodes");
    await org.save();

    await syncTreeReportingRelationships(org._id);

    res.json({
      message: "Employee unassigned from node successfully",
      node: targetNode,
      organization: org,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/organization/tree/move - Move node to a different parent (drag & drop)
router.post("/tree/move", authMiddleware, requirePermission("canManageStructure"), async (req, res) => {
  try {
    const { nodeId, newParentId } = req.body;
    if (!nodeId || !newParentId) {
      return res.status(400).json({ message: "Both nodeId and newParentId are required." });
    }

    const org = await getUserOrg(req.user);
    await ensureDefaultTree(org, req.user);

    const targetNode = org.treeNodes.find((n) => n.id === nodeId);
    const parentNode = org.treeNodes.find((n) => n.id === newParentId);

    if (!targetNode || !parentNode) {
      return res.status(404).json({ message: "Specified node or parent node not found." });
    }

    if (!targetNode.parentId) {
      return res.status(400).json({ message: "Cannot move the root node." });
    }

    if (wouldCreateTreeCycle(org.treeNodes, nodeId, newParentId)) {
      return res.status(400).json({ message: "Circular hierarchy detected: cannot move node under its own descendant." });
    }

    targetNode.parentId = newParentId;
    org.markModified("treeNodes");
    await org.save();

    await syncTreeReportingRelationships(org._id);

    res.json({
      message: `Node "${targetNode.title}" moved under "${parentNode.title}" successfully.`,
      organization: org,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/organization/tree/merge - Merge two nodes
router.post("/tree/merge", authMiddleware, requirePermission("canManageStructure"), async (req, res) => {
  try {
    const { sourceNodeId, targetNodeId } = req.body;
    if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) {
      return res.status(400).json({ message: "Valid sourceNodeId and different targetNodeId are required." });
    }

    const org = await getUserOrg(req.user);
    await ensureDefaultTree(org, req.user);

    const sourceNode = org.treeNodes.find((n) => n.id === sourceNodeId);
    const targetNode = org.treeNodes.find((n) => n.id === targetNodeId);

    if (!sourceNode || !targetNode) {
      return res.status(404).json({ message: "Source or target node not found." });
    }

    if (!sourceNode.parentId) {
      return res.status(400).json({ message: "Cannot merge root node away." });
    }

    // Re-parent children of source node to target node
    org.treeNodes.forEach((n) => {
      if (n.parentId === sourceNodeId) {
        n.parentId = targetNodeId;
      }
    });

    // If target has no employee but source did, transfer employee
    if (!targetNode.employeeId && sourceNode.employeeId) {
      targetNode.employeeId = sourceNode.employeeId;
      targetNode.employeeCode = sourceNode.employeeCode;
    }

    org.treeNodes = org.treeNodes.filter((n) => n.id !== sourceNodeId);
    org.markModified("treeNodes");
    await org.save();

    await syncTreeReportingRelationships(org._id);

    res.json({
      message: `Node "${sourceNode.title}" merged into "${targetNode.title}" successfully.`,
      organization: org,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/organization/tree/sync - Explicit sync recalculation
router.post("/tree/sync", authMiddleware, requirePermission("canManageStructure"), async (req, res) => {
  try {
    const org = await getUserOrg(req.user);
    await ensureDefaultTree(org, req.user);
    await syncTreeReportingRelationships(org._id);
    res.json({ message: "Organizational tree and reporting relationships synchronized." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/organization/employees/:userId/employee-id - Admin generates or updates employee ID
router.patch("/employees/:userId/employee-id", authMiddleware, requirePermission("canManageStructure"), async (req, res) => {
  try {
    const { userId } = req.params;
    const { employeeId } = req.body;

    if (!employeeId || !employeeId.trim()) {
      return res.status(400).json({ message: "Employee ID is required." });
    }

    const org = await getUserOrg(req.user);
    const user = await User.findOne({ _id: userId, organizationId: org._id });
    if (!user) {
      return res.status(404).json({ message: "Employee not found in your organization." });
    }

    user.employeeId = employeeId.trim();
    await user.save();

    // Update in treeNodes if mapped
    if (Array.isArray(org.treeNodes)) {
      let modified = false;
      org.treeNodes.forEach((n) => {
        if (n.employeeId && n.employeeId.toString() === userId.toString()) {
          n.employeeCode = user.employeeId;
          modified = true;
        }
      });
      if (modified) {
        org.markModified("treeNodes");
        await org.save();
      }
    }

    res.json({
      message: `Employee ID updated to "${user.employeeId}" for ${user.firstName} ${user.lastName}.`,
      employeeId: user.employeeId,
      user,
    });
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

    if (!org.departments.some((d) => d && d.trim().toLowerCase() === trimmed.toLowerCase())) {
      org.departments.push(trimmed);
      org.markModified("departments");
      await org.save();
    }

    res.status(201).json({ message: "Department added", departments: org.departments, organization: org });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/organization/departments/:name - Remove department
router.delete("/departments/:name", authMiddleware, requirePermission("canManageStructure"), async (req, res) => {
  try {
    let deptName = req.params.name;
    try {
      deptName = decodeURIComponent(deptName);
    } catch {
      // Keep as-is if already decoded or malformed
    }
    const org = await getUserOrg(req.user);
    const target = deptName.trim().toLowerCase();

    const updatedDepartments = (org.departments || []).filter((d) => d && d.trim().toLowerCase() !== target);
    const updatedOrg = await Organization.findByIdAndUpdate(
      org._id,
      { $set: { departments: updatedDepartments } },
      { new: true }
    );

    // Reassign any users belonging to this department to General
    await User.updateMany(
      { organizationId: org._id, department: { $regex: new RegExp(`^${deptName.trim()}$`, "i") } },
      { department: "General" }
    );

    res.json({ message: "Department removed", departments: updatedOrg.departments, organization: updatedOrg });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/organization/clear-departments - Remove all departments
router.post("/clear-departments", authMiddleware, requirePermission("canManageStructure"), async (req, res) => {
  try {
    const org = await getUserOrg(req.user);
    const updatedOrg = await Organization.findByIdAndUpdate(
      org._id,
      { $set: { departments: [] } },
      { new: true }
    );
    res.json({ message: "All departments cleared", departments: [], organization: updatedOrg });
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
    org.markModified("teams");
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

    res.status(201).json({ message: "Team created successfully", team: newTeam, teams: org.teams, organization: org });
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
    const targetId = id.toString().trim();
    const teamIndex = org.teams.findIndex((t) => t.id === targetId || t._id?.toString() === targetId);
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

    org.markModified("teams");
    await org.save();

    // Sync member teams
    if (team.memberIds.length > 0) {
      await User.updateMany(
        { _id: { $in: team.memberIds }, organizationId: org._id },
        { team: team.name, teamId: team.id }
      );
    }

    res.json({ message: "Team updated successfully", team, teams: org.teams, organization: org });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/organization/teams/:id - Remove team
router.delete("/teams/:id", authMiddleware, requirePermission("canManageStructure"), async (req, res) => {
  try {
    const { id } = req.params;
    const org = await getUserOrg(req.user);
    const targetId = id.toString().trim();

    const updatedTeams = (org.teams || []).filter((t) => t.id !== targetId && t._id?.toString() !== targetId);
    const updatedOrg = await Organization.findByIdAndUpdate(
      org._id,
      { $set: { teams: updatedTeams } },
      { new: true }
    );

    // Clear team reference from users in this team
    await User.updateMany(
      { organizationId: org._id, $or: [{ teamId: targetId }, { team: targetId }] },
      { team: "", teamId: "" }
    );

    res.json({ message: "Team removed successfully", teams: updatedOrg.teams, organization: updatedOrg });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ======================== HIERARCHY LEVELS ========================

// PUT /api/organization/levels - Configure custom hierarchy levels
router.put("/levels", authMiddleware, requirePermission("canManageStructure"), async (req, res) => {
  try {
    const { levels } = req.body;
    if (!Array.isArray(levels)) {
      return res.status(400).json({ message: "Levels must be an array" });
    }

    const org = await getUserOrg(req.user);

    const formattedLevels = levels.map((l, index) => ({
      level: Number(l.level) || index + 1,
      name: l.name || `Level ${index + 1}`,
      description: l.description || "",
    }));

    const updatedOrg = await Organization.findByIdAndUpdate(
      org._id,
      { $set: { levels: formattedLevels } },
      { new: true }
    );
    res.json({ message: "Hierarchy levels updated", levels: updatedOrg.levels, organization: updatedOrg });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/organization/clear-hierarchy - Remove all hierarchy tiers and roles to start clean
router.post("/clear-hierarchy", authMiddleware, requirePermission("canManageStructure"), async (req, res) => {
  try {
    const org = await getUserOrg(req.user);
    const updatedOrg = await Organization.findByIdAndUpdate(
      org._id,
      { $set: { levels: [], positions: [] } },
      { new: true }
    );

    res.json({
      message: "All hierarchy levels and roles cleared successfully",
      levels: [],
      positions: [],
      organization: updatedOrg,
    });
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
    org.markModified("positions");
    await org.save();

    res.status(201).json({
      message: "Custom job role / position created",
      position: newPosition,
      positions: org.positions,
      organization: org,
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
    const targetId = id.toString().trim();
    const posIndex = org.positions.findIndex((p) => p.id === targetId || p._id?.toString() === targetId);
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

    org.markModified("positions");
    await org.save();
    res.json({
      message: "Position updated",
      position: org.positions[posIndex],
      positions: org.positions,
      organization: org,
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
    const targetId = id.toString().trim();

    const updatedPositions = (org.positions || []).filter((p) => p.id !== targetId && p._id?.toString() !== targetId);
    const updatedOrg = await Organization.findByIdAndUpdate(
      org._id,
      { $set: { positions: updatedPositions } },
      { new: true }
    );

    res.json({ message: "Position deleted", positions: updatedOrg.positions, organization: updatedOrg });
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

    const exists = (org.relationshipTypes || []).some((r) => r.id === key);
    if (!exists) {
      const updatedList = [
        ...(org.relationshipTypes || []),
        {
          id: key,
          name: name.trim(),
          description: description ? description.trim() : "",
        },
      ];
      const updatedOrg = await Organization.findByIdAndUpdate(
        org._id,
        { $set: { relationshipTypes: updatedList } },
        { new: true }
      );
      return res.status(201).json({
        message: "Relationship type added",
        relationshipTypes: updatedOrg.relationshipTypes,
        organization: updatedOrg,
      });
    }

    res.status(201).json({
      message: "Relationship type exists",
      relationshipTypes: org.relationshipTypes,
      organization: org,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/organization/relationship-types/:id - Delete custom relationship type
router.delete("/relationship-types/:id", authMiddleware, requirePermission("canManageStructure"), async (req, res) => {
  try {
    const { id } = req.params;
    const org = await getUserOrg(req.user);
    const targetId = id.toString().trim().toLowerCase();

    const updatedRelationshipTypes = (org.relationshipTypes || []).filter(
      (r) =>
        (r.id && r.id.toString().trim().toLowerCase() !== targetId) &&
        (!r._id || r._id.toString() !== targetId)
    );

    const updatedOrg = await Organization.findByIdAndUpdate(
      org._id,
      { $set: { relationshipTypes: updatedRelationshipTypes } },
      { new: true }
    );

    res.json({
      message: "Relationship type deleted",
      relationshipTypes: updatedOrg.relationshipTypes,
      organization: updatedOrg,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/organization/clear-relationship-types - Remove all relationship types
router.post("/clear-relationship-types", authMiddleware, requirePermission("canManageStructure"), async (req, res) => {
  try {
    const org = await getUserOrg(req.user);
    const updatedOrg = await Organization.findByIdAndUpdate(
      org._id,
      { $set: { relationshipTypes: [] } },
      { new: true }
    );

    res.json({
      message: "All relationship types cleared",
      relationshipTypes: [],
      organization: updatedOrg,
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

    org.markModified("levels");
    org.markModified("departments");
    org.markModified("teams");
    org.markModified("positions");
    await org.save();
    res.json({ message: "Organization structure template applied", organization: org });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
