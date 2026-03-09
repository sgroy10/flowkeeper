/**
 * SpecLock MCP HTTP Server — for Railway / remote deployment
 * Wraps the same 22 tools as the stdio server using Streamable HTTP transport.
 * Developed by Sandeep Roy (https://github.com/sgroy10)
 */

import os from "os";
import fs from "fs";
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
  checkConflictAsync,
  getSessionBriefing,
  endSession,
  suggestLocks,
  detectDrift,
  listTemplates,
  applyTemplate,
  generateReport,
  auditStagedFiles,
  verifyAuditChain,
  exportCompliance,
  enforceConflictCheck,
  setEnforcementMode,
  overrideLock,
  getOverrideHistory,
  semanticAudit,
  addTypedLock,
  updateTypedLockThreshold,
  checkAllTypedConstraints,
  getEnforcementConfig,
  CONSTRAINT_TYPES,
  OPERATORS,
  checkTypedConstraint,
  formatTypedLockText,
  compileSpec,
  compileAndApply,
  buildGraph,
  getOrBuildGraph,
  getBlastRadius,
  mapLocksToFiles,
  getModules,
  getCriticalPaths,
  reviewPatch,
  reviewPatchAsync,
  reviewPatchDiff,
  reviewPatchDiffAsync,
  reviewPatchUnified,
  parseUnifiedDiff,
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
import {
  isAuthEnabled,
  validateApiKey,
  checkPermission,
  createApiKey,
  rotateApiKey,
  revokeApiKey,
  listApiKeys,
  enableAuth,
  disableAuth,
  TOOL_PERMISSIONS,
} from "../core/auth.js";
import { isEncryptionEnabled } from "../core/crypto.js";
import {
  evaluatePolicy,
  listPolicyRules,
  addPolicyRule,
  removePolicyRule,
  initPolicy,
  exportPolicy,
  importPolicy,
} from "../core/policy.js";
import {
  isTelemetryEnabled,
  trackToolUsage,
  getTelemetrySummary,
} from "../core/telemetry.js";
import {
  isSSOEnabled,
  getAuthorizationUrl,
  handleCallback as ssoHandleCallback,
  validateSession,
  revokeSession,
  listSessions,
} from "../core/sso.js";
import { fileURLToPath } from "url";
import _path from "path";

const PROJECT_ROOT = process.env.SPECLOCK_PROJECT_ROOT || process.cwd();
const VERSION = "5.2.3";
const AUTHOR = "Sandeep Roy";
const START_TIME = Date.now();

// --- Rate Limiting ---
const RATE_LIMIT = parseInt(process.env.SPECLOCK_RATE_LIMIT || "100", 10);
const RATE_WINDOW_MS = 60_000;
const rateLimitMap = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }
  const timestamps = rateLimitMap.get(ip).filter((t) => now - t < RATE_WINDOW_MS);
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return timestamps.length <= RATE_LIMIT;
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitMap) {
    const active = timestamps.filter((t) => now - t < RATE_WINDOW_MS);
    if (active.length === 0) rateLimitMap.delete(ip);
    else rateLimitMap.set(ip, active);
  }
}, 5 * 60_000);

// --- CORS Configuration ---
const ALLOWED_ORIGINS = process.env.SPECLOCK_CORS_ORIGINS
  ? process.env.SPECLOCK_CORS_ORIGINS.split(",").map((s) => s.trim())
  : ["*"];

function setCorsHeaders(res) {
  const origin = ALLOWED_ORIGINS.includes("*") ? "*" : ALLOWED_ORIGINS.join(", ");
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

// --- Request Size Limit ---
const MAX_BODY_SIZE = 1024 * 1024; // 1MB

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
    return { content: [{ type: "text", text: `Lock added [${lock.lockId}]: ${text}` }] };
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
    return { content: [{ type: "text", text: `Decision recorded [${d.decId}]: ${text}` }] };
  });

  // Tool 7: speclock_add_note
  server.tool("speclock_add_note", "Add a pinned note for reference.", { text: z.string().min(1).describe("The note text"), pinned: z.boolean().default(true).describe("Whether to pin this note") }, async ({ text, pinned }) => {
    ensureInit(PROJECT_ROOT);
    const result = addNote(PROJECT_ROOT, text, pinned);
    return { content: [{ type: "text", text: `Note added [${result.noteId}]: ${text}` }] };
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

  // Tool 12: speclock_check_conflict (v4.3: hybrid heuristic + Gemini LLM)
  server.tool("speclock_check_conflict", "Check if a proposed action conflicts with any active SpecLock. Uses fast heuristic + Gemini LLM for universal domain coverage. In hard enforcement mode, conflicts above the threshold will BLOCK the action.", { proposedAction: z.string().min(1).describe("Description of the action") }, async ({ proposedAction }) => {
    ensureInit(PROJECT_ROOT);
    // Hybrid check: heuristic first, LLM for grey-zone
    let result = await checkConflictAsync(PROJECT_ROOT, proposedAction);

    // If async hybrid returned no conflict, also check enforcer for hard mode
    if (!result.hasConflict) {
      const enforced = enforceConflictCheck(PROJECT_ROOT, proposedAction);
      if (enforced.blocked) {
        return { content: [{ type: "text", text: enforced.analysis }], isError: true };
      }
    }

    // In hard mode with blocking conflict, return isError: true
    if (result.blocked) {
      return { content: [{ type: "text", text: result.analysis }], isError: true };
    }

    return { content: [{ type: "text", text: result.analysis }] };
  });

  // Tool 13: speclock_session_briefing (v4.3: try-catch + rich output)
  server.tool("speclock_session_briefing", "Start a new session and get a full briefing.", { toolName: z.enum(["claude-code", "cursor", "codex", "windsurf", "cline", "unknown"]).default("unknown") }, async ({ toolName }) => {
    try {
      ensureInit(PROJECT_ROOT);
      const briefing = getSessionBriefing(PROJECT_ROOT, toolName);
      const contextMd = generateContext(PROJECT_ROOT);

      const parts = [];
      parts.push(`# SpecLock Session Briefing`);
      parts.push(`Session started (${toolName}). ID: ${briefing.session?.id || "new"}`);
      parts.push("");

      if (briefing.lastSession) {
        parts.push("## Last Session");
        parts.push(`- Tool: **${briefing.lastSession.toolUsed || "unknown"}**`);
        parts.push(`- Ended: ${briefing.lastSession.endedAt || "unknown"}`);
        if (briefing.lastSession.summary) parts.push(`- Summary: ${briefing.lastSession.summary}`);
        parts.push(`- Events: ${briefing.lastSession.eventsInSession || 0}`);
        parts.push(`- Changes since then: ${briefing.changesSinceLastSession || 0}`);
        parts.push("");
      }

      if (briefing.warnings?.length > 0) {
        parts.push("## Warnings");
        for (const w of briefing.warnings) parts.push(`- ${w}`);
        parts.push("");
      }

      parts.push("---");
      parts.push(contextMd);

      return { content: [{ type: "text", text: parts.join("\n") }] };
    } catch (err) {
      return { content: [{ type: "text", text: `# SpecLock Session Briefing\n\nError loading session: ${err.message}\n\nTry running speclock_init first.\n\n---\n*SpecLock v${VERSION}*` }] };
    }
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

  // Tool 19: speclock_health (v4.3: null-safe)
  server.tool("speclock_health", "Health check with completeness score and multi-agent timeline.", {}, async () => {
    try {
      const brain = ensureInit(PROJECT_ROOT);
      const activeLocks = (brain.specLock?.items || []).filter((l) => l.active !== false);

      let score = 0;
      const checks = [];

      if (brain.goal?.text) { score += 20; checks.push("[PASS] Goal is set"); }
      else checks.push("[MISS] No project goal set");

      if (activeLocks.length > 0) { score += 25; checks.push(`[PASS] ${activeLocks.length} active lock(s)`); }
      else checks.push("[MISS] No SpecLock constraints defined");

      if ((brain.decisions || []).length > 0) { score += 15; checks.push(`[PASS] ${brain.decisions.length} decision(s) recorded`); }
      else checks.push("[MISS] No decisions recorded");

      if ((brain.notes || []).length > 0) { score += 10; checks.push(`[PASS] ${brain.notes.length} note(s)`); }
      else checks.push("[MISS] No notes added");

      const sessionHistory = brain.sessions?.history || [];
      if (sessionHistory.length > 0) { score += 15; checks.push(`[PASS] ${sessionHistory.length} session(s) in history`); }
      else checks.push("[MISS] No session history yet");

      const recentChanges = brain.state?.recentChanges || [];
      if (recentChanges.length > 0) { score += 10; checks.push(`[PASS] ${recentChanges.length} change(s) tracked`); }
      else checks.push("[MISS] No changes tracked");

      if (brain.facts?.deploy?.provider && brain.facts.deploy.provider !== "unknown") { score += 5; checks.push("[PASS] Deploy facts configured"); }
      else checks.push("[MISS] Deploy facts not configured");

      // Multi-agent timeline
      const agentMap = {};
      for (const session of sessionHistory) {
        const tool = session.toolUsed || "unknown";
        if (!agentMap[tool]) agentMap[tool] = { count: 0, lastUsed: "", summaries: [] };
        agentMap[tool].count++;
        if (!agentMap[tool].lastUsed || (session.endedAt && session.endedAt > agentMap[tool].lastUsed)) {
          agentMap[tool].lastUsed = session.endedAt || session.startedAt || "";
        }
        if (session.summary && agentMap[tool].summaries.length < 3) {
          agentMap[tool].summaries.push(session.summary.substring(0, 80));
        }
      }

      let agentTimeline = "";
      if (Object.keys(agentMap).length > 0) {
        agentTimeline = "\n\n## Multi-Agent Timeline\n" +
          Object.entries(agentMap)
            .map(([tool, info]) =>
              `- **${tool}**: ${info.count} session(s), last active ${info.lastUsed ? info.lastUsed.substring(0, 16) : "unknown"}\n  Recent: ${info.summaries.length > 0 ? info.summaries.map(s => `"${s}"`).join(", ") : "(no summaries)"}`
            )
            .join("\n");
      }

      const grade = score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : score >= 20 ? "D" : "F";
      const evtCount = brain.events?.count || 0;
      const revertCount = (brain.state?.reverts || []).length;

      return { content: [{ type: "text", text: `## SpecLock Health Check\n\nScore: **${score}/100** (Grade: ${grade})\nEvents: ${evtCount} | Reverts: ${revertCount}\n\n### Checks\n${checks.join("\n")}${agentTimeline}\n\n---\n*SpecLock v${VERSION} — Developed by ${AUTHOR}*` }] };
    } catch (err) {
      return { content: [{ type: "text", text: `## SpecLock Health Check\n\nError: ${err.message}\n\nTry running speclock_init first to initialize the project.\n\n---\n*SpecLock v${VERSION}*` }] };
    }
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

  // Tool 23: speclock_verify_audit
  server.tool("speclock_verify_audit", "Verify the integrity of the HMAC audit chain.", {}, async () => {
    ensureInit(PROJECT_ROOT);
    const result = verifyAuditChain(PROJECT_ROOT);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  // Tool 24: speclock_export_compliance
  server.tool("speclock_export_compliance", "Generate compliance reports (SOC 2, HIPAA, CSV).", { format: z.enum(["soc2", "hipaa", "csv"]).describe("Export format") }, async ({ format }) => {
    ensureInit(PROJECT_ROOT);
    const result = exportCompliance(PROJECT_ROOT, format);
    if (result.error) return { content: [{ type: "text", text: result.error }], isError: true };
    const output = format === "csv" ? result.data : JSON.stringify(result.data, null, 2);
    return { content: [{ type: "text", text: output }] };
  });

  // Tool 25: speclock_set_enforcement (v2.5)
  server.tool("speclock_set_enforcement", "Set enforcement mode: advisory (warn) or hard (block).", { mode: z.enum(["advisory", "hard"]).describe("Enforcement mode"), blockThreshold: z.number().int().min(0).max(100).optional().default(70).describe("Block threshold %") }, async ({ mode, blockThreshold }) => {
    const result = setEnforcementMode(PROJECT_ROOT, mode, { blockThreshold });
    if (!result.success) return { content: [{ type: "text", text: result.error }], isError: true };
    return { content: [{ type: "text", text: `Enforcement: ${mode} (threshold: ${result.config.blockThreshold}%)` }] };
  });

  // Tool 26: speclock_override_lock (v2.5)
  server.tool("speclock_override_lock", "Override a lock with justification. Logged to audit trail.", { lockId: z.string().min(1), action: z.string().min(1), reason: z.string().min(1) }, async ({ lockId, action, reason }) => {
    const result = overrideLock(PROJECT_ROOT, lockId, action, reason);
    if (!result.success) return { content: [{ type: "text", text: result.error }], isError: true };
    const msg = result.escalated ? `\n${result.escalationMessage}` : "";
    return { content: [{ type: "text", text: `Override: "${result.lockText}" (${result.overrideCount}x)${msg}` }] };
  });

  // Tool 27: speclock_semantic_audit (v2.5)
  server.tool("speclock_semantic_audit", "Semantic pre-commit: analyzes code changes vs locks.", {}, async () => {
    const result = semanticAudit(PROJECT_ROOT);
    return { content: [{ type: "text", text: result.message }], isError: result.blocked || false };
  });

  // Tool 28: speclock_override_history (v2.5)
  server.tool("speclock_override_history", "Show lock override history.", { lockId: z.string().optional() }, async ({ lockId }) => {
    const result = getOverrideHistory(PROJECT_ROOT, lockId);
    if (result.total === 0) return { content: [{ type: "text", text: "No overrides recorded." }] };
    const lines = result.overrides.map(o => `[${o.at.substring(0,19)}] "${o.lockText}" — ${o.reason}`).join("\n");
    return { content: [{ type: "text", text: `Overrides (${result.total}):\n${lines}` }] };
  });

  // ========================================
  // TYPED CONSTRAINTS — Autonomous Systems Governance (v5.0)
  // ========================================

  // Tool 29: speclock_add_typed_lock
  server.tool("speclock_add_typed_lock", "Add a typed constraint for autonomous systems governance.", {
    constraintType: z.enum(["numerical", "range", "state", "temporal"]),
    metric: z.string().optional(),
    operator: z.enum(["<", "<=", "==", "!=", ">=", ">"]).optional(),
    value: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    unit: z.string().optional(),
    entity: z.string().optional(),
    forbidden: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
    requireApproval: z.boolean().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).default([]),
    source: z.enum(["user", "agent"]).default("user"),
  }, async (params) => {
    const constraint = {
      constraintType: params.constraintType,
      ...(params.metric && { metric: params.metric }),
      ...(params.operator && { operator: params.operator }),
      ...(params.value !== undefined && { value: params.value }),
      ...(params.min !== undefined && { min: params.min }),
      ...(params.max !== undefined && { max: params.max }),
      ...(params.unit && { unit: params.unit }),
      ...(params.entity && { entity: params.entity }),
      ...(params.forbidden && { forbidden: params.forbidden }),
      ...(params.requireApproval !== undefined && { requireApproval: params.requireApproval }),
    };
    const result = addTypedLock(PROJECT_ROOT, constraint, params.tags, params.source, params.description);
    if (result.error) return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
    return { content: [{ type: "text", text: `Typed lock added (${params.constraintType}): ${result.lockId}` }] };
  });

  // Tool 30: speclock_check_typed
  server.tool("speclock_check_typed", "Check a proposed value or state transition against typed constraints.", {
    metric: z.string().optional(),
    entity: z.string().optional(),
    value: z.number().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  }, async (params) => {
    const brain = ensureInit(PROJECT_ROOT);
    const proposed = {
      ...(params.metric && { metric: params.metric }),
      ...(params.entity && { entity: params.entity }),
      ...(params.value !== undefined && { value: params.value }),
      ...(params.from && { from: params.from }),
      ...(params.to && { to: params.to }),
    };
    const result = checkAllTypedConstraints(brain.specLock?.items || [], proposed);
    if (result.hasConflict) {
      const enforcement = getEnforcementConfig(PROJECT_ROOT);
      const isHard = enforcement.mode === "hard";
      const topConf = result.conflictingLocks[0]?.confidence || 0;
      return {
        content: [{ type: "text", text: `VIOLATION: ${result.analysis}` }],
        isError: isHard && topConf >= enforcement.blockThreshold,
      };
    }
    return { content: [{ type: "text", text: result.analysis }] };
  });

  // Tool 31: speclock_list_typed_locks
  server.tool("speclock_list_typed_locks", "List all typed constraints.", {}, async () => {
    const brain = ensureInit(PROJECT_ROOT);
    const typed = (brain.specLock?.items || []).filter(l => l.active !== false && l.constraintType);
    if (typed.length === 0) return { content: [{ type: "text", text: "No typed constraints. Use speclock_add_typed_lock to add." }] };
    const lines = typed.map(l => `[${l.constraintType}] ${l.id}: ${l.text}`).join("\n");
    return { content: [{ type: "text", text: `Typed Constraints (${typed.length}):\n${lines}` }] };
  });

  // Tool 32: speclock_update_threshold
  server.tool("speclock_update_threshold", "Update a typed lock threshold.", {
    lockId: z.string().min(1),
    value: z.number().optional(),
    operator: z.enum(["<", "<=", "==", "!=", ">=", ">"]).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    forbidden: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
  }, async (params) => {
    const updates = {};
    if (params.value !== undefined) updates.value = params.value;
    if (params.operator) updates.operator = params.operator;
    if (params.min !== undefined) updates.min = params.min;
    if (params.max !== undefined) updates.max = params.max;
    if (params.forbidden) updates.forbidden = params.forbidden;
    const result = updateTypedLockThreshold(PROJECT_ROOT, params.lockId, updates);
    if (result.error) return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
    return { content: [{ type: "text", text: `Updated ${params.lockId}: ${JSON.stringify(result.newValues)}` }] };
  });

  return server;
}

// --- HTTP Server ---
const app = createMcpExpressApp({ host: "0.0.0.0" });

// CORS preflight handler
app.options("/{*path}", (req, res) => {
  setCorsHeaders(res);
  res.writeHead(204).end();
});

// --- Auth middleware helper ---
function authenticateRequest(req) {
  if (!isAuthEnabled(PROJECT_ROOT)) {
    return { valid: true, role: "admin", authEnabled: false };
  }
  const authHeader = req.headers["authorization"] || "";
  const rawKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  return validateApiKey(PROJECT_ROOT, rawKey);
}

app.post("/mcp", async (req, res) => {
  setCorsHeaders(res);

  // Rate limiting
  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: `Rate limit exceeded (${RATE_LIMIT} req/min). Try again later.` },
      id: null,
    });
  }

  // Request size check
  const contentLength = parseInt(req.headers["content-length"] || "0", 10);
  if (contentLength > MAX_BODY_SIZE) {
    return res.status(413).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: `Request too large (max ${MAX_BODY_SIZE / 1024}KB)` },
      id: null,
    });
  }

  // Authentication (v3.0)
  const auth = authenticateRequest(req);
  if (!auth.valid) {
    return res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: auth.error || "Authentication required." },
      id: null,
    });
  }

  // RBAC check — extract tool name from JSON-RPC body for permission check
  if (auth.authEnabled && req.body && req.body.method === "tools/call") {
    const toolName = req.body.params?.name;
    if (toolName && !checkPermission(auth.role, toolName)) {
      return res.status(403).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: `Permission denied. Role "${auth.role}" cannot access "${toolName}". Required: ${TOOL_PERMISSIONS[toolName] || "admin"}` },
        id: req.body.id || null,
      });
    }
  }

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

// --- Auth management endpoint (v3.0) ---
app.post("/auth", async (req, res) => {
  setCorsHeaders(res);
  const auth = authenticateRequest(req);

  const { action } = req.body || {};

  // Creating the first key doesn't require auth (bootstrap)
  if (action === "create-key" && !isAuthEnabled(PROJECT_ROOT)) {
    const { role, name } = req.body;
    const result = createApiKey(PROJECT_ROOT, role || "admin", name || "");
    return res.json(result);
  }

  // All other auth actions require admin role
  if (auth.authEnabled && (!auth.valid || auth.role !== "admin")) {
    return res.status(auth.valid ? 403 : 401).json({
      error: auth.valid ? "Admin role required for auth management." : auth.error,
    });
  }

  switch (action) {
    case "create-key": {
      const { role, name } = req.body;
      return res.json(createApiKey(PROJECT_ROOT, role || "developer", name || ""));
    }
    case "rotate-key": {
      const { keyId } = req.body;
      return res.json(rotateApiKey(PROJECT_ROOT, keyId));
    }
    case "revoke-key": {
      const { keyId, reason } = req.body;
      return res.json(revokeApiKey(PROJECT_ROOT, keyId, reason || "manual"));
    }
    case "list-keys":
      return res.json(listApiKeys(PROJECT_ROOT));
    case "enable":
      return res.json(enableAuth(PROJECT_ROOT));
    case "disable":
      return res.json(disableAuth(PROJECT_ROOT));
    default:
      return res.status(400).json({ error: `Unknown auth action: "${action}". Valid: create-key, rotate-key, revoke-key, list-keys, enable, disable` });
  }
});

app.get("/mcp", async (req, res) => {
  setCorsHeaders(res);
  res.writeHead(405).end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null }));
});

app.delete("/mcp", async (req, res) => {
  setCorsHeaders(res);
  res.writeHead(405).end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null }));
});

// ========================================
// PUBLIC PROXY API (v4.3 — for npm-install users)
// Allows npm-install users to get Gemini LLM coverage without
// needing their own API key. Heuristic runs locally, grey-zone
// cases are proxied here for LLM verification.
// ========================================

app.post("/api/check", async (req, res) => {
  setCorsHeaders(res);

  // Rate limiting
  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: "Rate limit exceeded. Try again later." });
  }

  const { action, locks } = req.body || {};
  if (!action || typeof action !== "string") {
    return res.status(400).json({ error: "Missing required field: action (string)" });
  }
  if (!locks || !Array.isArray(locks) || locks.length === 0) {
    return res.status(400).json({ error: "Missing required field: locks (non-empty array of strings)" });
  }
  if (locks.length > 50) {
    return res.status(400).json({ error: "Too many locks (max 50)" });
  }

  try {
    // Build lock objects for the LLM checker
    const activeLocks = locks.map((text, i) => ({
      id: `proxy-${i}`,
      text: String(text),
      active: true,
    }));

    // Run heuristic first (same as local)
    const { analyzeConflict } = await import("../core/semantics.js");
    const heuristicConflicts = [];
    for (const lock of activeLocks) {
      const result = analyzeConflict(action, lock.text);
      if (result.isConflict) {
        heuristicConflicts.push({
          lockText: lock.text,
          confidence: result.confidence,
          level: result.level,
          reasons: result.reasons,
          source: "heuristic",
        });
      }
    }

    // If all heuristic conflicts are HIGH (>70%), return immediately
    if (heuristicConflicts.length > 0 && heuristicConflicts.every(c => c.confidence > 70)) {
      return res.json({
        hasConflict: true,
        conflicts: heuristicConflicts,
        source: "heuristic",
      });
    }

    // Call LLM for full coverage
    const { llmCheckConflict } = await import("../core/llm-checker.js");
    const llmResult = await llmCheckConflict(null, action, activeLocks);

    if (llmResult) {
      // Merge: keep HIGH heuristic + all LLM conflicts
      const highHeuristic = heuristicConflicts.filter(c => c.confidence > 70);
      const llmConflicts = (llmResult.conflictingLocks || []).map(c => ({
        lockText: c.text,
        confidence: c.confidence,
        level: c.level,
        reasons: c.reasons || [],
        source: "gemini",
      }));
      const merged = [...highHeuristic, ...llmConflicts];

      // Deduplicate by lock text
      const byText = new Map();
      for (const c of merged) {
        const existing = byText.get(c.lockText);
        if (!existing || c.confidence > existing.confidence) {
          byText.set(c.lockText, c);
        }
      }
      const unique = [...byText.values()];

      return res.json({
        hasConflict: unique.length > 0,
        conflicts: unique,
        source: unique.some(c => c.source === "gemini") ? "hybrid" : "heuristic",
      });
    }

    // LLM unavailable — return heuristic result
    return res.json({
      hasConflict: heuristicConflicts.length > 0,
      conflicts: heuristicConflicts,
      source: "heuristic-only",
    });
  } catch (err) {
    return res.status(500).json({ error: `Check failed: ${err.message}` });
  }
});

// Health check endpoint (enhanced for enterprise)
app.get("/health", (req, res) => {
  setCorsHeaders(res);
  let auditStatus = "unknown";
  try {
    const result = verifyAuditChain(PROJECT_ROOT);
    auditStatus = result.valid ? "valid" : "broken";
  } catch {
    auditStatus = "unavailable";
  }

  res.json({
    status: "healthy",
    version: VERSION,
    uptime: Math.floor((Date.now() - START_TIME) / 1000),
    tools: 42,
    auditChain: auditStatus,
    authEnabled: isAuthEnabled(PROJECT_ROOT),
    rateLimit: { limit: RATE_LIMIT, windowMs: RATE_WINDOW_MS },
  });
});

// Root info endpoint
app.get("/", (req, res) => {
  setCorsHeaders(res);
  res.json({
    name: "speclock",
    version: VERSION,
    author: AUTHOR,
    description: "AI Constraint Engine — AI Patch Firewall. Patch Gateway (ALLOW/WARN/BLOCK verdicts), diff-native review (interface breaks, protected symbols, dependency drift, schema changes, API impact). Spec Compiler (NL→constraints), Code Graph (blast radius, lock-to-file mapping), Typed constraints, REST API v2, Python SDK + ROS2 integration. Policy-as-Code, RBAC, AES-256-GCM encryption, HMAC audit chain, SOC 2/HIPAA compliance. 42 MCP tools. 1073 tests, 99.4% accuracy.",
    tools: 42,
    mcp_endpoint: "/mcp",
    health_endpoint: "/health",
    npm: "https://www.npmjs.com/package/speclock",
    github: "https://github.com/sgroy10/speclock",
  });
});

// Smithery server card for listing metadata
app.get("/.well-known/mcp/server-card.json", (req, res) => {
  setCorsHeaders(res);
  // Smithery-compatible server card format (SEP-1649)
  res.json({
    serverInfo: {
      name: "speclock",
      version: VERSION,
    },
    tools: [
      { name: "speclock_init", description: "Initialize SpecLock in the current project directory.", inputSchema: { type: "object", properties: {} } },
      { name: "speclock_get_context", description: "THE KEY TOOL. Returns the full structured context pack.", inputSchema: { type: "object", properties: { format: { enum: ["markdown","json"], type: "string", default: "markdown" } } } },
      { name: "speclock_set_goal", description: "Set or update the project goal.", inputSchema: { type: "object", properties: { text: { type: "string", minLength: 1 } } } },
      { name: "speclock_add_lock", description: "Add a non-negotiable constraint (SpecLock).", inputSchema: { type: "object", properties: { text: { type: "string", minLength: 1 }, tags: { type: "array", items: { type: "string" }, default: [] }, source: { enum: ["user","agent"], type: "string", default: "agent" } } } },
      { name: "speclock_remove_lock", description: "Remove (deactivate) a SpecLock by its ID.", inputSchema: { type: "object", properties: { lockId: { type: "string", minLength: 1 } } } },
      { name: "speclock_add_decision", description: "Record an architectural or design decision.", inputSchema: { type: "object", properties: { text: { type: "string", minLength: 1 }, tags: { type: "array", items: { type: "string" }, default: [] }, source: { enum: ["user","agent"], type: "string", default: "agent" } } } },
      { name: "speclock_add_note", description: "Add a pinned note for reference.", inputSchema: { type: "object", properties: { text: { type: "string", minLength: 1 }, pinned: { type: "boolean", default: true } } } },
      { name: "speclock_set_deploy_facts", description: "Record deployment configuration facts.", inputSchema: { type: "object", properties: { provider: { type: "string" }, branch: { type: "string" }, url: { type: "string" }, autoDeploy: { type: "boolean" }, notes: { type: "string" } } } },
      { name: "speclock_log_change", description: "Manually log a significant change.", inputSchema: { type: "object", properties: { summary: { type: "string", minLength: 1 }, files: { type: "array", items: { type: "string" }, default: [] } } } },
      { name: "speclock_get_changes", description: "Get recent file changes tracked by SpecLock.", inputSchema: { type: "object", properties: { limit: { type: "integer", default: 20, minimum: 1, maximum: 100 } } } },
      { name: "speclock_get_events", description: "Get the event log, optionally filtered by type.", inputSchema: { type: "object", properties: { type: { type: "string" }, limit: { type: "integer", default: 50, minimum: 1, maximum: 200 }, since: { type: "string" } } } },
      { name: "speclock_check_conflict", description: "Check if a proposed action conflicts with any active SpecLock. In hard mode, blocks above threshold.", inputSchema: { type: "object", properties: { proposedAction: { type: "string", minLength: 1 } } } },
      { name: "speclock_session_briefing", description: "Start a new session and get a full briefing.", inputSchema: { type: "object", properties: { toolName: { enum: ["claude-code","cursor","codex","windsurf","cline","unknown"], type: "string", default: "unknown" } } } },
      { name: "speclock_session_summary", description: "End the current session and record what was accomplished.", inputSchema: { type: "object", properties: { summary: { type: "string", minLength: 1 } } } },
      { name: "speclock_checkpoint", description: "Create a named git tag checkpoint for easy rollback.", inputSchema: { type: "object", properties: { name: { type: "string", minLength: 1 } } } },
      { name: "speclock_repo_status", description: "Get current git repository status.", inputSchema: { type: "object", properties: {} } },
      { name: "speclock_suggest_locks", description: "AI-powered lock suggestions based on project patterns.", inputSchema: { type: "object", properties: {} } },
      { name: "speclock_detect_drift", description: "Scan recent changes for constraint violations.", inputSchema: { type: "object", properties: {} } },
      { name: "speclock_health", description: "Health check with completeness score and multi-agent timeline.", inputSchema: { type: "object", properties: {} } },
      { name: "speclock_apply_template", description: "Apply a pre-built constraint template (nextjs, react, express, supabase, stripe, security-hardened).", inputSchema: { type: "object", properties: { name: { type: "string" } } } },
      { name: "speclock_report", description: "Violation report — how many times SpecLock blocked changes.", inputSchema: { type: "object", properties: {} } },
      { name: "speclock_audit", description: "Audit staged files against active locks.", inputSchema: { type: "object", properties: {} } },
      { name: "speclock_verify_audit", description: "Verify the integrity of the HMAC audit chain.", inputSchema: { type: "object", properties: {} } },
      { name: "speclock_export_compliance", description: "Generate compliance reports (SOC 2, HIPAA, CSV).", inputSchema: { type: "object", properties: { format: { enum: ["soc2","hipaa","csv"], type: "string" } } } },
      { name: "speclock_set_enforcement", description: "Set enforcement mode: advisory (warn) or hard (block).", inputSchema: { type: "object", properties: { mode: { enum: ["advisory","hard"], type: "string" }, blockThreshold: { type: "integer", default: 70, minimum: 0, maximum: 100 } } } },
      { name: "speclock_override_lock", description: "Override a lock with justification. Logged to audit trail.", inputSchema: { type: "object", properties: { lockId: { type: "string", minLength: 1 }, action: { type: "string", minLength: 1 }, reason: { type: "string", minLength: 1 } } } },
      { name: "speclock_semantic_audit", description: "Semantic pre-commit: analyzes code changes vs locks.", inputSchema: { type: "object", properties: {} } },
      { name: "speclock_override_history", description: "Show lock override history.", inputSchema: { type: "object", properties: { lockId: { type: "string" } } } },
      { name: "speclock_policy_evaluate", description: "Evaluate policy-as-code rules against proposed actions.", inputSchema: { type: "object", properties: { files: { type: "array", items: { type: "string" } }, actionType: { type: "string" } } } },
      { name: "speclock_policy_manage", description: "Policy CRUD: list, add, remove policy rules.", inputSchema: { type: "object", properties: { action: { enum: ["list","add","remove"], type: "string" } } } },
      { name: "speclock_telemetry", description: "Opt-in usage analytics summary.", inputSchema: { type: "object", properties: { action: { enum: ["status","enable","disable","report"], type: "string" } } } },
      { name: "speclock_guard_file", description: "Add SPECLOCK-GUARD header to lock specific files.", inputSchema: { type: "object", properties: { file: { type: "string" }, lockId: { type: "string" } } } },
      { name: "speclock_auto_guard", description: "Auto-guard files related to lock keywords.", inputSchema: { type: "object", properties: {} } },
      { name: "speclock_add_typed_lock", description: "Add typed constraint (numerical/range/state/temporal).", inputSchema: { type: "object", properties: { constraintType: { enum: ["numerical","range","state","temporal"], type: "string" }, metric: { type: "string" }, operator: { type: "string" }, value: {}, unit: { type: "string" }, description: { type: "string" } } } },
      { name: "speclock_check_typed", description: "Check proposed values against typed constraints.", inputSchema: { type: "object", properties: { metric: { type: "string" }, value: {} } } },
      { name: "speclock_list_typed_locks", description: "List all typed constraints with current thresholds.", inputSchema: { type: "object", properties: {} } },
      { name: "speclock_update_threshold", description: "Update typed lock thresholds dynamically.", inputSchema: { type: "object", properties: { lockId: { type: "string" }, value: {}, operator: { type: "string" } } } },
      { name: "speclock_compile_spec", description: "Compile natural language (PRDs, READMEs) into structured constraints via Gemini Flash.", inputSchema: { type: "object", properties: { text: { type: "string" }, autoApply: { type: "boolean", default: false } } } },
      { name: "speclock_build_graph", description: "Build/refresh code dependency graph from imports (JS/TS/Python).", inputSchema: { type: "object", properties: {} } },
      { name: "speclock_blast_radius", description: "Calculate blast radius — transitive dependents, impact %, depth.", inputSchema: { type: "object", properties: { file: { type: "string" } } } },
      { name: "speclock_map_locks", description: "Map active locks to actual code files via the dependency graph.", inputSchema: { type: "object", properties: {} } },
      { name: "speclock_review_patch", description: "ALLOW/WARN/BLOCK verdict — combines semantic conflict + lock-file mapping + blast radius.", inputSchema: { type: "object", properties: { description: { type: "string" }, files: { type: "array", items: { type: "string" } } } } },
      { name: "speclock_review_patch_diff", description: "Diff-native review — parses actual diffs for interface breaks, protected symbols, dependency drift, schema changes.", inputSchema: { type: "object", properties: { description: { type: "string" }, diff: { type: "string" } } } },
      { name: "speclock_parse_diff", description: "Parse unified diff into structured changes — imports, exports, symbols, routes, schema detection.", inputSchema: { type: "object", properties: { diff: { type: "string" } } } },
    ],
    resources: [],
    prompts: [],
  });
});

// ========================================
// DASHBOARD (v3.5)
// ========================================

// Serve dashboard HTML
app.get("/dashboard", (req, res) => {
  setCorsHeaders(res);
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = _path.dirname(__filename);
  const htmlPath = _path.join(__dirname, "..", "dashboard", "index.html");
  try {
    const html = fs.readFileSync(htmlPath, "utf-8");
    res.setHeader("Content-Type", "text/html");
    res.end(html);
  } catch {
    res.status(404).end("Dashboard not found.");
  }
});

// Dashboard API: brain data
app.get("/dashboard/api/brain", (req, res) => {
  setCorsHeaders(res);
  try {
    ensureInit(PROJECT_ROOT);
    const brain = readBrain(PROJECT_ROOT);
    if (!brain) return res.json({});
    // Add metadata for dashboard
    brain._encryption = isEncryptionEnabled();
    brain._authEnabled = isAuthEnabled(PROJECT_ROOT);
    try {
      const keys = listApiKeys(PROJECT_ROOT);
      brain._authKeys = keys.keys.filter(k => k.active).length;
    } catch { brain._authKeys = 0; }
    res.json(brain);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Dashboard API: recent events
app.get("/dashboard/api/events", (req, res) => {
  setCorsHeaders(res);
  try {
    const events = readEvents(PROJECT_ROOT, { limit: 50 });
    res.json({ events });
  } catch {
    res.json({ events: [] });
  }
});

// Dashboard API: telemetry summary
app.get("/dashboard/api/telemetry", (req, res) => {
  setCorsHeaders(res);
  res.json(getTelemetrySummary(PROJECT_ROOT));
});

// ========================================
// POLICY-AS-CODE ENDPOINTS (v3.5)
// ========================================

app.get("/policy", (req, res) => {
  setCorsHeaders(res);
  res.json(listPolicyRules(PROJECT_ROOT));
});

app.post("/policy", async (req, res) => {
  setCorsHeaders(res);
  const auth = authenticateRequest(req);
  if (auth.authEnabled && (!auth.valid || !checkPermission(auth.role, "speclock_add_lock"))) {
    return res.status(auth.valid ? 403 : 401).json({ error: "Write permission required." });
  }

  const { action } = req.body || {};
  switch (action) {
    case "init":
      return res.json(initPolicy(PROJECT_ROOT));
    case "add-rule":
      return res.json(addPolicyRule(PROJECT_ROOT, req.body.rule || {}));
    case "remove-rule":
      return res.json(removePolicyRule(PROJECT_ROOT, req.body.ruleId));
    case "evaluate":
      return res.json(evaluatePolicy(PROJECT_ROOT, req.body.action || {}));
    case "export":
      return res.json(exportPolicy(PROJECT_ROOT));
    case "import":
      return res.json(importPolicy(PROJECT_ROOT, req.body.yaml || "", req.body.mode || "merge"));
    default:
      return res.status(400).json({ error: `Unknown policy action. Valid: init, add-rule, remove-rule, evaluate, export, import` });
  }
});

// ========================================
// REST API v2 — Real-Time Constraint Checking (v5.0)
// For robotics, IoT, autonomous systems, trading platforms.
// Sub-millisecond local checks, batch operations, SSE streaming.
// Developed by Sandeep Roy (https://github.com/sgroy10)
// ========================================

// --- v2: Check a single typed constraint ---
app.post("/api/v2/check-typed", (req, res) => {
  setCorsHeaders(res);
  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: "Rate limit exceeded." });
  }

  const start = performance.now();
  const { metric, entity, value, from_state, to_state } = req.body || {};

  if (!metric && !entity) {
    return res.status(400).json({ error: "Required: metric (string) or entity (string)" });
  }

  try {
    ensureInit(PROJECT_ROOT);
    const brain = readBrain(PROJECT_ROOT);
    const locks = brain?.specLock?.items || [];

    const proposed = {};
    if (metric) proposed.metric = metric;
    if (entity) proposed.entity = entity;
    if (value !== undefined) proposed.value = value;
    if (from_state) proposed.from = from_state;
    if (to_state) proposed.to = to_state;

    const result = checkAllTypedConstraints(locks, proposed);
    const elapsed = performance.now() - start;

    return res.json({
      ...result,
      response_time_ms: Number(elapsed.toFixed(3)),
      api_version: "v2",
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- v2: Batch check multiple values at once ---
// Single HTTP call for all sensor readings in a tick.
// Body: { checks: [{ metric, value }, { entity, from_state, to_state }, ...] }
app.post("/api/v2/check-batch", (req, res) => {
  setCorsHeaders(res);
  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: "Rate limit exceeded." });
  }

  const start = performance.now();
  const { checks } = req.body || {};

  if (!Array.isArray(checks) || checks.length === 0) {
    return res.status(400).json({ error: "Required: checks (non-empty array)" });
  }
  if (checks.length > 100) {
    return res.status(400).json({ error: "Too many checks (max 100 per batch)" });
  }

  try {
    ensureInit(PROJECT_ROOT);
    const brain = readBrain(PROJECT_ROOT);
    const locks = brain?.specLock?.items || [];

    const results = [];
    let totalViolations = 0;
    let criticalCount = 0;

    for (const check of checks) {
      const proposed = {};
      if (check.metric) proposed.metric = check.metric;
      if (check.entity) proposed.entity = check.entity;
      if (check.value !== undefined) proposed.value = check.value;
      if (check.from_state) proposed.from = check.from_state;
      if (check.to_state) proposed.to = check.to_state;

      const result = checkAllTypedConstraints(locks, proposed);
      if (result.hasConflict) {
        totalViolations++;
        const topConfidence = result.conflictingLocks?.[0]?.confidence || 0;
        if (topConfidence >= 90) criticalCount++;
      }

      results.push({
        input: check,
        ...result,
      });
    }

    const elapsed = performance.now() - start;

    return res.json({
      batch_size: checks.length,
      total_violations: totalViolations,
      critical_violations: criticalCount,
      emergency_stop: criticalCount > 0,
      results,
      response_time_ms: Number(elapsed.toFixed(3)),
      avg_check_ms: Number((elapsed / checks.length).toFixed(3)),
      api_version: "v2",
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- v2: Add typed constraint via REST ---
app.post("/api/v2/constraints", (req, res) => {
  setCorsHeaders(res);
  const auth = authenticateRequest(req);
  if (auth.authEnabled && (!auth.valid || !checkPermission(auth.role, "speclock_add_lock"))) {
    return res.status(auth.valid ? 403 : 401).json({ error: "Write permission required." });
  }

  const { constraint_type, description, tags, ...kwargs } = req.body || {};

  if (!CONSTRAINT_TYPES.includes(constraint_type)) {
    return res.status(400).json({
      error: `Invalid constraint_type. Must be one of: ${CONSTRAINT_TYPES.join(", ")}`,
    });
  }

  try {
    ensureInit(PROJECT_ROOT);
    const lockId = addTypedLock(PROJECT_ROOT, { constraintType: constraint_type, ...kwargs }, tags || [], "user", description);
    return res.json({ success: true, lock_id: lockId, constraint_type });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// --- v2: List typed constraints ---
app.get("/api/v2/constraints", (req, res) => {
  setCorsHeaders(res);
  try {
    ensureInit(PROJECT_ROOT);
    const brain = readBrain(PROJECT_ROOT);
    const locks = (brain?.specLock?.items || []).filter(
      (l) => l.active !== false && CONSTRAINT_TYPES.includes(l.constraintType)
    );

    const byType = {};
    for (const ct of CONSTRAINT_TYPES) byType[ct] = 0;
    for (const l of locks) byType[l.constraintType]++;

    return res.json({
      total: locks.length,
      by_type: byType,
      constraints: locks.map((l) => ({
        id: l.id,
        type: l.constraintType,
        metric: l.metric,
        entity: l.entity,
        text: l.text || formatTypedLockText(l),
        tags: l.tags || [],
        created: l.createdAt,
      })),
      api_version: "v2",
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- v2: Update constraint threshold ---
app.put("/api/v2/constraints/:lockId", (req, res) => {
  setCorsHeaders(res);
  const auth = authenticateRequest(req);
  if (auth.authEnabled && (!auth.valid || !checkPermission(auth.role, "speclock_add_lock"))) {
    return res.status(auth.valid ? 403 : 401).json({ error: "Write permission required." });
  }

  const { lockId } = req.params;
  const updates = req.body || {};

  try {
    ensureInit(PROJECT_ROOT);
    const result = updateTypedLockThreshold(PROJECT_ROOT, lockId, updates);
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// --- v2: Delete constraint ---
app.delete("/api/v2/constraints/:lockId", (req, res) => {
  setCorsHeaders(res);
  const auth = authenticateRequest(req);
  if (auth.authEnabled && (!auth.valid || !checkPermission(auth.role, "speclock_add_lock"))) {
    return res.status(auth.valid ? 403 : 401).json({ error: "Write permission required." });
  }

  const { lockId } = req.params;
  try {
    ensureInit(PROJECT_ROOT);
    removeLock(PROJECT_ROOT, lockId);
    return res.json({ success: true, removed: lockId });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// --- v2: SSE Stream for real-time constraint status ---
// Clients connect once and receive constraint violation events in real-time.
// Usage: const evtSource = new EventSource("/api/v2/stream");
const sseClients = new Set();

app.get("/api/v2/stream", (req, res) => {
  setCorsHeaders(res);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Send initial status
  try {
    ensureInit(PROJECT_ROOT);
    const brain = readBrain(PROJECT_ROOT);
    const locks = (brain?.specLock?.items || []).filter(
      (l) => l.active !== false && CONSTRAINT_TYPES.includes(l.constraintType)
    );
    const initData = {
      type: "connected",
      typed_constraints: locks.length,
      total_locks: (brain?.specLock?.items || []).filter((l) => l.active !== false).length,
      timestamp: new Date().toISOString(),
    };
    res.write(`event: status\ndata: ${JSON.stringify(initData)}\n\n`);
  } catch {
    res.write(`event: status\ndata: ${JSON.stringify({ type: "connected", typed_constraints: 0 })}\n\n`);
  }

  // Register client
  const client = { res, id: Date.now() };
  sseClients.add(client);

  // Keep alive every 15 seconds
  const keepAlive = setInterval(() => {
    res.write(`:keepalive ${new Date().toISOString()}\n\n`);
  }, 15_000);

  req.on("close", () => {
    sseClients.delete(client);
    clearInterval(keepAlive);
  });
});

// --- v2: Push a check and broadcast violations via SSE ---
// POST /api/v2/stream/check — check constraints AND push violations to all SSE clients
app.post("/api/v2/stream/check", (req, res) => {
  setCorsHeaders(res);
  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: "Rate limit exceeded." });
  }

  const start = performance.now();
  const { checks } = req.body || {};

  // Accept single check or batch
  const checkList = Array.isArray(checks) ? checks : [req.body];

  try {
    ensureInit(PROJECT_ROOT);
    const brain = readBrain(PROJECT_ROOT);
    const locks = brain?.specLock?.items || [];
    const violations = [];

    for (const check of checkList) {
      const proposed = {};
      if (check.metric) proposed.metric = check.metric;
      if (check.entity) proposed.entity = check.entity;
      if (check.value !== undefined) proposed.value = check.value;
      if (check.from_state) proposed.from = check.from_state;
      if (check.to_state) proposed.to = check.to_state;

      const result = checkAllTypedConstraints(locks, proposed);
      if (result.hasConflict) {
        const violation = {
          type: "violation",
          input: check,
          conflicts: result.conflictingLocks,
          analysis: result.analysis,
          timestamp: new Date().toISOString(),
        };
        violations.push(violation);

        // Broadcast to all SSE clients
        for (const client of sseClients) {
          try {
            client.res.write(`event: violation\ndata: ${JSON.stringify(violation)}\n\n`);
          } catch {
            sseClients.delete(client);
          }
        }
      }
    }

    const elapsed = performance.now() - start;
    return res.json({
      checked: checkList.length,
      violations: violations.length,
      emergency_stop: violations.some(
        (v) => v.conflicts?.some((c) => c.confidence >= 90)
      ),
      details: violations,
      sse_clients: sseClients.size,
      response_time_ms: Number(elapsed.toFixed(3)),
      api_version: "v2",
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- v2: Real-time system status ---
app.get("/api/v2/status", (req, res) => {
  setCorsHeaders(res);
  try {
    ensureInit(PROJECT_ROOT);
    const brain = readBrain(PROJECT_ROOT);
    const allLocks = (brain?.specLock?.items || []).filter((l) => l.active !== false);
    const typedLocks = allLocks.filter((l) => CONSTRAINT_TYPES.includes(l.constraintType));
    const textLocks = allLocks.filter((l) => !l.constraintType);

    const byType = {};
    for (const ct of CONSTRAINT_TYPES) byType[ct] = 0;
    for (const l of typedLocks) byType[l.constraintType]++;

    // Unique metrics and entities being monitored
    const metrics = [...new Set(typedLocks.filter((l) => l.metric).map((l) => l.metric))];
    const entities = [...new Set(typedLocks.filter((l) => l.entity).map((l) => l.entity))];

    return res.json({
      status: "active",
      version: VERSION,
      uptime: Math.floor((Date.now() - START_TIME) / 1000),
      constraints: {
        typed: typedLocks.length,
        text: textLocks.length,
        total: allLocks.length,
        by_type: byType,
      },
      monitoring: {
        metrics,
        entities,
        sse_clients: sseClients.size,
      },
      violations: (brain?.state?.violations || []).length,
      goal: brain?.goal?.text || "",
      api_version: "v2",
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ========================================
// SPEC COMPILER ENDPOINTS (v5.0)
// ========================================

app.post("/api/v2/compiler/compile", async (req, res) => {
  setCorsHeaders(res);
  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: "Rate limit exceeded", api_version: "v2" });
  }

  try {
    ensureInit(PROJECT_ROOT);
    const { text, autoApply } = req.body || {};
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Missing or invalid 'text' field", api_version: "v2" });
    }

    const result = autoApply
      ? await compileAndApply(PROJECT_ROOT, text)
      : await compileSpec(PROJECT_ROOT, text);

    if (!result.success) {
      return res.status(400).json({ error: result.error, api_version: "v2" });
    }

    return res.json({
      success: true,
      locks: result.locks,
      typedLocks: result.typedLocks,
      decisions: result.decisions,
      notes: result.notes,
      summary: result.summary || "",
      applied: result.applied || null,
      totalApplied: result.totalApplied || 0,
      api_version: "v2",
    });
  } catch (err) {
    return res.status(500).json({ error: err.message, api_version: "v2" });
  }
});

// ========================================
// CODE GRAPH ENDPOINTS (v5.0)
// ========================================

app.get("/api/v2/graph", (req, res) => {
  setCorsHeaders(res);

  try {
    ensureInit(PROJECT_ROOT);
    const graph = getOrBuildGraph(PROJECT_ROOT);
    return res.json({ ...graph, api_version: "v2" });
  } catch (err) {
    return res.status(500).json({ error: err.message, api_version: "v2" });
  }
});

app.post("/api/v2/graph/build", (req, res) => {
  setCorsHeaders(res);

  try {
    ensureInit(PROJECT_ROOT);
    const graph = buildGraph(PROJECT_ROOT, { force: true });
    return res.json({
      success: true,
      stats: graph.stats,
      builtAt: graph.builtAt,
      api_version: "v2",
    });
  } catch (err) {
    return res.status(500).json({ error: err.message, api_version: "v2" });
  }
});

app.get("/api/v2/graph/blast-radius", (req, res) => {
  setCorsHeaders(res);

  try {
    ensureInit(PROJECT_ROOT);
    const file = req.query?.file;
    if (!file) {
      return res.status(400).json({ error: "Missing 'file' query parameter", api_version: "v2" });
    }

    const result = getBlastRadius(PROJECT_ROOT, file);
    return res.json({ ...result, api_version: "v2" });
  } catch (err) {
    return res.status(500).json({ error: err.message, api_version: "v2" });
  }
});

app.get("/api/v2/graph/lock-map", (req, res) => {
  setCorsHeaders(res);

  try {
    ensureInit(PROJECT_ROOT);
    const mappings = mapLocksToFiles(PROJECT_ROOT);
    return res.json({ mappings, count: mappings.length, api_version: "v2" });
  } catch (err) {
    return res.status(500).json({ error: err.message, api_version: "v2" });
  }
});

// ========================================
// PATCH GATEWAY (v5.1)
// ========================================

app.post("/api/v2/gateway/review", async (req, res) => {
  setCorsHeaders(res);

  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: "Rate limit exceeded", api_version: "v2" });
  }

  const { description, files, useLLM } = req.body || {};
  if (!description || typeof description !== "string") {
    return res.status(400).json({ error: "Missing 'description' field (describe what the change does)", api_version: "v2" });
  }

  try {
    ensureInit(PROJECT_ROOT);
    const fileList = Array.isArray(files) ? files : [];
    const result = useLLM
      ? await reviewPatchAsync(PROJECT_ROOT, { description, files: fileList })
      : reviewPatch(PROJECT_ROOT, { description, files: fileList });

    return res.json({ ...result, api_version: "v2" });
  } catch (err) {
    return res.status(500).json({ error: err.message, api_version: "v2" });
  }
});

app.post("/api/v2/gateway/review-diff", async (req, res) => {
  setCorsHeaders(res);

  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: "Rate limit exceeded", api_version: "v2" });
  }

  const { description, files, diff, useLLM, options } = req.body || {};
  if (!description || typeof description !== "string") {
    return res.status(400).json({ error: "Missing 'description' field", api_version: "v2" });
  }
  if (!diff || typeof diff !== "string") {
    return res.status(400).json({ error: "Missing 'diff' field (provide git diff output)", api_version: "v2" });
  }

  try {
    ensureInit(PROJECT_ROOT);
    const fileList = Array.isArray(files) ? files : [];
    const result = useLLM
      ? await reviewPatchDiffAsync(PROJECT_ROOT, { description, files: fileList, diff, options })
      : reviewPatchUnified(PROJECT_ROOT, { description, files: fileList, diff, options });

    return res.json({ ...result, api_version: "v2" });
  } catch (err) {
    return res.status(500).json({ error: err.message, api_version: "v2" });
  }
});

app.post("/api/v2/gateway/parse-diff", (req, res) => {
  setCorsHeaders(res);

  const { diff } = req.body || {};
  if (!diff || typeof diff !== "string") {
    return res.status(400).json({ error: "Missing 'diff' field", api_version: "v2" });
  }

  try {
    const parsed = parseUnifiedDiff(diff);
    return res.json({ ...parsed, api_version: "v2" });
  } catch (err) {
    return res.status(500).json({ error: err.message, api_version: "v2" });
  }
});

// ========================================
// SSO ENDPOINTS (v3.5)
// ========================================

app.get("/auth/sso/login", (req, res) => {
  setCorsHeaders(res);
  if (!isSSOEnabled(PROJECT_ROOT)) {
    return res.status(400).json({ error: "SSO not configured." });
  }
  const result = getAuthorizationUrl(PROJECT_ROOT);
  if (!result.success) return res.status(400).json(result);
  res.redirect(result.url);
});

app.get("/auth/callback", async (req, res) => {
  setCorsHeaders(res);
  const { code, state, error } = req.query || {};
  if (error) return res.status(400).json({ error });
  if (!code || !state) return res.status(400).json({ error: "Missing code or state." });
  const result = await ssoHandleCallback(PROJECT_ROOT, code, state);
  if (!result.success) return res.status(401).json(result);
  res.json({ message: "SSO login successful", ...result });
});

app.get("/auth/sso/sessions", (req, res) => {
  setCorsHeaders(res);
  res.json(listSessions(PROJECT_ROOT));
});

app.post("/auth/sso/logout", (req, res) => {
  setCorsHeaders(res);
  const { sessionId } = req.body || {};
  res.json(revokeSession(PROJECT_ROOT, sessionId));
});

// ========================================

const PORT = parseInt(process.env.PORT || "3000", 10);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`SpecLock MCP HTTP Server v${VERSION} running on port ${PORT} — Developed by ${AUTHOR}`);
  console.log(`  Dashboard:    http://localhost:${PORT}/dashboard`);
  console.log(`  REST API v2:  http://localhost:${PORT}/api/v2/status`);
  console.log(`  SSE Stream:   http://localhost:${PORT}/api/v2/stream`);
});
