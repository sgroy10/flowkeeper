/**
 * SpecLock MCP HTTP Server — for Railway / remote deployment
 * Wraps the same 22 tools as the stdio server using Streamable HTTP transport.
 * Developed by Sandeep Roy (https://github.com/sgroy10)
 */

import os from "os";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { z } from "zod";
import {
  ensureInit,
  setGoal,
  addLock,
  removeLock,
  addDecision,
  addNote,
  updateDeployFacts,
  logChange,
  checkConflict,
  getSessionBriefing,
  endSession,
  suggestLocks,
  detectDrift,
  listTemplates,
  applyTemplate,
  generateReport,
  auditStagedFiles,
} from "../core/engine.js";
import { generateContext, generateContextPack } from "../core/context.js";
import {
  readBrain,
  readEvents,
  newId,
  nowIso,
  appendEvent,
  bumpEvents,
  writeBrain,
} from "../core/storage.js";
import {
  captureStatus,
  createTag,
  getDiffSummary,
} from "../core/git.js";

const PROJECT_ROOT = process.env.SPECLOCK_PROJECT_ROOT || process.cwd();
const VERSION = "1.7.0";
const AUTHOR = "Sandeep Roy";

function createSpecLockServer() {
  const server = new McpServer(
    { name: "speclock", version: VERSION },
    {
      instructions: [
        `CRITICAL: You have SpecLock connected — an AI Continuity Engine that remembers project context across sessions. You MUST follow these rules:`,
        ``,
        `## STEP 1 — FIRST THING IN EVERY CONVERSATION (MANDATORY):`,
        `Before doing ANYTHING else, call speclock_session_briefing. This loads the project's goal, constraints, decisions, and history from previous sessions.`,
        `- If it returns "not initialized", call speclock_init first, then tell the user: "I've set up project memory for this workspace. I'll remember your decisions and constraints across sessions."`,
        `- If it returns context, start your response with a brief one-line status like: "🔒 Project memory loaded — [X] constraints, [Y] decisions tracked from previous sessions." Then proceed to answer the user's actual question.`,
        `- If there is no meaningful context yet (new project), say: "🔒 Project memory active. I'll automatically remember your key decisions and constraints across sessions." Then proceed normally.`,
        ``,
        `## STEP 2 — LISTEN AND CAPTURE (do this continuously as you work):`,
        `- When the user describes what they're building → call speclock_set_goal.`,
        `- When the user says something is non-negotiable or uses words like "always", "never", "must", "don't ever change", "make sure to keep", "this is critical" → call speclock_add_lock. Then briefly confirm: "🔒 Locked: [constraint]"`,
        `- When the user makes a technology or design choice → call speclock_add_decision.`,
        `- When you complete significant work → call speclock_log_change.`,
        ``,
        `## STEP 3 — PROTECT (before making significant changes):`,
        `- Before removing features, changing architecture, switching technologies, or modifying core logic → call speclock_check_conflict.`,
        `- If a conflict is found (confidence HIGH), STOP and warn: "⚠️ This would conflict with a constraint you set: [constraint]. Should I proceed anyway or keep the current approach?"`,
        `- Do NOT proceed unless the user explicitly confirms.`,
        ``,
        `## STEP 4 — REMEMBER (when the user wants to change their mind):`,
        `- If they want to remove or change something they previously locked, remind them: "You previously locked: [constraint]. Want me to unlock this and proceed?"`,
        `- If confirmed, call speclock_remove_lock, then proceed.`,
        ``,
        `## STEP 5 — CLOSE (when conversation ends):`,
        `- Call speclock_session_summary with a brief description of what was done.`,
        ``,
        `## KEY BEHAVIOR:`,
        `- The 🔒 emoji is your SpecLock indicator. Users learn to recognize it means their project memory is active.`,
        `- Keep SpecLock confirmations SHORT — one line max. Don't dump data.`,
        `- Present remembered context NATURALLY. Instead of "SpecLock says your goal is X", just say "Based on our previous work, the goal is X."`,
        `- If the user asks "how do you remember this?" — explain that SpecLock is connected as a project memory layer that persists across sessions.`,
      ].join("\n"),
    }
  );

  // Tool 1: speclock_init
  server.tool("speclock_init", "Initialize SpecLock in the current project directory.", {}, async () => {
    const brain = ensureInit(PROJECT_ROOT);
    return { content: [{ type: "text", text: `SpecLock initialized for "${brain.project.name}" at ${brain.project.root}` }] };
  });

  // Tool 2: speclock_get_context
  server.tool("speclock_get_context", "THE KEY TOOL. Returns the full structured context pack.", { format: z.enum(["markdown", "json"]).default("markdown").describe("Output format") }, async ({ format }) => {
    ensureInit(PROJECT_ROOT);
    const text = format === "json" ? JSON.stringify(generateContextPack(PROJECT_ROOT), null, 2) : generateContext(PROJECT_ROOT);
    return { content: [{ type: "text", text }] };
  });

  // Tool 3: speclock_set_goal
  server.tool("speclock_set_goal", "Set or update the project goal.", { text: z.string().min(1).describe("The project goal text") }, async ({ text }) => {
    ensureInit(PROJECT_ROOT);
    setGoal(PROJECT_ROOT, text);
    return { content: [{ type: "text", text: `Goal updated: ${text}` }] };
  });

  // Tool 4: speclock_add_lock
  server.tool("speclock_add_lock", "Add a non-negotiable constraint (SpecLock).", { text: z.string().min(1).describe("The constraint text"), tags: z.array(z.string()).default([]).describe("Category tags"), source: z.enum(["user", "agent"]).default("agent").describe("Who created this lock") }, async ({ text, tags, source }) => {
    ensureInit(PROJECT_ROOT);
    const lock = addLock(PROJECT_ROOT, text, tags, source);
    return { content: [{ type: "text", text: `Lock added [${lock.id}]: ${text}` }] };
  });

  // Tool 5: speclock_remove_lock
  server.tool("speclock_remove_lock", "Remove (deactivate) a SpecLock by its ID.", { lockId: z.string().min(1).describe("The lock ID to remove") }, async ({ lockId }) => {
    ensureInit(PROJECT_ROOT);
    removeLock(PROJECT_ROOT, lockId);
    return { content: [{ type: "text", text: `Lock ${lockId} removed.` }] };
  });

  // Tool 6: speclock_add_decision
  server.tool("speclock_add_decision", "Record an architectural or design decision.", { text: z.string().min(1).describe("The decision text"), tags: z.array(z.string()).default([]), source: z.enum(["user", "agent"]).default("agent") }, async ({ text, tags, source }) => {
    ensureInit(PROJECT_ROOT);
    const d = addDecision(PROJECT_ROOT, text, tags, source);
    return { content: [{ type: "text", text: `Decision recorded [${d.id}]: ${text}` }] };
  });

  // Tool 7: speclock_add_note
  server.tool("speclock_add_note", "Add a pinned note for reference.", { text: z.string().min(1).describe("The note text"), pinned: z.boolean().default(true).describe("Whether to pin this note") }, async ({ text, pinned }) => {
    ensureInit(PROJECT_ROOT);
    const brain = readBrain(PROJECT_ROOT);
    const note = { id: newId(), text, pinned, createdAt: nowIso() };
    brain.state.notes.push(note);
    writeBrain(PROJECT_ROOT, brain);
    appendEvent(PROJECT_ROOT, { type: "note_added", noteId: note.id, text });
    bumpEvents(PROJECT_ROOT);
    return { content: [{ type: "text", text: `Note added [${note.id}]: ${text}` }] };
  });

  // Tool 8: speclock_set_deploy_facts
  server.tool("speclock_set_deploy_facts", "Record deployment configuration facts.", { provider: z.string().optional(), branch: z.string().optional(), autoDeploy: z.boolean().optional(), url: z.string().optional(), notes: z.string().optional() }, async (params) => {
    ensureInit(PROJECT_ROOT);
    updateDeployFacts(PROJECT_ROOT, params);
    return { content: [{ type: "text", text: `Deploy facts updated: ${JSON.stringify(params)}` }] };
  });

  // Tool 9: speclock_log_change
  server.tool("speclock_log_change", "Manually log a significant change.", { summary: z.string().min(1).describe("Brief description of the change"), files: z.array(z.string()).default([]).describe("Files affected") }, async ({ summary, files }) => {
    ensureInit(PROJECT_ROOT);
    logChange(PROJECT_ROOT, summary, files);
    return { content: [{ type: "text", text: `Change logged: ${summary}` }] };
  });

  // Tool 10: speclock_get_changes
  server.tool("speclock_get_changes", "Get recent file changes tracked by SpecLock.", { limit: z.number().int().min(1).max(100).default(20) }, async ({ limit }) => {
    ensureInit(PROJECT_ROOT);
    const events = readEvents(PROJECT_ROOT);
    const changes = events.filter((e) => ["file_created", "file_changed", "file_deleted", "manual_change"].includes(e.type)).slice(-limit);
    return { content: [{ type: "text", text: changes.length ? JSON.stringify(changes, null, 2) : "No recent changes." }] };
  });

  // Tool 11: speclock_get_events
  server.tool("speclock_get_events", "Get the event log, optionally filtered by type.", { type: z.string().optional(), limit: z.number().int().min(1).max(200).default(50), since: z.string().optional() }, async ({ type, limit, since }) => {
    ensureInit(PROJECT_ROOT);
    let events = readEvents(PROJECT_ROOT);
    if (type) events = events.filter((e) => e.type === type);
    if (since) events = events.filter((e) => e.ts > since);
    events = events.slice(-limit);
    return { content: [{ type: "text", text: events.length ? JSON.stringify(events, null, 2) : "No matching events." }] };
  });

  // Tool 12: speclock_check_conflict
  server.tool("speclock_check_conflict", "Check if a proposed action conflicts with any active SpecLock.", { proposedAction: z.string().min(1).describe("Description of the action") }, async ({ proposedAction }) => {
    ensureInit(PROJECT_ROOT);
    const result = checkConflict(PROJECT_ROOT, proposedAction);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  // Tool 13: speclock_session_briefing
  server.tool("speclock_session_briefing", "Start a new session and get a full briefing.", { toolName: z.enum(["claude-code", "cursor", "codex", "windsurf", "cline", "unknown"]).default("unknown") }, async ({ toolName }) => {
    ensureInit(PROJECT_ROOT);
    const briefing = getSessionBriefing(PROJECT_ROOT, toolName);
    return { content: [{ type: "text", text: briefing }] };
  });

  // Tool 14: speclock_session_summary
  server.tool("speclock_session_summary", "End the current session and record what was accomplished.", { summary: z.string().min(1) }, async ({ summary }) => {
    ensureInit(PROJECT_ROOT);
    endSession(PROJECT_ROOT, summary);
    return { content: [{ type: "text", text: `Session ended. Summary recorded: ${summary}` }] };
  });

  // Tool 15: speclock_checkpoint
  server.tool("speclock_checkpoint", "Create a named git tag checkpoint for easy rollback.", { name: z.string().min(1) }, async ({ name }) => {
    ensureInit(PROJECT_ROOT);
    const tag = `speclock-${name}`;
    try {
      createTag(PROJECT_ROOT, tag);
      appendEvent(PROJECT_ROOT, { type: "checkpoint_created", tag });
      return { content: [{ type: "text", text: `Checkpoint created: ${tag}` }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Checkpoint failed: ${err.message}` }] };
    }
  });

  // Tool 16: speclock_repo_status
  server.tool("speclock_repo_status", "Get current git repository status.", {}, async () => {
    ensureInit(PROJECT_ROOT);
    try {
      const status = captureStatus(PROJECT_ROOT);
      const diff = getDiffSummary(PROJECT_ROOT);
      return { content: [{ type: "text", text: JSON.stringify({ ...status, diffSummary: diff }, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Git status failed: ${err.message}` }] };
    }
  });

  // Tool 17: speclock_suggest_locks
  server.tool("speclock_suggest_locks", "AI-powered lock suggestions based on project patterns.", {}, async () => {
    ensureInit(PROJECT_ROOT);
    const suggestions = suggestLocks(PROJECT_ROOT);
    if (!suggestions.length) return { content: [{ type: "text", text: "No lock suggestions at this time." }] };
    const text = suggestions.map((s, i) => `${i + 1}. **${s.text}**\n   Source: ${s.source}\n   Reason: ${s.reason}`).join("\n\n");
    return { content: [{ type: "text", text: `## Lock Suggestions\n\n${text}\n\n---\n*SpecLock v${VERSION} — Developed by ${AUTHOR}*` }] };
  });

  // Tool 18: speclock_detect_drift
  server.tool("speclock_detect_drift", "Scan recent changes for constraint violations.", {}, async () => {
    ensureInit(PROJECT_ROOT);
    const drift = detectDrift(PROJECT_ROOT);
    if (!drift.length) return { content: [{ type: "text", text: "No drift detected. All changes align with active locks." }] };
    const text = drift.map((d, i) => `${i + 1}. **${d.type}**: ${d.summary}\n   Lock: ${d.lockText}\n   Confidence: ${d.confidence}`).join("\n\n");
    return { content: [{ type: "text", text: `## Drift Detected\n\n${text}` }] };
  });

  // Tool 19: speclock_health
  server.tool("speclock_health", "Health check with completeness score and multi-agent timeline.", {}, async () => {
    ensureInit(PROJECT_ROOT);
    const brain = readBrain(PROJECT_ROOT);
    const events = readEvents(PROJECT_ROOT);
    let score = 0;
    const checks = [];
    if (brain.project.goal) { score += 20; checks.push("- [x] Goal set"); } else checks.push("- [ ] Goal missing");
    if (brain.state.locks.filter(l => l.active).length > 0) { score += 20; checks.push("- [x] Locks defined"); } else checks.push("- [ ] No active locks");
    if (brain.state.decisions.length > 0) { score += 15; checks.push("- [x] Decisions recorded"); } else checks.push("- [ ] No decisions");
    if (brain.state.sessions.length > 0) { score += 15; checks.push("- [x] Sessions tracked"); } else checks.push("- [ ] No sessions");
    if (brain.deploy?.provider) { score += 10; checks.push("- [x] Deploy facts set"); } else checks.push("- [ ] Deploy facts missing");
    if (brain.state.notes.length > 0) { score += 10; checks.push("- [x] Notes present"); } else checks.push("- [ ] No notes");
    if (events.length > 10) { score += 10; checks.push("- [x] Rich event history"); } else checks.push("- [ ] Limited events");
    const grade = score >= 90 ? "A" : score >= 70 ? "B" : score >= 50 ? "C" : score >= 30 ? "D" : "F";
    const sessions = brain.state.sessions.slice(-5);
    const agentTimeline = sessions.length ? "\n\n### Recent Sessions\n" + sessions.map(s => `- **${s.tool || "unknown"}** @ ${s.startedAt}${s.summary ? ": " + s.summary : ""}`).join("\n") : "";
    return { content: [{ type: "text", text: `## SpecLock Health Check\n\nScore: **${score}/100** (Grade: ${grade})\nEvents: ${brain.events.count} | Reverts: ${brain.state.reverts.length}\n\n### Checks\n${checks.join("\n")}${agentTimeline}\n\n---\n*SpecLock v${VERSION} — Developed by ${AUTHOR}*` }] };
  });

  // Tool 20: speclock_apply_template
  server.tool("speclock_apply_template", "Apply a pre-built constraint template (nextjs, react, express, supabase, stripe, security-hardened).", { name: z.string().optional().describe("Template name. Omit to list.") }, async ({ name }) => {
    ensureInit(PROJECT_ROOT);
    if (!name) {
      const templates = listTemplates();
      const text = templates.map(t => `- **${t.name}** (${t.displayName}): ${t.description} — ${t.lockCount} locks, ${t.decisionCount} decisions`).join("\n");
      return { content: [{ type: "text", text: `## Available Templates\n\n${text}\n\nCall again with a name to apply.` }] };
    }
    const result = applyTemplate(PROJECT_ROOT, name);
    if (!result.applied) return { content: [{ type: "text", text: result.error }], isError: true };
    return { content: [{ type: "text", text: `Template "${result.displayName}" applied: ${result.locksAdded} lock(s) + ${result.decisionsAdded} decision(s).` }] };
  });

  // Tool 21: speclock_report
  server.tool("speclock_report", "Violation report — how many times SpecLock blocked changes.", {}, async () => {
    ensureInit(PROJECT_ROOT);
    const report = generateReport(PROJECT_ROOT);
    const parts = [`## Violation Report`, `Total blocked: **${report.totalViolations}**`];
    if (report.mostTestedLocks.length > 0) {
      parts.push("", "### Most Tested Locks");
      for (const l of report.mostTestedLocks) parts.push(`- ${l.count}x — "${l.text}"`);
    }
    parts.push("", report.summary);
    return { content: [{ type: "text", text: parts.join("\n") }] };
  });

  // Tool 22: speclock_audit
  server.tool("speclock_audit", "Audit staged files against active locks.", {}, async () => {
    ensureInit(PROJECT_ROOT);
    const result = auditStagedFiles(PROJECT_ROOT);
    if (result.passed) return { content: [{ type: "text", text: result.message }] };
    const text = result.violations.map(v => `- [${v.severity}] **${v.file}** — ${v.reason}\n  Lock: "${v.lockText}"`).join("\n");
    return { content: [{ type: "text", text: `## Audit Failed\n\n${text}\n\n${result.message}` }] };
  });

  return server;
}

// --- HTTP Server ---
const app = createMcpExpressApp({ host: "0.0.0.0" });

app.post("/mcp", async (req, res) => {
  const server = createSpecLockServer();
  try {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on("close", () => {
      transport.close();
      server.close();
    });
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
    }
  }
});

app.get("/mcp", async (req, res) => {
  res.writeHead(405).end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null }));
});

app.delete("/mcp", async (req, res) => {
  res.writeHead(405).end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null }));
});

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    name: "speclock",
    version: VERSION,
    author: AUTHOR,
    description: "AI Continuity Engine — Kill AI amnesia",
    tools: 22,
    mcp_endpoint: "/mcp",
    npm: "https://www.npmjs.com/package/speclock",
    github: "https://github.com/sgroy10/speclock",
  });
});

const PORT = parseInt(process.env.PORT || "3000", 10);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`SpecLock MCP HTTP Server v${VERSION} running on port ${PORT} — Developed by ${AUTHOR}`);
});
