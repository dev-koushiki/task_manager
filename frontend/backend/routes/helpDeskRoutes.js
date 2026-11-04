const express = require("express");
const router = express.Router();
const HelpDeskTicket = require("../models/HelpDeskTicket");
const TicketMessage = require("../models/TicketMessage");
const HelpDeskSettings = require("../models/HelpDeskSettings");
const User = require("../models/User");
const Organization = require("../models/Organization");
const Notification = require("../models/Notification");
const authMiddleware = require("../middleware/auth");
const {
  CATEGORIES,
  analyzeTicketIssue,
  autoAssignSupportEmployee,
  generateFollowUpAssistance,
} = require("../services/helpDeskAIService");

// Helper: Generate next ticket ID: HD-YYYY-XXXXX
async function generateTicketId(organizationId) {
  const currentYear = new Date().getFullYear();
  const prefix = `HD-${currentYear}-`;

  const lastTicket = await HelpDeskTicket.findOne({
    ticketId: new RegExp(`^${prefix}`),
  })
    .sort({ createdAt: -1 })
    .select("ticketId")
    .lean();

  let nextSeq = 1;
  if (lastTicket && lastTicket.ticketId) {
    const parts = lastTicket.ticketId.split("-");
    const lastNum = parseInt(parts[2], 10);
    if (!isNaN(lastNum)) {
      nextSeq = lastNum + 1;
    }
  }

  return `${prefix}${nextSeq.toString().padStart(5, "0")}`;
}

// Helper: Calculate SLA Deadlines
function calculateSLADeadlines(priority, slaConfig) {
  const defaults = {
    critical: { responseHours: 0.25, resolutionHours: 4 },
    high: { responseHours: 1, resolutionHours: 12 },
    medium: { responseHours: 4, resolutionHours: 24 },
    low: { responseHours: 8, resolutionHours: 48 },
  };

  const config = (slaConfig && slaConfig[priority]) || defaults[priority] || defaults.medium;
  const now = Date.now();

  return {
    responseDeadline: new Date(now + config.responseHours * 3600 * 1000),
    resolutionDeadline: new Date(now + config.resolutionHours * 3600 * 1000),
  };
}

// ----------------------------------------------------
// 1. POST /api/helpdesk/tickets - Raise a new ticket
// ----------------------------------------------------
router.post("/tickets", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id.toString();
    const currentUser = await User.findById(userId);
    if (!currentUser) return res.status(404).json({ message: "User not found." });

    const {
      subject,
      description,
      category,
      department,
      priority,
      relatedProjectId,
      relatedTaskId,
      attachments = [],
    } = req.body;

    if (!subject || !subject.trim()) {
      return res.status(400).json({ message: "Ticket subject is required." });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ message: "Problem description is required." });
    }

    const orgId = currentUser.organizationId;
    const ticketId = await generateTicketId(orgId);

    // Get active departments in organization
    let orgDepartments = [];
    if (orgId) {
      const orgDoc = await Organization.findById(orgId).lean();
      if (orgDoc && Array.isArray(orgDoc.departments) && orgDoc.departments.length > 0) {
        orgDepartments = orgDoc.departments;
      }
    }
    if (orgDepartments.length === 0) {
      orgDepartments = await User.distinct("department", {
        $or: [{ organizationId: orgId }, { companyName: currentUser.companyName }],
      });
    }

    // Step 1: Execute AI Issue Analysis
    const aiResult = await analyzeTicketIssue({
      subject: subject.trim(),
      description: description.trim(),
      availableDepartments: orgDepartments,
      requestedCategory: category,
      requestedPriority: priority,
    });

    const effectiveCategory = category || aiResult.suggestedCategory || "Other";
    const effectivePriority = priority || aiResult.suggestedPriority || "medium";
    let effectiveDepartment = department || aiResult.detectedDepartment || currentUser.department || "General";

    // Validate that the department exists, or fallback to first department / general
    if (orgDepartments.length > 0 && !orgDepartments.some((d) => (d.name || d).toLowerCase() === effectiveDepartment.toLowerCase())) {
      effectiveDepartment = orgDepartments[0].name || orgDepartments[0] || "General";
    }

    // Load organization settings for SLA computation
    const settings = orgId ? await HelpDeskSettings.findOne({ organizationId: orgId }).lean() : null;
    const { responseDeadline, resolutionDeadline } = calculateSLADeadlines(
      effectivePriority,
      settings?.slaHours
    );

    // Step 2: Auto-assign available support employee in department
    let assignedEmployee = null;
    if (settings?.routingRules?.length) {
      const rule = settings.routingRules.find(
        (r) => r.category?.toLowerCase() === effectiveCategory.toLowerCase()
      );
      if (rule && rule.targetDepartment) {
        effectiveDepartment = rule.targetDepartment;
      }
    }

    assignedEmployee = await autoAssignSupportEmployee({
      department: effectiveDepartment,
      organizationId: orgId,
      User,
      HelpDeskTicket,
    });

    const initialStatus = assignedEmployee ? "assigned" : "awaiting-assignment";

    const newTicket = await HelpDeskTicket.create({
      ticketId,
      organizationId: orgId,
      requester: currentUser._id,
      requesterName: `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() || currentUser.email,
      requesterEmail: currentUser.email,
      requesterDepartment: currentUser.department || "General",
      subject: subject.trim(),
      description: description.trim(),
      category: effectiveCategory,
      priority: effectivePriority,
      status: initialStatus,
      aiAnalysis: aiResult,
      assignedDepartment: effectiveDepartment,
      assignedTo: assignedEmployee ? assignedEmployee._id : null,
      assignedAt: assignedEmployee ? new Date() : null,
      assignedByName: assignedEmployee ? "AI Smart Router" : "Unassigned",
      relatedProject: relatedProjectId || null,
      relatedTask: relatedTaskId || null,
      attachments: Array.isArray(attachments) ? attachments : [],
      sla: {
        responseDeadline,
        resolutionDeadline,
      },
      timeline: [
        {
          status: "submitted",
          action: "Ticket Created",
          performedBy: currentUser._id,
          performedByName: `${currentUser.firstName} ${currentUser.lastName}`,
          note: `Ticket submitted and analyzed by AI triage engine.`,
          timestamp: new Date(),
        },
        ...(assignedEmployee
          ? [
              {
                status: "assigned",
                action: "Auto-Assigned Support Specialist",
                performedByName: "AI Smart Router",
                note: `Routed to ${effectiveDepartment} and assigned to ${assignedEmployee.firstName} ${assignedEmployee.lastName} based on active workload.`,
                timestamp: new Date(),
              },
            ]
          : []),
      ],
    });

    // Notify assigned employee if assigned
    if (assignedEmployee && orgId) {
      await Notification.create({
        recipient: assignedEmployee._id,
        organizationId: orgId,
        title: `New Support Ticket: ${ticketId}`,
        message: `A ${effectivePriority} priority ticket "${subject}" in ${effectiveDepartment} has been assigned to you.`,
        type: "ticket_assigned",
        relatedId: newTicket._id,
      }).catch(() => {});
    }

    res.status(201).json({
      success: true,
      message: `Support ticket ${ticketId} created successfully.`,
      ticket: newTicket,
    });
  } catch (err) {
    console.error("Error creating help desk ticket:", err);
    res.status(500).json({ message: err.message || "Failed to create support ticket." });
  }
});

// ----------------------------------------------------
// 2. GET /api/helpdesk/tickets - List tickets with role scoping & filters
// ----------------------------------------------------
router.get("/tickets", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id.toString();
    const currentUser = await User.findById(userId);
    if (!currentUser) return res.status(404).json({ message: "User not found." });

    const orgId = currentUser.organizationId;
    const userRole = currentUser.role || "employee";
    const userDept = currentUser.department || "";

    const {
      scope = "all", // 'my' | 'department' | 'all' | 'unassigned' | 'escalated'
      status = "all",
      priority = "all",
      category = "all",
      department = "all",
      search = "",
      timeRange = "all", // 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all'
    } = req.query;

    const filter = {};

    // Organization multi-tenant isolation
    if (orgId && currentUser.companyName) {
      filter.$or = [{ organizationId: orgId }];
    } else if (orgId) {
      filter.organizationId = orgId;
    }

    // Role-based scoping
    if (userRole === "admin") {
      // Admins can filter by scope
      if (scope === "my") {
        filter.$or = [{ requester: currentUser._id }, { assignedTo: currentUser._id }];
      } else if (scope === "department" && userDept) {
        filter.assignedDepartment = userDept;
      } else if (scope === "unassigned") {
        filter.assignedTo = null;
        filter.status = { $ne: "resolved", $ne: "closed" };
      } else if (scope === "escalated") {
        filter.status = "escalated";
      }
    } else if (userRole === "manager" || userRole === "director") {
      // Department managers: see department tickets + own tickets
      if (scope === "my") {
        filter.requester = currentUser._id;
      } else if (scope === "unassigned") {
        filter.assignedDepartment = userDept;
        filter.assignedTo = null;
      } else {
        filter.$or = [
          { requester: currentUser._id },
          { assignedTo: currentUser._id },
          { assignedDepartment: userDept },
        ];
      }
    } else {
      // Standard employee: sees tickets they raised, or tickets assigned to them if they are support staff
      if (scope === "department") {
        filter.assignedDepartment = userDept;
      } else {
        filter.$or = [{ requester: currentUser._id }, { assignedTo: currentUser._id }];
      }
    }

    // Status filter
    if (status && status !== "all") {
      if (status === "open") {
        filter.status = { $in: ["submitted", "ai-analyzing", "awaiting-assignment", "assigned", "in-progress", "waiting-employee-response", "reopened", "escalated"] };
      } else if (status === "resolved") {
        filter.status = { $in: ["resolved", "closed"] };
      } else {
        filter.status = status;
      }
    }

    // Priority filter
    if (priority && priority !== "all") {
      filter.priority = priority;
    }

    // Category filter
    if (category && category !== "all") {
      filter.category = category;
    }

    // Department filter
    if (department && department !== "all") {
      filter.assignedDepartment = department;
    }

    // Time range filter
    if (timeRange && timeRange !== "all") {
      const now = new Date();
      let fromDate = new Date();
      if (timeRange === "today") {
        fromDate.setHours(0, 0, 0, 0);
      } else if (timeRange === "week") {
        fromDate.setDate(now.getDate() - 7);
      } else if (timeRange === "month") {
        fromDate.setMonth(now.getMonth() - 1);
      } else if (timeRange === "quarter") {
        fromDate.setMonth(now.getMonth() - 3);
      } else if (timeRange === "year") {
        fromDate.setFullYear(now.getFullYear() - 1);
      }
      filter.createdAt = { $gte: fromDate };
    }

    // Search query filter (ticketId, subject, description, requesterName)
    if (search && search.trim()) {
      const s = search.trim();
      const sRegex = new RegExp(s, "i");
      const searchMatch = {
        $or: [
          { ticketId: sRegex },
          { subject: sRegex },
          { description: sRegex },
          { requesterName: sRegex },
          { requesterEmail: sRegex },
        ],
      };

      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, searchMatch];
        delete filter.$or;
      } else {
        filter.$or = searchMatch.$or;
      }
    }

    const tickets = await HelpDeskTicket.find(filter)
      .populate("requester", "firstName lastName email role designation department profilePhoto")
      .populate("assignedTo", "firstName lastName email role designation department profilePhoto")
      .populate("relatedProject", "title status")
      .populate("relatedTask", "title status priority")
      .sort({ createdAt: -1 })
      .lean();

    // Check SLA overdues dynamically
    const now = new Date();
    const enrichedTickets = tickets.map((t) => {
      let isRespOverdue = t.sla?.isResponseOverdue || false;
      let isResOverdue = t.sla?.isResolutionOverdue || false;

      if (!t.sla?.firstResponseAt && t.sla?.responseDeadline && new Date(t.sla.responseDeadline) < now) {
        if (!["resolved", "closed"].includes(t.status)) isRespOverdue = true;
      }
      if (t.sla?.resolutionDeadline && new Date(t.sla.resolutionDeadline) < now) {
        if (!["resolved", "closed"].includes(t.status)) isResOverdue = true;
      }

      return {
        ...t,
        sla: {
          ...t.sla,
          isResponseOverdue: isRespOverdue,
          isResolutionOverdue: isResOverdue,
        },
      };
    });

    res.json({
      success: true,
      tickets: enrichedTickets,
      total: enrichedTickets.length,
    });
  } catch (err) {
    console.error("Error fetching tickets:", err);
    res.status(500).json({ message: err.message || "Failed to retrieve tickets." });
  }
});

// ----------------------------------------------------
// 3. GET /api/helpdesk/tickets/:id - Single ticket details
// ----------------------------------------------------
router.get("/tickets/:id", authMiddleware, async (req, res) => {
  try {
    const ticket = await HelpDeskTicket.findById(req.params.id)
      .populate("requester", "firstName lastName email role designation department profilePhoto")
      .populate("assignedTo", "firstName lastName email role designation department profilePhoto")
      .populate("resolution.resolvedBy", "firstName lastName role designation")
      .populate("relatedProject", "title status")
      .populate("relatedTask", "title status priority");

    if (!ticket) {
      return res.status(404).json({ message: "Support ticket not found." });
    }

    res.json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ----------------------------------------------------
// 4. PATCH /api/helpdesk/tickets/:id/assign - Assign or reassign ticket
// ----------------------------------------------------
router.patch("/tickets/:id/assign", authMiddleware, async (req, res) => {
  try {
    const { department, employeeId, note } = req.body;
    const currentUserId = req.user.id.toString();
    const currentUser = await User.findById(currentUserId);

    const ticket = await HelpDeskTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found." });

    let assignedUser = null;
    if (employeeId) {
      assignedUser = await User.findById(employeeId);
    }

    const previousAssignee = ticket.assignedTo;
    const previousDept = ticket.assignedDepartment;

    if (department) ticket.assignedDepartment = department;
    if (employeeId) {
      ticket.assignedTo = employeeId;
      ticket.assignedAt = new Date();
      ticket.assignedByName = `${currentUser.firstName} ${currentUser.lastName}`.trim();
      ticket.status = "assigned";
    }

    ticket.timeline.push({
      status: ticket.status,
      action: "Ticket Reassigned",
      performedBy: currentUser._id,
      performedByName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      note: note || `Assigned to ${assignedUser ? `${assignedUser.firstName} ${assignedUser.lastName}` : "department queue"} (${ticket.assignedDepartment})`,
      timestamp: new Date(),
    });

    await ticket.save();

    // Send Notification to new assignee
    if (assignedUser) {
      await Notification.create({
        recipient: assignedUser._id,
        organizationId: ticket.organizationId,
        title: `Ticket Assigned: ${ticket.ticketId}`,
        message: `${currentUser.firstName} assigned ticket "${ticket.subject}" to you.`,
        type: "ticket_assigned",
        relatedId: ticket._id,
      }).catch(() => {});
    }

    res.json({
      success: true,
      message: "Ticket assignment updated successfully.",
      ticket,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ----------------------------------------------------
// 5. PATCH /api/helpdesk/tickets/:id/status - Update ticket status
// ----------------------------------------------------
router.patch("/tickets/:id/status", authMiddleware, async (req, res) => {
  try {
    const { status, note, resolutionSummary, reopenReason } = req.body;
    const currentUserId = req.user.id.toString();
    const currentUser = await User.findById(currentUserId);

    const ticket = await HelpDeskTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found." });

    const prevStatus = ticket.status;
    ticket.status = status;

    // Handle Resolution
    if (status === "resolved") {
      ticket.resolution = {
        resolvedAt: new Date(),
        resolvedBy: currentUser._id,
        resolvedByName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
        resolutionSummary: resolutionSummary || note || "Resolved by support team.",
      };
    }

    // Handle Reopen
    if (status === "reopened") {
      ticket.reopenHistory.push({
        reopenedAt: new Date(),
        reopenedBy: currentUser._id,
        reopenedByName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
        reason: reopenReason || note || "Issue recurred or was not fully addressed.",
      });

      // If reopened multiple times, auto-escalate
      if (ticket.reopenHistory.length >= 2) {
        ticket.status = "escalated";
        ticket.sla.isEscalated = true;
        ticket.sla.escalatedAt = new Date();
        ticket.sla.escalationReason = `Repeatedly reopened ticket (${ticket.reopenHistory.length} times).`;
      }
    }

    // Handle Escalation
    if (status === "escalated") {
      ticket.sla.isEscalated = true;
      ticket.sla.escalatedAt = new Date();
      ticket.sla.escalationReason = note || "Escalated for senior attention.";
    }

    ticket.timeline.push({
      status,
      action: `Status Changed from ${prevStatus} to ${status}`,
      performedBy: currentUser._id,
      performedByName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      note: note || resolutionSummary || reopenReason || "",
      timestamp: new Date(),
    });

    await ticket.save();

    // Notify Requester if resolved or updated
    if (status === "resolved" && ticket.requester.toString() !== currentUserId) {
      await Notification.create({
        recipient: ticket.requester,
        organizationId: ticket.organizationId,
        title: `Ticket Resolved: ${ticket.ticketId}`,
        message: `Your support ticket "${ticket.subject}" has been marked as resolved.`,
        type: "ticket_resolved",
        relatedId: ticket._id,
      }).catch(() => {});
    }

    res.json({
      success: true,
      message: `Ticket status updated to ${status}.`,
      ticket,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ----------------------------------------------------
// 6. POST /api/helpdesk/tickets/:id/messages - Add reply / internal note
// ----------------------------------------------------
router.post("/tickets/:id/messages", authMiddleware, async (req, res) => {
  try {
    const { message, isInternalNote = false, attachments = [] } = req.body;
    const currentUserId = req.user.id.toString();
    const currentUser = await User.findById(currentUserId);

    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Message content cannot be empty." });
    }

    const ticket = await HelpDeskTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found." });

    const isRequester = ticket.requester.toString() === currentUserId;

    // Disallow regular employee from creating internal notes
    const effectiveInternalNote = isRequester ? false : Boolean(isInternalNote);

    const newMessage = await TicketMessage.create({
      ticket: ticket._id,
      organizationId: ticket.organizationId,
      sender: currentUser._id,
      senderName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      senderRole: currentUser.role || "employee",
      message: message.trim(),
      attachments: Array.isArray(attachments) ? attachments : [],
      isInternalNote: effectiveInternalNote,
    });

    // If support is responding for the first time, record first response time
    if (!isRequester && !ticket.sla.firstResponseAt && !effectiveInternalNote) {
      ticket.sla.firstResponseAt = new Date();
      if (ticket.status === "assigned") {
        ticket.status = "in-progress";
      }
      await ticket.save();
    } else if (isRequester && ticket.status === "waiting-employee-response") {
      ticket.status = "in-progress";
      await ticket.save();
    }

    // Notify counterpart
    const notifyTarget = isRequester ? ticket.assignedTo : ticket.requester;
    if (notifyTarget && !effectiveInternalNote) {
      await Notification.create({
        recipient: notifyTarget,
        organizationId: ticket.organizationId,
        title: `New Reply on ${ticket.ticketId}`,
        message: `${currentUser.firstName}: ${message.slice(0, 100)}`,
        type: "ticket_reply",
        relatedId: ticket._id,
      }).catch(() => {});
    }

    res.status(201).json({
      success: true,
      message: newMessage,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ----------------------------------------------------
// 7. GET /api/helpdesk/tickets/:id/messages - List messages
// ----------------------------------------------------
router.get("/tickets/:id/messages", authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user.id.toString();
    const currentUser = await User.findById(currentUserId);
    const ticket = await HelpDeskTicket.findById(req.params.id);

    if (!ticket) return res.status(404).json({ message: "Ticket not found." });

    const isRequester = ticket.requester.toString() === currentUserId;
    const isSupportStaff =
      currentUser.role === "admin" ||
      currentUser.role === "manager" ||
      currentUser.role === "director" ||
      (ticket.assignedTo && ticket.assignedTo.toString() === currentUserId);

    const filter = { ticket: ticket._id };

    // If requester and not support staff, hide internal notes
    if (isRequester && !isSupportStaff) {
      filter.isInternalNote = false;
    }

    const messages = await TicketMessage.find(filter)
      .populate("sender", "firstName lastName email profilePhoto role designation")
      .sort({ createdAt: 1 })
      .lean();

    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ----------------------------------------------------
// 8. POST /api/helpdesk/tickets/:id/ai-assist - AI Follow-up Assistance
// ----------------------------------------------------
router.post("/tickets/:id/ai-assist", authMiddleware, async (req, res) => {
  try {
    const ticket = await HelpDeskTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found." });

    const messages = await TicketMessage.find({ ticket: ticket._id, isInternalNote: false })
      .sort({ createdAt: 1 })
      .limit(15)
      .lean();

    const followUp = await generateFollowUpAssistance({ ticket, messages });

    res.json({ success: true, followUp });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ----------------------------------------------------
// 9. GET /api/helpdesk/analytics - Complete Help Desk Analytics
// ----------------------------------------------------
router.get("/analytics", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id.toString();
    const currentUser = await User.findById(userId);
    const orgId = currentUser.organizationId;

    const { timeRange = "all" } = req.query;
    const matchQuery = {};

    if (orgId) {
      matchQuery.organizationId = orgId;
    }

    if (timeRange && timeRange !== "all") {
      const now = new Date();
      let fromDate = new Date();
      if (timeRange === "today") fromDate.setHours(0, 0, 0, 0);
      else if (timeRange === "week") fromDate.setDate(now.getDate() - 7);
      else if (timeRange === "month") fromDate.setMonth(now.getMonth() - 1);
      else if (timeRange === "quarter") fromDate.setMonth(now.getMonth() - 3);
      else if (timeRange === "year") fromDate.setFullYear(now.getFullYear() - 1);
      matchQuery.createdAt = { $gte: fromDate };
    }

    const allTickets = await HelpDeskTicket.find(matchQuery).lean();

    const totalTickets = allTickets.length;
    const openTickets = allTickets.filter((t) =>
      ["submitted", "ai-analyzing", "awaiting-assignment", "assigned", "in-progress", "waiting-employee-response", "reopened", "escalated"].includes(t.status)
    ).length;
    const resolvedTickets = allTickets.filter((t) => ["resolved", "closed"].includes(t.status)).length;
    const pendingTickets = allTickets.filter((t) => ["submitted", "awaiting-assignment"].includes(t.status)).length;
    const criticalTickets = allTickets.filter((t) => t.priority === "critical").length;
    const escalatedTickets = allTickets.filter((t) => t.status === "escalated" || t.sla?.isEscalated).length;

    // Average Response and Resolution time
    let totalRespMinutes = 0;
    let respCount = 0;
    let totalResMinutes = 0;
    let resCount = 0;
    let slaBreaches = 0;

    allTickets.forEach((t) => {
      const created = new Date(t.createdAt).getTime();
      if (t.sla?.firstResponseAt) {
        totalRespMinutes += (new Date(t.sla.firstResponseAt).getTime() - created) / 60000;
        respCount++;
      }
      if (t.resolution?.resolvedAt) {
        totalResMinutes += (new Date(t.resolution.resolvedAt).getTime() - created) / 60000;
        resCount++;
      }
      if (t.sla?.isResponseOverdue || t.sla?.isResolutionOverdue) {
        slaBreaches++;
      }
    });

    const avgResponseHours = respCount ? (totalRespMinutes / respCount / 60).toFixed(1) : 0;
    const avgResolutionHours = resCount ? (totalResMinutes / resCount / 60).toFixed(1) : 0;
    const slaCompliancePct = totalTickets ? Math.max(0, Math.round(((totalTickets - slaBreaches) / totalTickets) * 100)) : 100;
    const reopenCount = allTickets.filter((t) => t.reopenHistory && t.reopenHistory.length > 0).length;
    const reopenRatePct = totalTickets ? Math.round((reopenCount / totalTickets) * 100) : 0;

    // Department Breakdown
    const departmentMap = {};
    allTickets.forEach((t) => {
      const d = t.assignedDepartment || "General";
      departmentMap[d] = (departmentMap[d] || 0) + 1;
    });

    // Category Breakdown
    const categoryMap = {};
    allTickets.forEach((t) => {
      const c = t.category || "Other";
      categoryMap[c] = (categoryMap[c] || 0) + 1;
    });

    // Priority Breakdown
    const priorityMap = { critical: 0, high: 0, medium: 0, low: 0 };
    allTickets.forEach((t) => {
      if (priorityMap[t.priority] !== undefined) {
        priorityMap[t.priority]++;
      }
    });

    res.json({
      success: true,
      analytics: {
        totalTickets,
        openTickets,
        resolvedTickets,
        pendingTickets,
        criticalTickets,
        escalatedTickets,
        avgResponseHours: Number(avgResponseHours),
        avgResolutionHours: Number(avgResolutionHours),
        slaCompliancePct,
        reopenRatePct,
        departmentDistribution: departmentMap,
        categoryDistribution: categoryMap,
        priorityDistribution: priorityMap,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ----------------------------------------------------
// 10. GET & PUT /api/helpdesk/settings - Settings
// ----------------------------------------------------
router.get("/settings", authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user.id.toString();
    const currentUser = await User.findById(currentUserId);
    const orgId = currentUser.organizationId;

    let settings = orgId ? await HelpDeskSettings.findOne({ organizationId: orgId }).lean() : null;
    if (!settings) {
      settings = {
        categories: CATEGORIES,
        slaHours: {
          critical: { responseHours: 0.25, resolutionHours: 4 },
          high: { responseHours: 1, resolutionHours: 12 },
          medium: { responseHours: 4, resolutionHours: 24 },
          low: { responseHours: 8, resolutionHours: 48 },
        },
        routingRules: [],
        escalationSettings: {
          autoEscalateOverdue: true,
          escalateToManager: true,
          escalateToAdmin: true,
          reopenThresholdForEscalation: 2,
        },
      };
    }

    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/settings", authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user.id.toString();
    const currentUser = await User.findById(currentUserId);
    if (currentUser.role !== "admin") {
      return res.status(403).json({ message: "Only administrators can update Help Desk settings." });
    }

    const orgId = currentUser.organizationId;
    if (!orgId) return res.status(400).json({ message: "Organization not found." });

    const { slaHours, routingRules, escalationSettings, categories } = req.body;

    const updated = await HelpDeskSettings.findOneAndUpdate(
      { organizationId: orgId },
      {
        $set: {
          ...(slaHours ? { slaHours } : {}),
          ...(routingRules ? { routingRules } : {}),
          ...(escalationSettings ? { escalationSettings } : {}),
          ...(categories ? { categories } : {}),
        },
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
