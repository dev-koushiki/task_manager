const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const User = require("../models/User");
const Project = require("../models/Project");
const Task = require("../models/Task");
const Group = require("../models/Group");
const Message = require("../models/Message");
const Meeting = require("../models/Meeting");
const Notification = require("../models/Notification");

// Helper to escape regex special characters to prevent ReDoS
function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

// -------------------------------------------------------------
// GET /api/search - Multi-category scoped global search
// -------------------------------------------------------------
router.get("/", authMiddleware, async (req, res) => {
  try {
    const rawQuery = (req.query.q || req.query.query || "").trim();
    const category = (req.query.category || "all").toLowerCase();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);

    if (!rawQuery) {
      return res.json({
        query: "",
        category,
        counts: {
          employees: 0,
          projects: 0,
          milestones: 0,
          tasks: 0,
          groups: 0,
          messages: 0,
          meetings: 0,
          documents: 0,
        },
        total: 0,
        results: {
          employees: [],
          projects: [],
          milestones: [],
          tasks: [],
          groups: [],
          messages: [],
          meetings: [],
          documents: [],
        },
      });
    }

    const regex = new RegExp(escapeRegex(rawQuery), "i");
    const user = req.user;
    const orgId = user.organizationId;
    const orgFilter = orgId
      ? { $or: [{ organizationId: orgId }, { companyName: user.companyName }] }
      : { companyName: user.companyName };

    const shouldSearch = (cat) => category === "all" || category === cat;

    const results = {
      employees: [],
      projects: [],
      milestones: [],
      tasks: [],
      groups: [],
      messages: [],
      meetings: [],
      documents: [],
    };

    const promises = [];

    // 1. EMPLOYEES
    if (shouldSearch("employees")) {
      promises.push(
        (async () => {
          const employees = await User.find({
            ...orgFilter,
            $or: [
              { firstName: regex },
              { lastName: regex },
              { email: regex },
              { designation: regex },
              { department: regex },
              { team: regex },
            ],
          })
            .select("firstName lastName email role designation department team profilePhoto hierarchyLevel")
            .limit(limit)
            .lean();

          results.employees = employees.map((emp) => ({
            id: emp._id,
            type: "employee",
            title: `${emp.firstName} ${emp.lastName}`.trim(),
            subtitle: `${emp.designation || emp.role} • ${emp.department || "General"}`,
            email: emp.email,
            designation: emp.designation,
            department: emp.department,
            team: emp.team,
            role: emp.role,
            profilePhoto: emp.profilePhoto,
            link: `/dashboard?tab=invites&employeeId=${emp._id}`,
          }));
        })()
      );
    }

    // 2. PROJECTS & MILESTONES & CONCEPT NOTE DOCUMENTS
    if (shouldSearch("projects") || shouldSearch("milestones") || shouldSearch("documents")) {
      promises.push(
        (async () => {
          let projectScopeQuery = { ...orgFilter };
          if (user.role !== "admin") {
            const scope = user.accessScopes?.projectScope || "project";
            if (scope === "department" && user.department) {
              projectScopeQuery.department = user.department;
            } else if (scope === "team" && user.team) {
              projectScopeQuery.team = user.team;
            } else {
              projectScopeQuery.$or = [
                { directorId: user.id },
                { createdBy: user.id },
                { "assignedEmployees.userId": user.id },
                { "milestones.assignedTo.userId": user.id },
              ];
            }
          }

          const allAuthorizedProjects = await Project.find(projectScopeQuery)
            .select("name description department targetCompletionDate deadline status priority assignedEmployees milestones conceptNote")
            .lean();

          // A. Projects
          if (shouldSearch("projects")) {
            const matchingProjects = allAuthorizedProjects.filter((p) => {
              return (
                regex.test(p.name || "") ||
                regex.test(p.description || "") ||
                regex.test(p.department || "") ||
                (p.objectives && p.objectives.some((o) => regex.test(o)))
              );
            });

            results.projects = matchingProjects.slice(0, limit).map((p) => ({
              id: p._id,
              type: "project",
              title: p.name,
              subtitle: `${p.department || "General"} • Status: ${p.status || "not-started"} • Due: ${p.targetCompletionDate || p.deadline || "TBD"}`,
              department: p.department,
              status: p.status,
              priority: p.priority,
              deadline: p.targetCompletionDate || p.deadline,
              link: `/dashboard?tab=tasks&projectId=${p._id}`,
            }));
          }

          // B. Milestones
          if (shouldSearch("milestones")) {
            const matchingMilestones = [];
            for (const p of allAuthorizedProjects) {
              if (Array.isArray(p.milestones)) {
                for (const m of p.milestones) {
                  const mId = m._id || m.id;
                  if (
                    regex.test(m.title || "") ||
                    regex.test(m.description || "") ||
                    regex.test(m.phase || "")
                  ) {
                    matchingMilestones.push({
                      id: mId,
                      type: "milestone",
                      title: m.title,
                      subtitle: `Project: ${p.name} • Status: ${m.status || "not-started"} • Due: ${m.deadline || m.dueDate || "TBD"}`,
                      projectName: p.name,
                      projectId: p._id,
                      status: m.status,
                      phase: m.phase,
                      deadline: m.deadline || m.dueDate,
                      link: `/dashboard?tab=tasks&projectId=${p._id}&milestoneId=${mId}`,
                    });
                  }
                }
              }
            }
            results.milestones = matchingMilestones.slice(0, limit);
          }

          // C. Documents from Concept Notes
          if (shouldSearch("documents")) {
            const conceptDocs = [];
            for (const p of allAuthorizedProjects) {
              if (p.conceptNote && p.conceptNote.originalFilename) {
                if (
                  regex.test(p.conceptNote.originalFilename) ||
                  regex.test(p.conceptNote.extractedTitle || "") ||
                  regex.test(p.name || "")
                ) {
                  conceptDocs.push({
                    id: `concept-${p._id}`,
                    type: "document",
                    title: p.conceptNote.originalFilename,
                    subtitle: `Concept Note for Project: ${p.name} • Uploaded by: ${p.conceptNote.uploadedByName || "Admin"}`,
                    projectId: p._id,
                    projectName: p.name,
                    source: "Concept Note",
                    link: `/dashboard?tab=tasks&projectId=${p._id}`,
                  });
                }
              }
            }
            results.documents = [...results.documents, ...conceptDocs];
          }
        })()
      );
    }

    // 3. TASKS & DELIVERABLE DOCUMENTS
    if (shouldSearch("tasks") || shouldSearch("documents")) {
      promises.push(
        (async () => {
          let taskScopeQuery = { ...orgFilter };
          if (user.role !== "admin") {
            taskScopeQuery.$or = [
              { assignedTo: user.id },
              { assignedBy: user.id },
            ];
          }

          if (shouldSearch("tasks")) {
            const tasks = await Task.find({
              ...taskScopeQuery,
              $or: [
                { title: regex },
                { description: regex },
                { category: regex },
              ],
            })
              .select("title description status priority dueDate projectId assignedByName assignedToName submissionNotes")
              .populate("projectId", "name department")
              .limit(limit)
              .lean();

            results.tasks = tasks.map((t) => ({
              id: t._id,
              type: "task",
              title: t.title,
              subtitle: `Project: ${t.projectId?.name || "Task"} • Status: ${t.status} • Priority: ${t.priority?.toUpperCase()}`,
              status: t.status,
              priority: t.priority,
              dueDate: t.dueDate,
              projectId: t.projectId?._id,
              projectName: t.projectId?.name,
              link: `/dashboard?tab=tasks&taskId=${t._id}`,
            }));
          }

          if (shouldSearch("documents")) {
            const taskDocs = await Task.find({
              ...taskScopeQuery,
              submissionNotes: regex,
            })
              .select("title submissionNotes projectId assignedToName updatedAt")
              .populate("projectId", "name")
              .limit(limit)
              .lean();

            const formattedDocs = taskDocs.map((t) => ({
              id: `deliverable-${t._id}`,
              type: "document",
              title: `Deliverable: ${t.title}`,
              subtitle: `Submitted by: ${t.assignedToName || "Employee"} • Project: ${t.projectId?.name || "Direct Task"}`,
              snippet: t.submissionNotes,
              link: `/dashboard?tab=documents`,
            }));

            results.documents = [...results.documents, ...formattedDocs].slice(0, limit);
          }
        })()
      );
    }

    // 4. GROUPS
    if (shouldSearch("groups")) {
      promises.push(
        (async () => {
          let groupScope = { ...orgFilter };
          if (user.role !== "admin") {
            groupScope.$or = [
              { "members.userId": user.id },
              { createdBy: user.id },
            ];
          }

          const groups = await Group.find({
            ...groupScope,
            isDirectChat: false,
            $or: [{ name: regex }, { description: regex }],
          })
            .select("name description members updatedAt")
            .limit(limit)
            .lean();

          results.groups = groups.map((g) => ({
            id: g._id,
            type: "group",
            title: g.name,
            subtitle: `${g.members?.length || 0} members • ${g.description || "Project Discussion Group"}`,
            memberCount: g.members?.length || 0,
            link: `/dashboard?tab=grouping&groupId=${g._id}`,
          }));
        })()
      );
    }

    // 5. MESSAGES & NOTIFICATIONS
    if (shouldSearch("messages")) {
      promises.push(
        (async () => {
          const userGroups = await Group.find({
            ...orgFilter,
            $or: [{ "members.userId": user.id }, { createdBy: user.id }],
          })
            .select("_id name")
            .lean();

          const groupIds = userGroups.map((g) => g._id);
          const groupMap = new Map(userGroups.map((g) => [String(g._id), g.name]));

          const messages = await Message.find({
            groupId: { $in: groupIds },
            text: regex,
          })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

          const notifs = await Notification.find({
            userId: user.id,
            $or: [{ title: regex }, { message: regex }],
          })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

          const formattedMessages = messages.map((m) => ({
            id: m._id,
            type: "message",
            title: `Message in "${groupMap.get(String(m.groupId)) || "Chat"}"`,
            subtitle: `${m.senderName}: "${m.text.length > 70 ? m.text.slice(0, 70) + "..." : m.text}"`,
            senderName: m.senderName,
            text: m.text,
            createdAt: m.createdAt,
            link: `/dashboard?tab=grouping&groupId=${m.groupId}`,
          }));

          const formattedNotifs = notifs.map((n) => ({
            id: n._id,
            type: "message",
            title: n.title,
            subtitle: n.message.length > 70 ? n.message.slice(0, 70) + "..." : n.message,
            createdAt: n.createdAt,
            link: n.link || `/dashboard?tab=messages`,
          }));

          results.messages = [...formattedMessages, ...formattedNotifs].slice(0, limit);
        })()
      );
    }

    // 6. MEETINGS
    if (shouldSearch("meetings")) {
      promises.push(
        (async () => {
          let meetingScope = { ...orgFilter };
          if (user.role !== "admin") {
            meetingScope.$or = [
              { organizer: user.id },
              { hostId: user.id },
              { "participants.userId": user.id },
              { "participants.email": user.email },
            ];
          }

          const meetings = await Meeting.find({
            ...meetingScope,
            $or: [
              { title: regex },
              { agenda: regex },
              { description: regex },
              { roomCode: regex },
            ],
          })
            .select("title agenda description roomCode date scheduledDate startTime endTime status organizerName hostName")
            .limit(limit)
            .lean();

          results.meetings = meetings.map((mtg) => ({
            id: mtg._id,
            type: "meeting",
            title: mtg.title,
            subtitle: `${mtg.date || mtg.scheduledDate || "Scheduled"} (${mtg.startTime || "TBD"} - ${mtg.endTime || "TBD"}) • Host: ${mtg.organizerName || mtg.hostName || "Host"} • Code: ${mtg.roomCode || "N/A"}`,
            roomCode: mtg.roomCode,
            status: mtg.status,
            link: `/dashboard?tab=calendar&meetingId=${mtg._id}`,
          }));
        })()
      );
    }

    await Promise.all(promises);

    const counts = {
      employees: results.employees.length,
      projects: results.projects.length,
      milestones: results.milestones.length,
      tasks: results.tasks.length,
      groups: results.groups.length,
      messages: results.messages.length,
      meetings: results.meetings.length,
      documents: results.documents.length,
    };

    const total = Object.values(counts).reduce((sum, c) => sum + c, 0);

    res.json({
      query: rawQuery,
      category,
      counts,
      total,
      results,
    });
  } catch (err) {
    console.error("Global search error:", err);
    res.status(500).json({ message: err.message || "Failed to execute global search." });
  }
});

module.exports = router;
