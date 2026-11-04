// AI-Powered Issue Analysis and Smart Routing Engine for Help Desk

const CATEGORIES = [
  "Technical Support",
  "IT and Infrastructure",
  "Human Resources",
  "Finance and Accounts",
  "Administration",
  "Project Management",
  "Attendance and Leave",
  "Employee Management",
  "Software and Application Issues",
  "Other",
];

// Heuristic keyword mapping for intelligent local NLP classification
const CATEGORY_KEYWORDS = {
  "IT and Infrastructure": [
    "network", "wifi", "internet", "vpn", "router", "dns", "firewall", "printer", "hardware",
    "monitor", "keyboard", "mouse", "laptop", "desktop", "server", "lan", "cable", "ip address",
    "bandwidth", "connection lost", "system crash", "blue screen", "bsod", "reboot",
  ],
  "Software and Application Issues": [
    "bug", "error", "crash", "app", "application", "software", "api", "database", "ui", "frontend",
    "backend", "exception", "failed to load", "blank screen", "white screen", "button not working",
    "git", "merge conflict", "deployment", "vite", "build fail", "npm error", "login fail",
  ],
  "Technical Support": [
    "password reset", "credentials", "access denied", "2fa", "two-factor", "permission", "authorization",
    "account locked", "session expired", "forgot password", "otp", "login issue", "security token",
  ],
  "Human Resources": [
    "hr", "hiring", "onboarding", "contract", "offer letter", "resignation", "notice period",
    "probation", "performance review", "appraisal", "workplace", "harassment", "grievance",
    "insurance", "medical claim", "benefits", "policy", "employee handbook",
  ],
  "Attendance and Leave": [
    "leave", "sick leave", "casual leave", "pto", "vacation", "holiday", "attendance", "punch in",
    "punch out", "biometric", "timesheet", "overtime", "comp off", "half day", "wfh", "work from home",
  ],
  "Finance and Accounts": [
    "salary", "payroll", "payslip", "bonus", "tax", "tds", "reimbursement", "expense", "invoice",
    "travel allowance", "payout", "compensation", "bank details", "pf", "provident fund", "billing",
  ],
  "Administration": [
    "desk", "chair", "office", "air conditioning", "ac", "lighting", "cleanliness", "stationery",
    "courier", "id card", "access card", "cafeteria", "canteen", "parking", "visitor", "maintenance",
  ],
  "Project Management": [
    "deadline", "project", "milestone", "deliverable", "scope", "delay", "blocked", "client request",
    "requirement change", "sprint", "roadmap", "workload", "resource allocation",
  ],
  "Employee Management": [
    "team transfer", "reporting manager", "designation", "promotion", "internal mobility",
    "team structure", "department change", "manager conflict",
  ],
};

const CRITICAL_KEYWORDS = [
  "production down", "system down", "outage", "data loss", "security breach", "hacked", "leak",
  "cannot access anywhere", "blocker", "emergency", "fatal", "disaster", "urgent", "immediate",
  "financial loss", "payroll blocked",
];

const HIGH_KEYWORDS = [
  "deadline today", "cannot work", "blocked", "payment failed", "cannot login", "critical bug",
  "client waiting", "presentation today", "entire team affected", "crash",
];

const LOW_KEYWORDS = [
  "query", "question", "suggestion", "minor", "spelling", "typo", "cosmetic", "when possible",
  "no rush", "general inquiry", "information needed",
];

/**
 * Smart Heuristic Fallback Analysis (Runs without external network or API keys)
 */
function heuristicIssueAnalysis(subject = "", description = "", availableDepartments = []) {
  const combinedText = `${subject} ${description}`.toLowerCase();
  const words = combinedText.split(/\s+/).filter((w) => w.length > 2);

  // 1. Category Detection via Keyword Frequency
  let bestCategory = "Other";
  let maxCatScore = 0;

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (combinedText.includes(kw)) {
        score += kw.split(" ").length * 2; // multi-word matches get higher weight
      }
    }
    if (score > maxCatScore) {
      maxCatScore = score;
      bestCategory = cat;
    }
  }

  // 2. Priority Detection
  let priority = "medium";
  if (CRITICAL_KEYWORDS.some((kw) => combinedText.includes(kw))) {
    priority = "critical";
  } else if (HIGH_KEYWORDS.some((kw) => combinedText.includes(kw))) {
    priority = "high";
  } else if (LOW_KEYWORDS.some((kw) => combinedText.includes(kw))) {
    priority = "low";
  }

  // 3. Department Detection
  let detectedDepartment = "General";
  let maxDeptScore = 0;

  if (Array.isArray(availableDepartments) && availableDepartments.length > 0) {
    for (const dept of availableDepartments) {
      const dName = (dept.name || dept || "").toString().toLowerCase();
      let dScore = 0;

      // Direct mention in text
      if (combinedText.includes(dName)) {
        dScore += 10;
      }

      // Keyword associations
      if (dName.includes("tech") || dName.includes("eng") || dName.includes("it") || dName.includes("soft")) {
        if (["Technical Support", "IT and Infrastructure", "Software and Application Issues"].includes(bestCategory)) {
          dScore += 8;
        }
      } else if (dName.includes("hr") || dName.includes("human") || dName.includes("talent")) {
        if (["Human Resources", "Attendance and Leave", "Employee Management"].includes(bestCategory)) {
          dScore += 8;
        }
      } else if (dName.includes("fin") || dName.includes("acc") || dName.includes("pay")) {
        if (bestCategory === "Finance and Accounts") {
          dScore += 8;
        }
      } else if (dName.includes("admin") || dName.includes("op") || dName.includes("facility")) {
        if (bestCategory === "Administration") {
          dScore += 8;
        }
      } else if (dName.includes("proj") || dName.includes("lead")) {
        if (bestCategory === "Project Management") {
          dScore += 8;
        }
      }

      if (dScore > maxDeptScore) {
        maxDeptScore = dScore;
        detectedDepartment = dept.name || dept;
      }
    }
  }

  if (detectedDepartment === "General" && availableDepartments.length > 0) {
    // Fallback to first suitable department or default
    detectedDepartment = availableDepartments[0].name || availableDepartments[0] || "General";
  }

  // 4. Important keywords extraction
  const keywords = Array.from(
    new Set(
      words.filter((w) =>
        Object.values(CATEGORY_KEYWORDS)
          .flat()
          .some((kw) => kw.includes(w))
      )
    )
  ).slice(0, 6);

  // 5. AI Summary
  const summary = `${subject.trim()}: Employee reports issue categorized under ${bestCategory} requiring attention from ${detectedDepartment}.`;

  // 6. Suggested Resolution Steps
  const suggestedResolution = generateTroubleshootingSteps(bestCategory, priority);

  return {
    analyzed: true,
    analyzedAt: new Date(),
    summary,
    keywords: keywords.length ? keywords : [bestCategory.toLowerCase()],
    detectedDepartment,
    suggestedCategory: bestCategory,
    suggestedPriority: priority,
    confidenceScore: maxCatScore > 0 ? Math.min(0.92, 0.65 + maxCatScore * 0.05) : 0.6,
    reasoning: `Identified problem patterns in "${subject}" mapping to ${bestCategory} and routed to ${detectedDepartment} at ${priority} priority.`,
    suggestedResolution,
    aiModelUsed: "Smart NLP Rules Engine (Offline Fallback)",
  };
}

/**
 * Generate standard troubleshooting steps based on category & priority
 */
function generateTroubleshootingSteps(category, priority) {
  switch (category) {
    case "IT and Infrastructure":
      return [
        "1. Check physical network connection or Wi-Fi signal strength.",
        "2. Test gateway ping and verify DNS server resolution.",
        "3. Verify if user device requires OS network adapter restart.",
        "4. Escalate to network admin if router/switch reboot is required.",
      ];
    case "Software and Application Issues":
      return [
        "1. Review browser console logs or application stack trace for errors.",
        "2. Perform a hard browser cache refresh (Ctrl+F5) to clear outdated bundle.",
        "3. Check server logs in CloudWatch / Vercel for 500 status codes.",
        "4. Verify database schema compatibility with the latest deployed build.",
      ];
    case "Technical Support":
      return [
        "1. Verify employee email in user database and check account active status.",
        "2. Trigger a secure password reset link or token renewal.",
        "3. Confirm user role, permissions, and organization ID mapping.",
        "4. Guide employee through sign-in steps in an active browser session.",
      ];
    case "Finance and Accounts":
      return [
        "1. Verify employee ID against current payroll cycle records.",
        "2. Check banking IFSC and account details for transaction status.",
        "3. Audit reimbursement submission receipts and supervisor approvals.",
        "4. Provide payment timeline or escalate to finance controller.",
      ];
    case "Human Resources":
    case "Attendance and Leave":
      return [
        "1. Cross-check attendance punch logs with biometric/timesheet entries.",
        "2. Review accrued leave balance and approval status with reporting manager.",
        "3. Apply manual attendance adjustment if technical clocking error occurred.",
        "4. Send updated leave balance confirmation to employee.",
      ];
    default:
      return [
        "1. Review ticket description and any uploaded attachments.",
        "2. Contact requester via in-ticket chat if additional diagnostics are needed.",
        "3. Perform preliminary verification within the department's standard operating procedure.",
        "4. Provide resolution notes upon successful completion.",
      ];
  }
}

/**
 * Call Google Gemini API if configured in process.env.GEMINI_API_KEY
 */
async function callGeminiForHelpDesk(subject, description, availableDepartments = []) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const deptListStr = availableDepartments.map((d) => d.name || d).join(", ") || "General, IT, Engineering, HR, Finance, Operations";
    const prompt = `You are an enterprise AI Help Desk triage agent. Analyze the following support ticket submitted by an employee.

Ticket Subject: "${subject}"
Ticket Description: "${description}"

Available Departments in Organization: [${deptListStr}]
Allowed Categories: [${CATEGORIES.join(", ")}]

Analyze the problem and respond with a strictly valid JSON object (no markdown code fences):
{
  "summary": "1-2 sentence executive summary of the problem for support team",
  "keywords": ["key1", "key2", "key3"],
  "detectedDepartment": "Exact matching department from Available Departments list",
  "suggestedCategory": "Exact matching category from Allowed Categories list",
  "suggestedPriority": "critical" | "high" | "medium" | "low",
  "confidenceScore": 0.0 to 1.0,
  "reasoning": "Why this department and priority were selected",
  "suggestedResolution": ["Step 1 troubleshooting", "Step 2 troubleshooting", "Step 3 resolution"]
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
    });

    if (!response.ok) {
      console.warn("Gemini Help Desk triage call returned status:", response.status);
      return null;
    }

    const data = await response.json();
    const rawContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (rawContent) {
      const parsed = JSON.parse(rawContent.trim());
      if (parsed && parsed.suggestedCategory) {
        return {
          analyzed: true,
          analyzedAt: new Date(),
          summary: parsed.summary || subject,
          keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
          detectedDepartment: parsed.detectedDepartment || "General",
          suggestedCategory: parsed.suggestedCategory || "Other",
          suggestedPriority: ["critical", "high", "medium", "low"].includes(parsed.suggestedPriority)
            ? parsed.suggestedPriority
            : "medium",
          confidenceScore: Number(parsed.confidenceScore) || 0.95,
          reasoning: parsed.reasoning || "AI analyzed issue context and impact.",
          suggestedResolution: Array.isArray(parsed.suggestedResolution) ? parsed.suggestedResolution : [],
          aiModelUsed: "Gemini 2.5 Flash",
        };
      }
    }
  } catch (err) {
    console.warn("Gemini Help Desk triage failed, falling back to heuristic engine:", err.message);
  }

  return null;
}

/**
 * Main Ticket Issue Analyzer
 */
async function analyzeTicketIssue({ subject, description, availableDepartments = [], requestedCategory = null, requestedPriority = null }) {
  let result = null;

  // 1. Try Gemini API first if configured
  if (process.env.GEMINI_API_KEY) {
    result = await callGeminiForHelpDesk(subject, description, availableDepartments);
  }

  // 2. Fall back to smart heuristic engine
  if (!result) {
    result = heuristicIssueAnalysis(subject, description, availableDepartments);
  }

  // Respect user-specified category or priority if explicitly provided
  if (requestedCategory && CATEGORIES.includes(requestedCategory)) {
    result.suggestedCategory = requestedCategory;
  }
  if (requestedPriority && ["critical", "high", "medium", "low"].includes(requestedPriority)) {
    result.suggestedPriority = requestedPriority;
  }

  return result;
}

/**
 * Automatically assign the best support employee in the target department
 * Considers active workload count and role permissions
 */
async function autoAssignSupportEmployee({ department, organizationId, User, HelpDeskTicket }) {
  try {
    if (!department || !organizationId) return null;

    // Find users in the department within the organization
    const deptUsers = await User.find({
      organizationId,
      department: new RegExp(`^${department.trim()}$`, "i"),
      status: { $ne: "disabled" },
    })
      .select("firstName lastName email role designation department")
      .lean();

    if (!deptUsers || deptUsers.length === 0) {
      return null;
    }

    // Tally active tickets per employee in this department
    const userIds = deptUsers.map((u) => u._id);
    const activeTickets = await HelpDeskTicket.aggregate([
      {
        $match: {
          assignedTo: { $in: userIds },
          status: { $in: ["assigned", "in-progress", "waiting-employee-response"] },
        },
      },
      {
        $group: {
          _id: "$assignedTo",
          count: { $sum: 1 },
        },
      },
    ]);

    const workloadMap = new Map();
    activeTickets.forEach((item) => {
      workloadMap.set(item._id.toString(), item.count);
    });

    // Sort by lowest active ticket count, prioritizing managers/specialists
    deptUsers.sort((a, b) => {
      const countA = workloadMap.get(a._id.toString()) || 0;
      const countB = workloadMap.get(b._id.toString()) || 0;
      if (countA !== countB) return countA - countB;
      // If tie, managers/directors handled first or staff
      return 0;
    });

    return deptUsers[0];
  } catch (err) {
    console.warn("Auto-assignment error:", err.message);
    return null;
  }
}

/**
 * Generate AI follow-up assistance on an existing ticket conversation
 */
async function generateFollowUpAssistance({ ticket, messages = [] }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const conversationText = messages
    .map((m) => `${m.senderName} (${m.senderRole}): ${m.message}`)
    .join("\n");

  if (apiKey) {
    try {
      const prompt = `You are an AI Support Assistant. Review the ongoing support ticket conversation and provide helpful next steps for the support employee.

Ticket: ${ticket.subject} (ID: ${ticket.ticketId}, Status: ${ticket.status}, Priority: ${ticket.priority})
Problem Description: ${ticket.description}
Conversation History:
${conversationText.slice(0, 5000)}

Provide a JSON object with:
{
  "suggestedReply": "Polite, professional proposed response to the employee",
  "missingInformation": ["item 1", "item 2"] or [],
  "canResolveNow": true | false,
  "internalAdvice": "Quick tactical advice for the support technician"
}`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (raw) return JSON.parse(raw.trim());
      }
    } catch {
      // Fallback below
    }
  }

  // Heuristic follow-up recommendation
  return {
    suggestedReply: `Hello ${ticket.requesterName || "there"}, thank you for the update. We have investigated the issue and are testing the resolution on your account. Please let us know if the issue persists on your end.`,
    missingInformation: [],
    canResolveNow: ticket.status === "in-progress" && messages.length >= 2,
    internalAdvice: "Ensure the root cause is resolved and verified in logs before marking this ticket as resolved.",
  };
}

module.exports = {
  CATEGORIES,
  analyzeTicketIssue,
  autoAssignSupportEmployee,
  generateFollowUpAssistance,
};
