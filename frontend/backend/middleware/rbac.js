const mongoose = require("mongoose");
const User = require("../models/User");
const Project = require("../models/Project");

/**
 * Detect circular reporting relationships in an organization hierarchy.
 * Traverses upwards from proposed manager(s) to verify employee is not an ancestor.
 */
async function detectCircularReporting(employeeId, proposedManagers, organizationId) {
  if (!employeeId || !proposedManagers) return { hasCycle: false };

  const empIdStr = employeeId.toString();

  // Normalize managers input: can be array of IDs or array of objects { managerId, relationshipType }
  const managerIds = (Array.isArray(proposedManagers) ? proposedManagers : [proposedManagers])
    .map((m) => {
      if (!m) return null;
      if (typeof m === "object" && m.managerId) return m.managerId.toString();
      return m.toString();
    })
    .filter(Boolean);

  for (const mgrIdStr of managerIds) {
    // 1. Direct self-reporting check
    if (mgrIdStr === empIdStr) {
      return {
        hasCycle: true,
        message: "An employee cannot report to themselves.",
      };
    }
  }

  // 2. Fetch all organization users in a single query for lightning-fast in-memory traversal
  const allOrgUsers = await User.find({ organizationId })
    .select("_id reportsTo reportingRelationships")
    .lean();

  const userMap = new Map();
  for (const u of allOrgUsers) {
    userMap.set(u._id.toString(), u);
  }

  for (const mgrIdStr of managerIds) {
    const visited = new Set();
    const queue = [mgrIdStr];

    while (queue.length > 0) {
      const currentId = queue.shift();

      if (currentId === empIdStr) {
        return {
          hasCycle: true,
          message:
            "Circular reporting relationship detected! Setting this manager would create a reporting loop where an employee directly or indirectly manages their own supervisor.",
        };
      }

      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const managerUser = userMap.get(currentId);
      if (managerUser) {
        if (
          Array.isArray(managerUser.reportingRelationships) &&
          managerUser.reportingRelationships.length > 0
        ) {
          for (const rel of managerUser.reportingRelationships) {
            if (rel.managerId && !visited.has(rel.managerId.toString())) {
              queue.push(rel.managerId.toString());
            }
          }
        } else if (managerUser.reportsTo && !visited.has(managerUser.reportsTo.toString())) {
          queue.push(managerUser.reportsTo.toString());
        }
      }
    }
  }

  return { hasCycle: false };
}

/**
 * Find all direct and indirect subordinate IDs for a user within an organization.
 * Optimized with single batch query and in-memory graph traversal.
 */
async function getEffectiveSubordinateIds(userId, organizationId) {
  if (!userId || !organizationId) return [];

  const targetId = userId.toString();

  // Single fast batch query for the organization
  const allOrgUsers = await User.find({ organizationId })
    .select("_id reportsTo reportingRelationships")
    .lean();

  if (!allOrgUsers || allOrgUsers.length === 0) return [];

  // Build manager -> subordinates mapping in memory
  const managerToSubs = new Map();
  for (const u of allOrgUsers) {
    const mgrIds = new Set();
    if (u.reportsTo) {
      mgrIds.add(u.reportsTo.toString());
    }
    if (Array.isArray(u.reportingRelationships)) {
      for (const rel of u.reportingRelationships) {
        if (rel.managerId) {
          mgrIds.add(rel.managerId.toString());
        }
      }
    }
    for (const mId of mgrIds) {
      if (!managerToSubs.has(mId)) {
        managerToSubs.set(mId, []);
      }
      managerToSubs.get(mId).push(u._id);
    }
  }

  // Fast in-memory BFS
  const visited = new Set();
  const queue = [targetId];
  const subordinateIds = [];

  while (queue.length > 0) {
    const currentId = queue.shift();
    const subs = managerToSubs.get(currentId) || [];
    for (const subId of subs) {
      const subIdStr = subId.toString();
      if (!visited.has(subIdStr)) {
        visited.add(subIdStr);
        subordinateIds.push(subId);
        queue.push(subIdStr);
      }
    }
  }

  return subordinateIds;
}

/**
 * Check if reviewer is authorized to review/approve work for a given assignee.
 * Returns true if reviewer is admin, has canApproveTasks permission, or is in the manager chain.
 */
async function canUserApproveTask(reviewer, assigneeId, organizationId) {
  if (reviewer.role === "admin") return true;

  const perms = reviewer.permissions || {};
  if (!perms.canApproveTasks && !perms.canApproveWork) {
    return false;
  }

  // If user has company scope, they can approve any task in the company
  const taskScope = reviewer.accessScopes?.taskScope || "own";
  if (taskScope === "company") return true;

  if (!assigneeId) return true; // Unassigned task

  // If assignee is the reviewer themselves
  if (assigneeId.toString() === reviewer.id.toString()) return true;

  // Check if assignee is a subordinate of the reviewer
  const subordinates = await getEffectiveSubordinateIds(reviewer.id, organizationId);
  const isSubordinate = subordinates.some((id) => id.toString() === assigneeId.toString());
  if (isSubordinate) return true;

  // If department scope, check matching department
  if (taskScope === "department") {
    const assignee = await User.findById(assigneeId).select("department");
    if (assignee && assignee.department === reviewer.department) return true;
  }

  // If team scope, check matching team
  if (taskScope === "team") {
    const assignee = await User.findById(assigneeId).select("team");
    if (assignee && assignee.team && assignee.team === reviewer.team) return true;
  }

  return false;
}

/**
 * Express middleware to enforce a granular RBAC action permission.
 */
function requirePermission(actionKey) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Authentication required." });
    }

    if (user.role === "admin") {
      return next();
    }

    const permissions = user.permissions || {};

    // Check action key and common compatibility aliases
    let hasPerm = Boolean(permissions[actionKey]);
    if (!hasPerm && actionKey === "canApproveTasks") {
      hasPerm = Boolean(permissions.canApproveWork);
    }
    if (!hasPerm && actionKey === "canViewTasks") {
      hasPerm = Boolean(permissions.canViewTeamTasks || permissions.canViewAllTasks || true);
    }
    if (!hasPerm && actionKey === "canCreateTasks") {
      hasPerm = Boolean(permissions.canAssignTasks);
    }

    if (!hasPerm) {
      return res.status(403).json({
        message: `Access denied. Your role does not have the '${actionKey}' permission.`,
      });
    }

    next();
  };
}

module.exports = {
  detectCircularReporting,
  getEffectiveSubordinateIds,
  canUserApproveTask,
  requirePermission,
};
