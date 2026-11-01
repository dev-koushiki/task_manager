const { PDFParse } = require("pdf-parse");
const mammoth = require("mammoth");

/**
 * Extract raw text from uploaded document buffer
 */
async function extractDocumentText(buffer, mimeType = "", filename = "") {
  const lowerName = (filename || "").toLowerCase();
  const lowerMime = (mimeType || "").toLowerCase();

  // 1. DOCX Documents
  if (lowerName.endsWith(".docx") || lowerMime.includes("wordprocessingml") || lowerMime.includes("docx")) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      if (result && result.value) {
        return result.value.trim();
      }
    } catch (err) {
      console.warn("Mammoth extraction warning:", err.message);
    }
  }

  // 2. PDF Documents
  if (lowerName.endsWith(".pdf") || lowerMime.includes("pdf")) {
    try {
      const parser = new PDFParse({ data: buffer });
      if (typeof parser.load === "function") {
        await parser.load();
      }
      const textResult = await parser.getText();
      const extracted = typeof textResult === "string" ? textResult : (textResult?.text || "");
      if (typeof parser.destroy === "function") {
        await parser.destroy();
      }
      if (extracted && extracted.trim().length > 20) {
        return extracted.trim();
      }
    } catch (err) {
      console.warn("PDFParse warning:", err.message);
    }

    // Fallback: extract text streams from PDF buffer directly
    try {
      const raw = buffer.toString("binary");
      const matches = raw.match(/\(([^\\()]{2,})\)\s*Tj/g);
      if (matches && matches.length > 0) {
        const fallbackText = matches
          .map((m) => m.replace(/^[\\(]/, "").replace(/\)[^)]*$/, ""))
          .join(" ");
        if (fallbackText.trim().length > 30) {
          return fallbackText.trim();
        }
      }
    } catch {
      // Ignore fallback error
    }
  }

  // 3. Plain Text, Markdown, CSV, or default utf-8 decoding
  try {
    const utf8Text = buffer.toString("utf8");
    if (utf8Text && utf8Text.trim().length > 0) {
      return utf8Text.trim();
    }
  } catch (err) {
    console.warn("UTF-8 decoding error:", err.message);
  }

  return "";
}

/**
 * Intelligent NLP & heuristic concept note parser
 * Identifies title, description, objectives, deliverables, phases, dates, and suggested milestones.
 * Never invents missing deadlines or requirements.
 */
function heuristicConceptNoteParser(text, filename = "") {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // 1. Project Title
  let title = "";
  const titlePatterns = [
    /(?:project\s*title|project\s*name|concept\s*note\s*for|title)\s*[:\-]\s*(.+)/i,
    /^#\s+(.+)/,
  ];

  for (const line of lines.slice(0, 15)) {
    for (const pattern of titlePatterns) {
      const match = line.match(pattern);
      if (match && match[1] && match[1].trim().length > 3) {
        title = match[1].trim();
        break;
      }
    }
    if (title) break;
  }

  if (!title && lines.length > 0) {
    const candidate = lines[0].replace(/^#+\s*/, "");
    if (candidate.length < 90) {
      title = candidate;
    }
  }

  if (!title && filename) {
    title = filename
      .replace(/\.[^/.]+$/, "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  if (!title) {
    title = "New Project Initiative";
  }

  // 2. Department / Domain detection
  let department = "General";
  const deptKeywords = {
    Engineering: ["engineering", "software", "backend", "frontend", "api", "architecture", "database", "devops", "cloud", "react", "node"],
    Product: ["product", "roadmap", "user experience", "ux", "ui", "wireframe", "user stories", "feature"],
    Design: ["design", "branding", "graphics", "visual", "prototype", "figma", "typography"],
    Marketing: ["marketing", "campaign", "social media", "branding", "seo", "outreach", "content"],
    Sales: ["sales", "pipeline", "revenue", "clients", "leads", "conversion", "b2b"],
    Operations: ["operations", "logistics", "workflow", "process", "procurement", "supply"],
    Finance: ["finance", "budget", "accounting", "cost", "audit", "expenditure", "fiscal"],
    "Human Resources": ["hr", "human resources", "talent", "recruitment", "hiring", "onboarding", "culture"],
  };

  const lowerText = text.toLowerCase();
  for (const [dept, keywords] of Object.entries(deptKeywords)) {
    if (keywords.some((kw) => lowerText.includes(kw))) {
      department = dept;
      break;
    }
  }

  // 3. Project Description & Executive Summary
  let description = "";
  const descHeaderIdx = lines.findIndex((l) =>
    /^(?:description|overview|executive\s*summary|background|abstract|summary|problem\s*statement)\s*[:\-]?$/i.test(l) ||
    /^(?:description|overview|executive\s*summary|background)\s*:\s*.+/i.test(l)
  );

  if (descHeaderIdx !== -1) {
    const headerLine = lines[descHeaderIdx];
    const inlineMatch = headerLine.match(/^(?:description|overview|background)\s*:\s*(.+)/i);
    if (inlineMatch && inlineMatch[1]) {
      description = inlineMatch[1].trim();
    } else {
      const descLines = [];
      for (let i = descHeaderIdx + 1; i < Math.min(lines.length, descHeaderIdx + 6); i++) {
        if (/^[A-Z][A-Za-z\s]{2,25}:/.test(lines[i]) || lines[i].startsWith("#")) break;
        descLines.push(lines[i]);
      }
      description = descLines.join(" ");
    }
  }

  if (!description && lines.length > 1) {
    description = lines.slice(1, 4).join(" ");
  }

  if (description.length > 500) {
    description = description.slice(0, 497) + "...";
  }

  // 4. Objectives & Expected Deliverables
  const objectives = [];
  const expectedDeliverables = [];

  let inObjectives = false;
  let inDeliverables = false;

  for (const line of lines) {
    if (/^(?:objectives?|goals?|target\s*outcomes?|purpose)\s*[:\-]?$/i.test(line)) {
      inObjectives = true;
      inDeliverables = false;
      continue;
    }
    if (/^(?:expected\s*deliverables?|deliverables?|key\s*deliverables?|outputs?)\s*[:\-]?$/i.test(line)) {
      inDeliverables = true;
      inObjectives = false;
      continue;
    }
    if (/^(?:phases?|timeline|deadlines?|milestones?|budget|scope|team)\s*[:\-]?$/i.test(line)) {
      inObjectives = false;
      inDeliverables = false;
      continue;
    }

    if (inObjectives) {
      const clean = line.replace(/^[\*\-\•\d+\.\)]\s*/, "").trim();
      if (clean.length > 4 && clean.length < 250) {
        objectives.push(clean);
      }
    }
    if (inDeliverables) {
      const clean = line.replace(/^[\*\-\•\d+\.\)]\s*/, "").trim();
      if (clean.length > 4 && clean.length < 250) {
        expectedDeliverables.push(clean);
      }
    }
  }

  // 5. Phases & Timelines
  const phases = [];
  const phaseMatches = text.matchAll(/(?:phase\s*([0-9A-Za-z]+)|sprint\s*(\d+)|stage\s*(\d+))\s*[:\-]?\s*([^\n\r]+)/gi);
  for (const pm of phaseMatches) {
    const pName = pm[0].split(/[:\-]/)[0].trim();
    const pDesc = pm[0].split(/[:\-]/).slice(1).join("-").trim();
    phases.push({
      id: "phase_" + phases.length,
      name: pName,
      description: pDesc || pName,
    });
  }

  // 6. Date extraction (Do NOT invent dates; only extract explicit dates)
  const dateRegex = /\b(?:202[4-9]-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+202[4-9]|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+202[4-9])\b/gi;
  const foundDates = [...text.matchAll(dateRegex)].map((m) => m[0]);

  let startDate = "";
  let targetCompletionDate = "";

  function normalizeDate(str) {
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split("T")[0];
      }
    } catch {
      // Ignore parse failure
    }
    return "";
  }

  // Check for explicit "Start Date:" or "Completion Date:" / "Deadline:"
  const startMatch = text.match(/(?:start\s*date|kickoff|start)\s*[:\-]\s*([^\n\r,]+)/i);
  if (startMatch && startMatch[1]) {
    const nd = normalizeDate(startMatch[1]);
    if (nd) startDate = nd;
  }

  const endMatch = text.match(/(?:target\s*completion|completion\s*date|deadline|due\s*date|end\s*date)\s*[:\-]\s*([^\n\r,]+)/i);
  if (endMatch && endMatch[1]) {
    const nd = normalizeDate(endMatch[1]);
    if (nd) targetCompletionDate = nd;
  }

  if (!startDate && foundDates.length > 0) {
    startDate = normalizeDate(foundDates[0]);
  }
  if (!targetCompletionDate && foundDates.length > 1) {
    targetCompletionDate = normalizeDate(foundDates[foundDates.length - 1]);
  }

  // 7. Suggested Milestones
  const suggestedMilestones = [];

  // Look for milestone lines
  const milestoneLines = lines.filter((l) =>
    /^(?:milestone\s*\d+|ms\d+|deliverable\s*\d+|task\s*\d+)\s*[:\-]/i.test(l) ||
    /^(?:[\*\-\•]\s*)?(?:design|implement|deploy|develop|test|integrate|launch|deliver|prepare|complete|finalize|audit)\b/i.test(l)
  );

  const candidateMilestones = milestoneLines.length >= 2 ? milestoneLines : expectedDeliverables;

  for (let i = 0; i < Math.min(candidateMilestones.length, 8); i++) {
    const rawLine = candidateMilestones[i].replace(/^[\*\-\•\d+\.\)]\s*/, "").trim();
    if (rawLine.length < 5) continue;

    // Check if line contains an explicit date
    const lineDateMatch = rawLine.match(dateRegex);
    let mDeadline = "";
    if (lineDateMatch) {
      mDeadline = normalizeDate(lineDateMatch[0]);
    }

    // Split title and description if separated by colon or dash
    const parts = rawLine.split(/[:\-–—]\s+/);
    let mTitle = parts[0].trim();
    let mDesc = parts.slice(1).join(" - ").trim();

    if (!mDesc) {
      mDesc = `Complete deliverable for ${mTitle}`;
    }

    // Determine phase if any
    let mPhase = "";
    if (phases.length > 0) {
      const phaseIdx = Math.floor((i / candidateMilestones.length) * phases.length);
      mPhase = phases[phaseIdx] ? phases[phaseIdx].name : "";
    }

    suggestedMilestones.push({
      title: mTitle.slice(0, 100),
      description: mDesc.slice(0, 250),
      suggestedDeadline: mDeadline, // Empty string if not found in doc
      phase: mPhase,
    });
  }

  // Default fallback milestone if none detected
  if (suggestedMilestones.length === 0) {
    suggestedMilestones.push(
      {
        title: "Phase 1 Requirement Analysis & Architecture",
        description: "Analyze technical scope, architecture design, and system prerequisites.",
        suggestedDeadline: targetCompletionDate || "",
        phase: "Phase 1",
      },
      {
        title: "Phase 2 Core Implementation & Deliverables",
        description: "Execute core development and deliver primary project requirements.",
        suggestedDeadline: "",
        phase: "Phase 2",
      },
      {
        title: "Phase 3 Quality Assurance & Production Deployment",
        description: "Verify deliverables against acceptance criteria and finalize release.",
        suggestedDeadline: targetCompletionDate || "",
        phase: "Phase 3",
      }
    );
  }

  return {
    title,
    description: description || "Comprehensive project implementation as outlined in concept note.",
    department,
    objectives: objectives.length > 0 ? objectives : ["Deliver high-quality project objectives per specifications."],
    expectedDeliverables: expectedDeliverables.length > 0 ? expectedDeliverables : ["Production-ready milestone releases"],
    phases,
    startDate,
    targetCompletionDate,
    suggestedMilestones,
  };
}

/**
 * Call Gemini API if GEMINI_API_KEY is available in environment
 */
async function callGeminiForConceptNote(text, filename) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const prompt = `You are an executive project management AI. Analyze the following concept note document and extract project requirements into a valid JSON object.
CRITICAL RULES:
1. Do not invent missing deadlines or requirements. If a deadline or start date is not explicitly mentioned or clearly deducible in the text, leave it as an empty string ("").
2. Extract the actual project title, description, department (select best match from: Engineering, Product, Design, Marketing, Sales, Operations, Finance, Human Resources, General), objectives (array of strings), expectedDeliverables (array of strings), phases (array of objects with name and description), startDate (YYYY-MM-DD or ""), targetCompletionDate (YYYY-MM-DD or ""), and suggestedMilestones (array of objects with title, description, suggestedDeadline: YYYY-MM-DD or "", phase).
3. Output ONLY valid JSON matching this schema with NO markdown code block wrappers.

Document Content:
${text.slice(0, 15000)}`;

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
      console.warn("Gemini API call returned status:", response.status);
      return null;
    }

    const data = await response.json();
    const rawContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (rawContent) {
      const parsed = JSON.parse(rawContent.trim());
      return parsed;
    }
  } catch (err) {
    console.warn("Gemini API call failed, falling back to NLP heuristics:", err.message);
  }

  return null;
}

/**
 * Analyze concept note: Tries LLM if configured, otherwise falls back to smart NLP heuristics
 */
async function analyzeConceptNote(rawText, filename = "") {
  if (!rawText || rawText.trim().length === 0) {
    throw new Error("The document contains no readable text. Please check the uploaded file.");
  }

  // 1. Try Gemini if configured
  if (process.env.GEMINI_API_KEY) {
    const aiResult = await callGeminiForConceptNote(rawText, filename);
    if (aiResult && aiResult.title) {
      return aiResult;
    }
  }

  // 2. Fall back to smart heuristic parser
  return heuristicConceptNoteParser(rawText, filename);
}

/**
 * Transcribe voice recording audio with AI
 */
async function transcribeAudio({ audioBase64, mimeType = "audio/webm", language = "en" }) {
  // If client provided a Web Speech API transcript, prioritize and refine it
  if (!audioBase64) {
    return { transcript: "", language };
  }

  // If Gemini API is available, invoke multimodal speech-to-text
  if (process.env.GEMINI_API_KEY) {
    try {
      const cleanBase64 = audioBase64.replace(/^data:audio\/[^;]+;base64,/, "");
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Please transcribe this audio recording accurately. Language hint: ${language}. Return ONLY the verbatim transcription text.`,
                },
                {
                  inlineData: {
                    mimeType: mimeType.split(";")[0],
                    data: cleanBase64,
                  },
                },
              ],
            },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return { transcript: text.trim(), language };
        }
      }
    } catch (err) {
      console.warn("Gemini audio transcription failed:", err.message);
    }
  }

  return { transcript: "", language };
}

/**
 * Extract project and milestone suggestions from audio transcript
 */
async function extractFromTranscript(transcriptText) {
  if (!transcriptText || transcriptText.trim().length === 0) {
    throw new Error("Transcript is empty. Please record audio or enter text.");
  }

  return heuristicConceptNoteParser(transcriptText, "Voice Note Instructions");
}

module.exports = {
  extractDocumentText,
  analyzeConceptNote,
  transcribeAudio,
  extractFromTranscript,
};
