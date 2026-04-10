import os from "os";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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
  syncLocksToPackageJson,
  autoGuardRelatedFiles,
  listTemplates,
  applyTemplate,
  generateReport,
  auditStagedFiles,
  verifyAuditChain,
  exportCompliance,
  checkLimits,
  getLicenseInfo,
  enforceConflictCheck,
  setEnforcementMode,
  overrideLock,
  getOverrideHistory,
  getEnforcementConfig,
  semanticAudit,
  evaluatePolicy,
  listPolicyRules,
  addPolicyRule,
  removePolicyRule,
  initPolicy,
  exportPolicy,
  importPolicy,
  isTelemetryEnabled,
  getTelemetrySummary,
  trackToolUsage,
  addTypedLock,
  updateTypedLockThreshold,
  checkAllTypedConstraints,
  CONSTRAINT_TYPES,
  OPERATORS,
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
import { syncRules, getSyncFormats } from "../core/rules-sync.js";
import { getReplay, listSessions, formatReplay } from "../core/replay.js";
import { computeDriftScore, formatDriftScore } from "../core/drift-score.js";
import { computeCoverage, formatCoverage } from "../core/coverage.js";
import { analyzeLockStrength, formatStrength } from "../core/strengthen.js";
import { discoverRuleFiles, protect, formatProtectReport } from "../core/guardian.js";
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
} from "../core/auth.js";

// --- Auth via env var (v3.0) ---
function getAuthRole() {
  if (!isAuthEnabled(PROJECT_ROOT)) return "admin";
  const key = process.env.SPECLOCK_API_KEY;
  if (!key) return "admin"; // No key env var = local use, allow all
  const result = validateApiKey(PROJECT_ROOT, key);
  return result.valid ? result.role : null;
}

function requirePermission(toolName) {
  const role = getAuthRole();
  if (!role) return { allowed: false, error: "Invalid SPECLOCK_API_KEY." };
  if (!checkPermission(role, toolName)) {
    return { allowed: false, error: `Permission denied. Role "${role}" cannot access "${toolName}".` };
  }
  return { allowed: true, role };
}

// --- Project root resolution ---
function parseArgs(argv) {
  const args = { project: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--project" && argv[i + 1]) {
      args.project = argv[i + 1];
      i++;
    }
  }
  return args;
}

const args = parseArgs(process.argv);
const PROJECT_ROOT =
  args.project || process.env.SPECLOCK_PROJECT_ROOT || process.cwd();

// --- MCP Server ---
const VERSION = "5.5.5";
const AUTHOR = "Sandeep Roy";

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

// ========================================
// MEMORY MANAGEMENT TOOLS
// ========================================

// Tool 1: speclock_init
server.tool(
  "speclock_init",
  "Initialize SpecLock in the current project directory. Creates .speclock/ with brain.json, events.log, and supporting directories.",
  {},
  async () => {
    const brain = ensureInit(PROJECT_ROOT);
    return {
      content: [
        {
          type: "text",
          text: `SpecLock initialized for "${brain.project.name}" at ${brain.project.root}`,
        },
      ],
    };
  }
);

// Tool 2: speclock_get_context — THE KEY TOOL
server.tool(
  "speclock_get_context",
  "THE KEY TOOL. Returns the full structured context pack including goal, locks, decisions, recent changes, deploy facts, reverts, session history, and notes. Call this at the start of every session or whenever you need to refresh your understanding of the project.",
  {
    format: z
      .enum(["markdown", "json"])
      .optional()
      .default("markdown")
      .describe("Output format: markdown (readable) or json (structured)"),
  },
  async ({ format }) => {
    if (format === "json") {
      const pack = generateContextPack(PROJECT_ROOT);
      return {
        content: [{ type: "text", text: JSON.stringify(pack, null, 2) }],
      };
    }
    const md = generateContext(PROJECT_ROOT);
    return { content: [{ type: "text", text: md }] };
  }
);

// Tool 3: speclock_set_goal
server.tool(
  "speclock_set_goal",
  "Set or update the project goal. This is the high-level objective that guides all work.",
  {
    text: z.string().min(1).describe("The project goal text"),
  },
  async ({ text }) => {
    setGoal(PROJECT_ROOT, text);
    return {
      content: [{ type: "text", text: `Goal set: "${text}"` }],
    };
  }
);

// Tool 4: speclock_add_lock
server.tool(
  "speclock_add_lock",
  "Add a non-negotiable constraint (SpecLock). These are rules that must NEVER be violated during development.",
  {
    text: z.string().min(1).describe("The constraint text"),
    tags: z
      .array(z.string())
      .optional()
      .default([])
      .describe("Category tags"),
    source: z
      .enum(["user", "agent"])
      .optional()
      .default("agent")
      .describe("Who created this lock"),
  },
  async ({ text, tags, source }) => {
    const { lockId, rewritten, rewriteReason } = addLock(PROJECT_ROOT, text, tags, source);

    // Read the stored lock to get the normalized text
    const brain = readBrain(PROJECT_ROOT);
    const storedLock = brain?.specLock?.items?.find(l => l.id === lockId);
    const storedText = storedLock?.text || text;

    // Auto-guard related files
    const guardResult = autoGuardRelatedFiles(PROJECT_ROOT, storedText);
    const guardMsg = guardResult.guarded.length > 0
      ? `\nAuto-guarded ${guardResult.guarded.length} file(s): ${guardResult.guarded.join(", ")}`
      : "";

    // Sync active locks to package.json
    syncLocksToPackageJson(PROJECT_ROOT);

    // Report rewrite if it happened
    const rewriteMsg = rewritten
      ? `\n\nSmart Lock Authoring: Rewritten for accuracy.\n  Original: "${text}"\n  Stored as: "${storedText}"\n  Reason: ${rewriteReason}`
      : "";

    return {
      content: [
        { type: "text", text: `Lock added (${lockId}): "${storedText}"${guardMsg}${rewriteMsg}` },
      ],
    };
  }
);

// Tool 5: speclock_remove_lock
server.tool(
  "speclock_remove_lock",
  "Remove (deactivate) a SpecLock by its ID. The lock is soft-deleted and kept in history.",
  {
    lockId: z.string().min(1).describe("The lock ID to remove"),
  },
  async ({ lockId }) => {
    const result = removeLock(PROJECT_ROOT, lockId);
    if (!result.removed) {
      return {
        content: [{ type: "text", text: result.error }],
        isError: true,
      };
    }
    // Sync updated locks to package.json
    syncLocksToPackageJson(PROJECT_ROOT);
    return {
      content: [
        {
          type: "text",
          text: `Lock removed: "${result.lockText}"`,
        },
      ],
    };
  }
);

// Tool 6: speclock_add_decision
server.tool(
  "speclock_add_decision",
  "Record an architectural or design decision. Decisions guide future work and prevent contradictory changes.",
  {
    text: z.string().min(1).describe("The decision text"),
    tags: z.array(z.string()).optional().default([]),
    source: z
      .enum(["user", "agent"])
      .optional()
      .default("agent"),
  },
  async ({ text, tags, source }) => {
    const { decId } = addDecision(PROJECT_ROOT, text, tags, source);
    return {
      content: [
        { type: "text", text: `Decision recorded (${decId}): "${text}"` },
      ],
    };
  }
);

// Tool 7: speclock_add_note
server.tool(
  "speclock_add_note",
  "Add a pinned note for reference. Notes persist across sessions as reminders.",
  {
    text: z.string().min(1).describe("The note text"),
    pinned: z
      .boolean()
      .optional()
      .default(true)
      .describe("Whether to pin this note in context"),
  },
  async ({ text, pinned }) => {
    const { noteId } = addNote(PROJECT_ROOT, text, pinned);
    return {
      content: [
        { type: "text", text: `Note added (${noteId}): "${text}"` },
      ],
    };
  }
);

// Tool 8: speclock_set_deploy_facts
server.tool(
  "speclock_set_deploy_facts",
  "Record deployment configuration facts (provider, branch, auto-deploy settings).",
  {
    provider: z
      .string()
      .optional()
      .describe("Deploy provider (vercel, railway, aws, netlify, etc.)"),
    branch: z.string().optional().describe("Deploy branch"),
    autoDeploy: z
      .boolean()
      .optional()
      .describe("Whether auto-deploy is enabled"),
    url: z.string().optional().describe("Deployment URL"),
    notes: z.string().optional().describe("Additional deploy notes"),
  },
  async (params) => {
    updateDeployFacts(PROJECT_ROOT, params);
    return {
      content: [{ type: "text", text: "Deploy facts updated." }],
    };
  }
);

// ========================================
// CHANGE TRACKING TOOLS
// ========================================

// Tool 9: speclock_log_change
server.tool(
  "speclock_log_change",
  "Manually log a significant change. Use this when you make an important modification that should be tracked in the context.",
  {
    summary: z
      .string()
      .min(1)
      .describe("Brief description of the change"),
    files: z
      .array(z.string())
      .optional()
      .default([])
      .describe("Files affected"),
  },
  async ({ summary, files }) => {
    const { eventId } = logChange(PROJECT_ROOT, summary, files);
    return {
      content: [
        { type: "text", text: `Change logged (${eventId}): "${summary}"` },
      ],
    };
  }
);

// Tool 10: speclock_get_changes
server.tool(
  "speclock_get_changes",
  "Get recent file changes tracked by SpecLock.",
  {
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(20),
  },
  async ({ limit }) => {
    const brain = readBrain(PROJECT_ROOT);
    if (!brain) {
      return {
        content: [
          {
            type: "text",
            text: "SpecLock not initialized. Run speclock_init first.",
          },
        ],
        isError: true,
      };
    }
    const changes = brain.state.recentChanges.slice(0, limit);
    if (changes.length === 0) {
      return {
        content: [{ type: "text", text: "No changes tracked yet." }],
      };
    }
    const formatted = changes
      .map((ch) => {
        const files =
          ch.files && ch.files.length > 0
            ? ` (${ch.files.join(", ")})`
            : "";
        return `- [${ch.at.substring(0, 19)}] ${ch.summary}${files}`;
      })
      .join("\n");
    return {
      content: [
        { type: "text", text: `Recent changes (${changes.length}):\n${formatted}` },
      ],
    };
  }
);

// Tool 11: speclock_get_events
server.tool(
  "speclock_get_events",
  "Get the event log, optionally filtered by type. Event types: init, goal_updated, lock_added, lock_removed, decision_added, note_added, fact_updated, file_created, file_changed, file_deleted, revert_detected, context_generated, session_started, session_ended, manual_change, checkpoint_created.",
  {
    type: z.string().optional().describe("Filter by event type"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(200)
      .optional()
      .default(50),
    since: z
      .string()
      .optional()
      .describe("ISO timestamp; only return events after this time"),
  },
  async ({ type, limit, since }) => {
    const events = readEvents(PROJECT_ROOT, { type, limit, since });
    if (events.length === 0) {
      return {
        content: [{ type: "text", text: "No events found." }],
      };
    }
    const formatted = events
      .map(
        (e) =>
          `- [${e.at.substring(0, 19)}] ${e.type}: ${e.summary || ""}`
      )
      .join("\n");
    return {
      content: [
        {
          type: "text",
          text: `Events (${events.length}):\n${formatted}`,
        },
      ],
    };
  }
);

// ========================================
// CONTINUITY PROTECTION TOOLS
// ========================================

// Tool 12: speclock_check_conflict (v4.1: hybrid heuristic + Gemini LLM)
server.tool(
  "speclock_check_conflict",
  "Check if a proposed action conflicts with any active SpecLock. Uses fast heuristic + Gemini LLM for universal domain coverage. In hard enforcement mode, conflicts above the threshold will BLOCK the action (isError: true).",
  {
    proposedAction: z
      .string()
      .min(1)
      .describe("Description of the action you plan to take"),
  },
  async ({ proposedAction }) => {
    // Hybrid check: heuristic first, LLM for grey-zone (1-70%)
    let result = await checkConflictAsync(PROJECT_ROOT, proposedAction);

    // If async hybrid returned no conflict, also check enforcer for hard mode
    if (!result.hasConflict) {
      const enforced = enforceConflictCheck(PROJECT_ROOT, proposedAction);
      if (enforced.blocked) {
        return {
          content: [{ type: "text", text: enforced.analysis }],
          isError: true,
        };
      }
    }

    // In hard mode with blocking conflict, return isError: true
    if (result.blocked) {
      return {
        content: [{ type: "text", text: result.analysis }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text", text: result.analysis }],
    };
  }
);

// Tool 13: speclock_session_briefing
server.tool(
  "speclock_session_briefing",
  "Start a new session and get a full briefing. Returns context pack plus what happened since the last session. Call this at the very beginning of a new conversation.",
  {
    toolName: z
      .enum(["claude-code", "cursor", "codex", "windsurf", "cline", "unknown"])
      .optional()
      .default("unknown")
      .describe("Which AI tool is being used"),
  },
  async ({ toolName }) => {
    try {
      const briefing = getSessionBriefing(PROJECT_ROOT, toolName);
      const contextMd = generateContext(PROJECT_ROOT);

      const parts = [];

      // Session info
      parts.push(`# SpecLock Session Briefing`);
      parts.push(`Session started (${toolName}). ID: ${briefing.session?.id || "new"}`);
      parts.push("");

      // Last session summary
      if (briefing.lastSession) {
        parts.push("## Last Session");
        parts.push(`- Tool: **${briefing.lastSession.toolUsed || "unknown"}**`);
        parts.push(`- Ended: ${briefing.lastSession.endedAt || "unknown"}`);
        if (briefing.lastSession.summary)
          parts.push(`- Summary: ${briefing.lastSession.summary}`);
        parts.push(
          `- Events: ${briefing.lastSession.eventsInSession || 0}`
        );
        parts.push(
          `- Changes since then: ${briefing.changesSinceLastSession || 0}`
        );
        parts.push("");
      }

      // Warnings
      if (briefing.warnings?.length > 0) {
        parts.push("## Warnings");
        for (const w of briefing.warnings) {
          parts.push(`- ${w}`);
        }
        parts.push("");
      }

      // Full context
      parts.push("---");
      parts.push(contextMd);

      return {
        content: [{ type: "text", text: parts.join("\n") }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `# SpecLock Session Briefing\n\nError loading session: ${err.message}\n\nTry running speclock_init first.\n\n---\n*SpecLock v${VERSION}*` }],
      };
    }
  }
);

// Tool 14: speclock_session_summary
server.tool(
  "speclock_session_summary",
  "End the current session and record what was accomplished. Call this before ending a conversation.",
  {
    summary: z
      .string()
      .min(1)
      .describe("Summary of what was accomplished in this session"),
  },
  async ({ summary }) => {
    const result = endSession(PROJECT_ROOT, summary);
    if (!result.ended) {
      return {
        content: [{ type: "text", text: result.error }],
        isError: true,
      };
    }
    const session = result.session;
    const duration =
      session.startedAt && session.endedAt
        ? Math.round(
            (new Date(session.endedAt) - new Date(session.startedAt)) /
              60000
          )
        : 0;
    return {
      content: [
        {
          type: "text",
          text: `Session ended. Duration: ${duration} min. Events: ${session.eventsInSession}. Summary: "${summary}"`,
        },
      ],
    };
  }
);

// ========================================
// GIT INTEGRATION TOOLS
// ========================================

// Tool 15: speclock_checkpoint
server.tool(
  "speclock_checkpoint",
  "Create a named git tag checkpoint for easy rollback.",
  {
    name: z
      .string()
      .min(1)
      .describe("Checkpoint name (alphanumeric, hyphens, underscores)"),
  },
  async ({ name }) => {
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const tag = `sl_${safeName}_${Date.now()}`;
    const result = createTag(PROJECT_ROOT, tag);

    if (!result.ok) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to create checkpoint: ${result.error}`,
          },
        ],
        isError: true,
      };
    }

    // Record event
    const brain = readBrain(PROJECT_ROOT);
    if (brain) {
      const eventId = newId("evt");
      const event = {
        eventId,
        type: "checkpoint_created",
        at: nowIso(),
        files: [],
        summary: `Checkpoint: ${tag}`,
        patchPath: "",
      };
      bumpEvents(brain, eventId);
      appendEvent(PROJECT_ROOT, event);
      writeBrain(PROJECT_ROOT, brain);
    }

    return {
      content: [
        { type: "text", text: `Checkpoint created: ${tag}` },
      ],
    };
  }
);

// Tool 16: speclock_repo_status
server.tool(
  "speclock_repo_status",
  "Get current git repository status including branch, commit, changed files, and diff summary.",
  {},
  async () => {
    const status = captureStatus(PROJECT_ROOT);
    const diffSummary = getDiffSummary(PROJECT_ROOT);

    const lines = [
      `Branch: ${status.branch}`,
      `Commit: ${status.commit}`,
      "",
      `Changed files (${status.changedFiles.length}):`,
    ];

    if (status.changedFiles.length > 0) {
      for (const f of status.changedFiles) {
        lines.push(`  ${f.status} ${f.file}`);
      }
    } else {
      lines.push("  (clean working tree)");
    }

    if (diffSummary) {
      lines.push("");
      lines.push("Diff summary:");
      lines.push(diffSummary);
    }

    return {
      content: [{ type: "text", text: lines.join("\n") }],
    };
  }
);

// ========================================
// INTELLIGENCE TOOLS
// ========================================

// Tool 17: speclock_suggest_locks
server.tool(
  "speclock_suggest_locks",
  "Analyze project decisions, notes, and patterns to suggest new SpecLock constraints. Returns auto-generated lock suggestions based on commitment language, prohibitive patterns, and common best practices.",
  {},
  async () => {
    const result = suggestLocks(PROJECT_ROOT);

    if (result.suggestions.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No suggestions at this time. You have ${result.totalLocks} active lock(s). Add more decisions and notes to get AI-powered lock suggestions.`,
          },
        ],
      };
    }

    const formatted = result.suggestions
      .map(
        (s, i) =>
          `${i + 1}. **"${s.text}"**\n   Source: ${s.source}${s.sourceId ? ` (${s.sourceId})` : ""}\n   Reason: ${s.reason}`
      )
      .join("\n\n");

    return {
      content: [
        {
          type: "text",
          text: `## Lock Suggestions (${result.suggestions.length})\n\nCurrent active locks: ${result.totalLocks}\n\n${formatted}\n\nTo add any suggestion as a lock, call \`speclock_add_lock\` with the text.`,
        },
      ],
    };
  }
);

// Tool 18: speclock_detect_drift
server.tool(
  "speclock_detect_drift",
  "Scan recent changes and events against active SpecLock constraints to detect potential violations or drift. Use this proactively to ensure project integrity.",
  {},
  async () => {
    const result = detectDrift(PROJECT_ROOT);

    if (result.status === "no_locks") {
      return {
        content: [{ type: "text", text: result.message }],
      };
    }

    if (result.status === "clean") {
      return {
        content: [{ type: "text", text: result.message }],
      };
    }

    const formatted = result.drifts
      .map(
        (d) =>
          `- [${d.severity.toUpperCase()}] Change: "${d.changeSummary}" (${d.changeAt.substring(0, 19)})\n  Lock: "${d.lockText}"\n  Matched: ${d.matchedTerms.join(", ")}`
      )
      .join("\n\n");

    return {
      content: [
        {
          type: "text",
          text: `## Drift Report\n\n${result.message}\n\n${formatted}\n\nReview each drift and take corrective action if needed.`,
        },
      ],
    };
  }
);

// Tool 19: speclock_health
server.tool(
  "speclock_health",
  "Get a health check of the SpecLock setup including completeness score, missing recommended items, and multi-agent session timeline.",
  {},
  async () => {
    try {
      const brain = ensureInit(PROJECT_ROOT);
      const activeLocks = (brain.specLock?.items || []).filter((l) => l.active !== false);

      // Calculate health score
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

      return {
        content: [
          {
            type: "text",
            text: `## SpecLock Health Check\n\nScore: **${score}/100** (Grade: ${grade})\nEvents: ${evtCount} | Reverts: ${revertCount}\n\n### Checks\n${checks.join("\n")}${agentTimeline}\n\n---\n*SpecLock v${VERSION} — Developed by ${AUTHOR}*`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `## SpecLock Health Check\n\nError: ${err.message}\n\nTry running speclock_init first to initialize the project.\n\n---\n*SpecLock v${VERSION}*` }],
      };
    }
  }
);

// ========================================
// TEMPLATE, REPORT & AUDIT TOOLS (v1.7.0)
// ========================================

// Tool 20: speclock_apply_template
server.tool(
  "speclock_apply_template",
  "Apply a pre-built constraint template (e.g., nextjs, react, express, supabase, stripe, security-hardened). Templates add recommended locks and decisions for common frameworks.",
  {
    name: z
      .string()
      .optional()
      .describe("Template name to apply. Omit to list available templates."),
  },
  async ({ name }) => {
    if (!name) {
      const templates = listTemplates();
      const formatted = templates
        .map((t) => `- **${t.name}** (${t.displayName}): ${t.description} — ${t.lockCount} locks, ${t.decisionCount} decisions`)
        .join("\n");
      return {
        content: [
          {
            type: "text",
            text: `## Available Templates\n\n${formatted}\n\nCall again with a name to apply.`,
          },
        ],
      };
    }
    const result = applyTemplate(PROJECT_ROOT, name);
    if (!result.applied) {
      return {
        content: [{ type: "text", text: result.error }],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: "text",
          text: `Template "${result.displayName}" applied: ${result.locksAdded} lock(s) + ${result.decisionsAdded} decision(s) added.`,
        },
      ],
    };
  }
);

// Tool 21: speclock_report
server.tool(
  "speclock_report",
  "Get a violation report showing how many times SpecLock blocked constraint violations, which locks were tested most, and recent violations.",
  {},
  async () => {
    const report = generateReport(PROJECT_ROOT);

    const parts = [`## SpecLock Violation Report`, ``, `Total violations blocked: **${report.totalViolations}**`];

    if (report.timeRange) {
      parts.push(`Period: ${report.timeRange.from.substring(0, 10)} to ${report.timeRange.to.substring(0, 10)}`);
    }

    if (report.mostTestedLocks.length > 0) {
      parts.push("", "### Most Tested Locks");
      for (const lock of report.mostTestedLocks) {
        parts.push(`- ${lock.count}x — "${lock.text}"`);
      }
    }

    if (report.recentViolations.length > 0) {
      parts.push("", "### Recent Violations");
      for (const v of report.recentViolations) {
        parts.push(`- [${v.at.substring(0, 19)}] ${v.topLevel} (${v.topConfidence}%) — "${v.action}"`);
      }
    }

    parts.push("", `---`, report.summary);

    return {
      content: [{ type: "text", text: parts.join("\n") }],
    };
  }
);

// Tool 22: speclock_audit
server.tool(
  "speclock_audit",
  "Audit git staged files against active SpecLock constraints. Returns pass/fail with details on which files violate locks. Used by the pre-commit hook.",
  {},
  async () => {
    const result = auditStagedFiles(PROJECT_ROOT);

    if (result.passed) {
      return {
        content: [{ type: "text", text: result.message }],
      };
    }

    const formatted = result.violations
      .map((v) => `- [${v.severity}] **${v.file}** — ${v.reason}\n  Lock: "${v.lockText}"`)
      .join("\n");

    return {
      content: [
        {
          type: "text",
          text: `## Audit Failed\n\n${formatted}\n\n${result.message}`,
        },
      ],
    };
  }
);

// ========================================
// ENTERPRISE TOOLS (v2.1)
// ========================================

// Tool 23: speclock_verify_audit
server.tool(
  "speclock_verify_audit",
  "Verify the integrity of the HMAC audit chain. Detects tampering or corruption in the event log. Returns chain status, total events, and any broken links.",
  {},
  async () => {
    ensureInit(PROJECT_ROOT);
    const result = verifyAuditChain(PROJECT_ROOT);

    const status = result.valid ? "VALID" : "BROKEN";
    const parts = [
      `## Audit Chain Verification`,
      ``,
      `Status: **${status}**`,
      `Total events: ${result.totalEvents}`,
      `Hashed events: ${result.hashedEvents}`,
      `Legacy events (pre-v2.1): ${result.unhashedEvents}`,
    ];

    if (!result.valid && result.errors) {
      parts.push(``, `### Errors`);
      for (const err of result.errors) {
        parts.push(`- Line ${err.line}: ${err.error}${err.eventId ? ` (${err.eventId})` : ""}`);
      }
    }

    parts.push(``, result.message);
    parts.push(``, `Verified at: ${result.verifiedAt}`);

    return {
      content: [{ type: "text", text: parts.join("\n") }],
    };
  }
);

// Tool 24: speclock_export_compliance
server.tool(
  "speclock_export_compliance",
  "Generate compliance reports for enterprise auditing. Supports SOC 2 Type II, HIPAA, and CSV formats. Reports include constraint management, access logs, audit chain integrity, and violation history.",
  {
    format: z
      .enum(["soc2", "hipaa", "csv"])
      .describe("Export format: soc2 (JSON), hipaa (JSON), csv (spreadsheet)"),
  },
  async ({ format }) => {
    ensureInit(PROJECT_ROOT);
    const result = exportCompliance(PROJECT_ROOT, format);

    if (result.error) {
      return {
        content: [{ type: "text", text: result.error }],
        isError: true,
      };
    }

    if (format === "csv") {
      return {
        content: [{ type: "text", text: `## Compliance Export (CSV)\n\n\`\`\`csv\n${result.data}\n\`\`\`` }],
      };
    }

    return {
      content: [{ type: "text", text: `## Compliance Export (${format.toUpperCase()})\n\n\`\`\`json\n${JSON.stringify(result.data, null, 2)}\n\`\`\`` }],
    };
  }
);

// ========================================
// HARD ENFORCEMENT TOOLS (v2.5)
// ========================================

// Tool 25: speclock_set_enforcement
server.tool(
  "speclock_set_enforcement",
  "Set the enforcement mode for this project. 'advisory' (default) warns about conflicts. 'hard' blocks actions that violate locks above the confidence threshold — the AI cannot proceed.",
  {
    mode: z
      .enum(["advisory", "hard"])
      .describe("Enforcement mode: advisory (warn) or hard (block)"),
    blockThreshold: z
      .number()
      .int()
      .min(0)
      .max(100)
      .optional()
      .default(70)
      .describe("Minimum confidence % to block in hard mode (default: 70)"),
    allowOverride: z
      .boolean()
      .optional()
      .default(true)
      .describe("Whether lock overrides are permitted"),
  },
  async ({ mode, blockThreshold, allowOverride }) => {
    const result = setEnforcementMode(PROJECT_ROOT, mode, { blockThreshold, allowOverride });
    if (!result.success) {
      return {
        content: [{ type: "text", text: result.error }],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: "text",
          text: `Enforcement mode set to **${mode}**. Threshold: ${result.config.blockThreshold}%. Overrides: ${result.config.allowOverride ? "allowed" : "disabled"}.`,
        },
      ],
    };
  }
);

// Tool 26: speclock_override_lock
server.tool(
  "speclock_override_lock",
  "Override a lock for a specific action. Requires a reason which is logged to the audit trail. Use when a locked action must proceed with justification. Triggers escalation after repeated overrides.",
  {
    lockId: z.string().min(1).describe("The lock ID to override"),
    action: z.string().min(1).describe("The action that conflicts with the lock"),
    reason: z.string().min(1).describe("Justification for the override"),
  },
  async ({ lockId, action, reason }) => {
    const result = overrideLock(PROJECT_ROOT, lockId, action, reason);
    if (!result.success) {
      return {
        content: [{ type: "text", text: result.error }],
        isError: true,
      };
    }

    const parts = [
      `Lock overridden: "${result.lockText}"`,
      `Override count: ${result.overrideCount}`,
      `Reason: ${reason}`,
    ];

    if (result.escalated) {
      parts.push("", result.escalationMessage);
    }

    return {
      content: [{ type: "text", text: parts.join("\n") }],
    };
  }
);

// Tool 27: speclock_semantic_audit
server.tool(
  "speclock_semantic_audit",
  "Run semantic pre-commit audit. Parses the staged git diff, analyzes actual code changes against active locks using semantic analysis. Much more powerful than filename-only audit — catches violations in code content.",
  {},
  async () => {
    const result = semanticAudit(PROJECT_ROOT);

    if (result.passed) {
      return {
        content: [{ type: "text", text: result.message }],
      };
    }

    const formatted = result.violations
      .map((v) => {
        const lines = [`- [${v.level}] **${v.file}** (confidence: ${v.confidence}%)`];
        lines.push(`  Lock: "${v.lockText}"`);
        lines.push(`  Reason: ${v.reason}`);
        if (v.addedLines) lines.push(`  Changes: +${v.addedLines} / -${v.removedLines} lines`);
        return lines.join("\n");
      })
      .join("\n\n");

    return {
      content: [
        {
          type: "text",
          text: `## Semantic Audit Result\n\nMode: ${result.mode} | Threshold: ${result.threshold}%\n\n${formatted}\n\n${result.message}`,
        },
      ],
      isError: result.blocked || false,
    };
  }
);

// Tool 28: speclock_override_history
server.tool(
  "speclock_override_history",
  "Get the history of lock overrides. Shows which locks have been overridden, by whom, and the reasons given. Useful for audit review and identifying locks that may need updating.",
  {
    lockId: z
      .string()
      .optional()
      .describe("Filter by specific lock ID. Omit to see all overrides."),
  },
  async ({ lockId }) => {
    const result = getOverrideHistory(PROJECT_ROOT, lockId);

    if (result.total === 0) {
      return {
        content: [{ type: "text", text: "No overrides recorded." }],
      };
    }

    const formatted = result.overrides
      .map(
        (o) =>
          `- [${o.at.substring(0, 19)}] Lock: "${o.lockText}" (${o.lockId})\n  Action: ${o.action}\n  Reason: ${o.reason}`
      )
      .join("\n\n");

    return {
      content: [
        {
          type: "text",
          text: `## Override History (${result.total})\n\n${formatted}`,
        },
      ],
    };
  }
);

// ========================================
// POLICY-AS-CODE TOOLS (v3.5)
// ========================================

// Tool 29: speclock_policy_evaluate
server.tool(
  "speclock_policy_evaluate",
  "Evaluate policy-as-code rules against a proposed action. Returns violations for any matching rules. Use alongside speclock_check_conflict for comprehensive protection.",
  {
    description: z.string().min(1).describe("Description of the action to evaluate"),
    files: z.array(z.string()).optional().default([]).describe("Files affected by the action"),
    type: z.enum(["modify", "delete", "create", "export"]).optional().default("modify").describe("Action type"),
  },
  async ({ description, files, type }) => {
    const result = evaluatePolicy(PROJECT_ROOT, { description, text: description, files, type });

    if (result.passed) {
      return {
        content: [{ type: "text", text: `Policy check passed. ${result.rulesChecked} rule(s) evaluated, no violations.` }],
      };
    }

    const formatted = result.violations
      .map(v => `- [${v.severity.toUpperCase()}] **${v.ruleName}** (${v.enforce})\n  ${v.description}\n  Files: ${v.matchedFiles.join(", ") || "(pattern match)"}`)
      .join("\n\n");

    return {
      content: [{ type: "text", text: `## Policy Violations (${result.violations.length})\n\n${formatted}` }],
      isError: result.blocked,
    };
  }
);

// Tool 30: speclock_policy_manage
server.tool(
  "speclock_policy_manage",
  "Manage policy-as-code rules. Actions: list (show all rules), add (create new rule), remove (delete rule), init (create default policy), export (portable YAML).",
  {
    action: z.enum(["list", "add", "remove", "init", "export"]).describe("Policy action"),
    rule: z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      match: z.object({
        files: z.array(z.string()).optional(),
        actions: z.array(z.string()).optional(),
      }).optional(),
      enforce: z.enum(["block", "warn", "log"]).optional(),
      severity: z.enum(["critical", "high", "medium", "low"]).optional(),
      notify: z.array(z.string()).optional(),
    }).optional().describe("Rule definition (for add action)"),
    ruleId: z.string().optional().describe("Rule ID (for remove action)"),
  },
  async ({ action, rule, ruleId }) => {
    switch (action) {
      case "list": {
        const result = listPolicyRules(PROJECT_ROOT);
        if (result.total === 0) {
          return { content: [{ type: "text", text: "No policy rules defined. Use action 'init' to create a default policy." }] };
        }
        const formatted = result.rules.map(r =>
          `- **${r.name}** (${r.id}) [${r.enforce}/${r.severity}]\n  Files: ${(r.match?.files || []).join(", ")}\n  Actions: ${(r.match?.actions || []).join(", ")}`
        ).join("\n\n");
        return { content: [{ type: "text", text: `## Policy Rules (${result.active}/${result.total} active)\n\n${formatted}` }] };
      }
      case "add": {
        if (!rule || !rule.name) {
          return { content: [{ type: "text", text: "Rule name is required." }], isError: true };
        }
        const result = addPolicyRule(PROJECT_ROOT, rule);
        if (!result.success) return { content: [{ type: "text", text: result.error }], isError: true };
        return { content: [{ type: "text", text: `Policy rule added: "${result.rule.name}" (${result.ruleId}) [${result.rule.enforce}]` }] };
      }
      case "remove": {
        if (!ruleId) return { content: [{ type: "text", text: "ruleId is required." }], isError: true };
        const result = removePolicyRule(PROJECT_ROOT, ruleId);
        if (!result.success) return { content: [{ type: "text", text: result.error }], isError: true };
        return { content: [{ type: "text", text: `Policy rule removed: "${result.removed.name}"` }] };
      }
      case "init": {
        const result = initPolicy(PROJECT_ROOT);
        if (!result.success) return { content: [{ type: "text", text: result.error }], isError: true };
        return { content: [{ type: "text", text: "Policy-as-code initialized. Edit .speclock/policy.yml to add rules." }] };
      }
      case "export": {
        const result = exportPolicy(PROJECT_ROOT);
        if (!result.success) return { content: [{ type: "text", text: result.error }], isError: true };
        return { content: [{ type: "text", text: `## Exported Policy\n\n\`\`\`yaml\n${result.yaml}\`\`\`` }] };
      }
      default:
        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
    }
  }
);

// ========================================
// TELEMETRY TOOLS (v3.5)
// ========================================

// Tool 31: speclock_telemetry
server.tool(
  "speclock_telemetry",
  "Get telemetry and analytics summary. Shows tool usage counts, conflict rates, response times, and feature adoption. Opt-in only (SPECLOCK_TELEMETRY=true).",
  {},
  async () => {
    const summary = getTelemetrySummary(PROJECT_ROOT);
    if (!summary.enabled) {
      return { content: [{ type: "text", text: summary.message }] };
    }

    const parts = [
      `## Telemetry Summary`,
      ``,
      `Total API calls: **${summary.totalCalls}**`,
      `Avg response: **${summary.avgResponseMs}ms**`,
      `Sessions: **${summary.sessions.total}**`,
      ``,
      `### Conflicts`,
      `Total: ${summary.conflicts.total} | Blocked: ${summary.conflicts.blocked} | Advisory: ${summary.conflicts.advisory}`,
    ];

    if (summary.topTools.length > 0) {
      parts.push(``, `### Top Tools`);
      for (const t of summary.topTools.slice(0, 5)) {
        parts.push(`- ${t.name}: ${t.count} calls (avg ${t.avgMs}ms)`);
      }
    }

    if (summary.features.length > 0) {
      parts.push(``, `### Feature Adoption`);
      for (const f of summary.features) {
        parts.push(`- ${f.name}: ${f.count} uses`);
      }
    }

    return { content: [{ type: "text", text: parts.join("\n") }] };
  }
);

// ========================================
// TYPED CONSTRAINTS — Autonomous Systems Governance (v5.0)
// ========================================

// Tool 32: speclock_add_typed_lock
server.tool(
  "speclock_add_typed_lock",
  "Add a typed constraint lock for autonomous systems governance. Supports numerical (motor speed <= 3000 RPM), range (temperature between 20-80°C), state (forbidden transitions: EMERGENCY -> IDLE), and temporal (sensor interval <= 100ms) constraints. These are for real-time value/state checking in robotics, vehicles, trading, and medical systems.",
  {
    constraintType: z.enum(["numerical", "range", "state", "temporal"]).describe("Type of constraint"),
    metric: z.string().optional().describe("Metric name (for numerical/range/temporal). E.g., 'motor_speed', 'temperature', 'sensor_interval'"),
    operator: z.enum(["<", "<=", "==", "!=", ">=", ">"]).optional().describe("Comparison operator (for numerical/temporal)"),
    value: z.number().optional().describe("Threshold value (for numerical/temporal)"),
    min: z.number().optional().describe("Minimum value (for range)"),
    max: z.number().optional().describe("Maximum value (for range)"),
    unit: z.string().optional().describe("Unit of measurement. E.g., 'RPM', '°C', 'ms', 'km/h'"),
    entity: z.string().optional().describe("Entity name (for state). E.g., 'robot_arm', 'vehicle', 'trading_engine'"),
    forbidden: z.array(z.object({ from: z.string(), to: z.string() })).optional().describe("Forbidden state transitions (for state). E.g., [{ from: 'EMERGENCY', to: 'IDLE' }]"),
    requireApproval: z.boolean().optional().describe("Whether forbidden transitions require human approval (for state)"),
    description: z.string().optional().describe("Human-readable description (auto-generated if omitted)"),
    tags: z.array(z.string()).optional().describe("Category tags"),
    source: z.enum(["user", "agent"]).optional().describe("Who created this lock"),
  },
  async (params) => {
    const perm = requirePermission("speclock_add_typed_lock");
    if (!perm.allowed) return { content: [{ type: "text", text: perm.error }], isError: true };

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

    const result = addTypedLock(
      PROJECT_ROOT,
      constraint,
      params.tags || [],
      params.source || "user",
      params.description
    );

    if (result.error) {
      return { content: [{ type: "text", text: `Validation error: ${result.error}` }], isError: true };
    }

    return {
      content: [{
        type: "text",
        text: `Typed lock added (${params.constraintType}):\nID: ${result.lockId}\nDescription: ${result.brain.specLock.items[0].text}\n\nThis constraint will be checked against real-time values using speclock_check_typed.`,
      }],
    };
  }
);

// Tool 33: speclock_check_typed
server.tool(
  "speclock_check_typed",
  "Check a proposed value or state transition against typed constraints. For numerical/range/temporal: provide metric and value. For state: provide entity, from, and to. Returns CONFLICT if the proposed value violates any typed lock.",
  {
    metric: z.string().optional().describe("Metric to check (matches typed locks by metric name)"),
    entity: z.string().optional().describe("Entity to check (matches state locks by entity name)"),
    value: z.number().optional().describe("Proposed value (for numerical/range/temporal checks)"),
    from: z.string().optional().describe("Current state (for state transition checks)"),
    to: z.string().optional().describe("Target state (for state transition checks)"),
  },
  async (params) => {
    const perm = requirePermission("speclock_check_typed");
    if (!perm.allowed) return { content: [{ type: "text", text: perm.error }], isError: true };

    const brain = ensureInit(PROJECT_ROOT);
    const allLocks = brain.specLock?.items || [];

    const proposed = {
      ...(params.metric && { metric: params.metric }),
      ...(params.entity && { entity: params.entity }),
      ...(params.value !== undefined && { value: params.value }),
      ...(params.from && { from: params.from }),
      ...(params.to && { to: params.to }),
    };

    const result = checkAllTypedConstraints(allLocks, proposed);

    if (result.hasConflict) {
      // Check enforcement mode
      const enforcement = getEnforcementConfig(PROJECT_ROOT);
      const isHardMode = enforcement.mode === "hard";
      const topConfidence = result.conflictingLocks[0]?.confidence || 0;

      const text = [
        `CONSTRAINT VIOLATION DETECTED`,
        ``,
        result.analysis,
        ``,
        isHardMode && topConfidence >= enforcement.blockThreshold
          ? `BLOCKED — Hard enforcement mode active. This action cannot proceed.`
          : `Advisory — Review these violations before proceeding.`,
      ].join("\n");

      return {
        content: [{ type: "text", text }],
        isError: isHardMode && topConfidence >= enforcement.blockThreshold,
      };
    }

    return {
      content: [{ type: "text", text: result.analysis }],
    };
  }
);

// Tool 34: speclock_list_typed_locks
server.tool(
  "speclock_list_typed_locks",
  "List all typed constraints (numerical, range, state, temporal) with their current thresholds and parameters. Shows constraints used for autonomous systems governance.",
  {},
  async () => {
    const perm = requirePermission("speclock_list_typed_locks");
    if (!perm.allowed) return { content: [{ type: "text", text: perm.error }], isError: true };

    const brain = ensureInit(PROJECT_ROOT);
    const allLocks = brain.specLock?.items || [];
    const typedLocks = allLocks.filter(l => l.active !== false && l.constraintType);

    if (typedLocks.length === 0) {
      return {
        content: [{
          type: "text",
          text: `No typed constraints found. Use speclock_add_typed_lock to add numerical, range, state, or temporal constraints.\n\nTotal text locks: ${allLocks.filter(l => l.active !== false && !l.constraintType).length}`,
        }],
      };
    }

    const sections = {
      numerical: [],
      range: [],
      state: [],
      temporal: [],
    };

    for (const lock of typedLocks) {
      sections[lock.constraintType]?.push(lock);
    }

    const parts = [`## Typed Constraints (${typedLocks.length} total)`, ``];

    for (const [type, locks] of Object.entries(sections)) {
      if (locks.length === 0) continue;
      parts.push(`### ${type.charAt(0).toUpperCase() + type.slice(1)} (${locks.length})`);
      for (const l of locks) {
        parts.push(`- **${l.id}**: ${l.text}`);
        if (l.metric) parts.push(`  Metric: ${l.metric}`);
        if (l.entity) parts.push(`  Entity: ${l.entity}`);
        if (l.unit) parts.push(`  Unit: ${l.unit}`);
        if (l.tags?.length) parts.push(`  Tags: ${l.tags.join(", ")}`);
      }
      parts.push(``);
    }

    const textLockCount = allLocks.filter(l => l.active !== false && !l.constraintType).length;
    parts.push(`---`, `Text locks (semantic): ${textLockCount}`);

    return { content: [{ type: "text", text: parts.join("\n") }] };
  }
);

// Tool 35: speclock_update_threshold
server.tool(
  "speclock_update_threshold",
  "Update a typed lock's threshold value. For numerical/temporal: update value and/or operator. For range: update min and/or max. Changes are recorded in the audit trail.",
  {
    lockId: z.string().describe("The lock ID to update"),
    value: z.number().optional().describe("New threshold value (for numerical/temporal)"),
    operator: z.enum(["<", "<=", "==", "!=", ">=", ">"]).optional().describe("New operator (for numerical/temporal)"),
    min: z.number().optional().describe("New minimum (for range)"),
    max: z.number().optional().describe("New maximum (for range)"),
    forbidden: z.array(z.object({ from: z.string(), to: z.string() })).optional().describe("New forbidden transitions (for state)"),
  },
  async (params) => {
    const perm = requirePermission("speclock_update_threshold");
    if (!perm.allowed) return { content: [{ type: "text", text: perm.error }], isError: true };

    const updates = {};
    if (params.value !== undefined) updates.value = params.value;
    if (params.operator) updates.operator = params.operator;
    if (params.min !== undefined) updates.min = params.min;
    if (params.max !== undefined) updates.max = params.max;
    if (params.forbidden) updates.forbidden = params.forbidden;

    const result = updateTypedLockThreshold(PROJECT_ROOT, params.lockId, updates);

    if (result.error) {
      return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
    }

    return {
      content: [{
        type: "text",
        text: `Threshold updated for ${params.lockId}:\nOld: ${JSON.stringify(result.oldValues)}\nNew: ${JSON.stringify(result.newValues)}\nUpdated description: ${result.brain.specLock.items.find(l => l.id === params.lockId)?.text}`,
      }],
    };
  }
);

// --- Spec Compiler (v5.0) ---

server.tool(
  "speclock_compile_spec",
  "Compile natural language text (PRDs, READMEs, architecture docs, chat logs) into structured SpecLock constraints. Extracts text locks, typed locks (numerical/range/state/temporal), decisions, and notes. Set autoApply=true to automatically add extracted items to brain.json.",
  {
    text: z.string().describe("Natural language text to compile into constraints"),
    autoApply: z.boolean().optional().default(false).describe("If true, automatically apply extracted constraints to brain.json"),
  },
  async ({ text, autoApply }) => {
    const perm = requirePermission("speclock_compile_spec");
    if (!perm.allowed) return { content: [{ type: "text", text: perm.error }], isError: true };

    const result = autoApply
      ? await compileAndApply(PROJECT_ROOT, text)
      : await compileSpec(PROJECT_ROOT, text);

    if (!result.success) {
      return { content: [{ type: "text", text: `Compilation failed: ${result.error}` }], isError: true };
    }

    const lines = [
      `Spec Compiler Results:`,
      `  Text Locks: ${result.locks.length}`,
      `  Typed Locks: ${result.typedLocks.length}`,
      `  Decisions: ${result.decisions.length}`,
      `  Notes: ${result.notes.length}`,
    ];

    if (result.locks.length > 0) {
      lines.push(`\nExtracted Locks:`);
      result.locks.forEach((l, i) => lines.push(`  ${i + 1}. ${l.text} [${(l.tags || []).join(", ")}]`));
    }
    if (result.typedLocks.length > 0) {
      lines.push(`\nExtracted Typed Locks:`);
      result.typedLocks.forEach((tl, i) => lines.push(`  ${i + 1}. [${tl.constraintType}] ${tl.description || tl.metric}`));
    }
    if (result.decisions.length > 0) {
      lines.push(`\nExtracted Decisions:`);
      result.decisions.forEach((d, i) => lines.push(`  ${i + 1}. ${d.text}`));
    }
    if (result.notes.length > 0) {
      lines.push(`\nExtracted Notes:`);
      result.notes.forEach((n, i) => lines.push(`  ${i + 1}. ${n.text}`));
    }

    if (autoApply && result.applied) {
      lines.push(`\nApplied to brain.json: ${result.totalApplied} items (${result.applied.locks} locks, ${result.applied.typedLocks} typed, ${result.applied.decisions} decisions, ${result.applied.notes} notes)`);
    }

    if (result.summary) lines.push(`\nSummary: ${result.summary}`);

    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
);

// --- Code Graph (v5.0) ---

server.tool(
  "speclock_build_graph",
  "Build or refresh the code dependency graph. Scans JS/TS/Python source files, parses imports, and builds an adjacency graph. The graph is cached in .speclock/code-graph.json and auto-rebuilds when stale (>1 hour).",
  {},
  async () => {
    const perm = requirePermission("speclock_build_graph");
    if (!perm.allowed) return { content: [{ type: "text", text: perm.error }], isError: true };

    const graph = buildGraph(PROJECT_ROOT, { force: true });

    const lines = [
      `Code Graph Built:`,
      `  Total Files: ${graph.stats.totalFiles}`,
      `  Total Edges: ${graph.stats.totalEdges}`,
      `  Entry Points: ${graph.stats.entryPoints.length}`,
      `  Languages: ${Object.entries(graph.stats.languages).map(([k, v]) => `${k}(${v})`).join(", ")}`,
    ];

    if (graph.stats.entryPoints.length > 0) {
      lines.push(`\nEntry Points:`);
      graph.stats.entryPoints.slice(0, 10).forEach(ep => lines.push(`  - ${ep}`));
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
);

server.tool(
  "speclock_blast_radius",
  "Calculate the blast radius of changing a specific file. Shows direct and transitive dependents, depth, and impact percentage. Useful for understanding the risk of modifying a file.",
  {
    file: z.string().describe("Relative file path to analyze (e.g., 'src/core/memory.js')"),
  },
  async ({ file }) => {
    const perm = requirePermission("speclock_blast_radius");
    if (!perm.allowed) return { content: [{ type: "text", text: perm.error }], isError: true };

    const result = getBlastRadius(PROJECT_ROOT, file);

    if (!result.found) {
      return { content: [{ type: "text", text: `File not found in graph: ${file}\nTry running speclock_build_graph first.` }], isError: true };
    }

    const lines = [
      `Blast Radius for ${file}:`,
      `  Direct Dependents: ${result.directDependents.length}`,
      `  Transitive Dependents: ${result.transitiveDependents.length}`,
      `  Max Depth: ${result.depth}`,
      `  Impact: ${result.impactPercent}% (${result.blastRadius}/${result.totalFiles} files)`,
    ];

    if (result.directDependents.length > 0) {
      lines.push(`\nDirect Dependents:`);
      result.directDependents.forEach(f => lines.push(`  - ${f}`));
    }

    if (result.transitiveDependents.length > result.directDependents.length) {
      lines.push(`\nAll Affected Files:`);
      result.transitiveDependents.forEach(f => lines.push(`  - ${f}`));
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
);

server.tool(
  "speclock_map_locks",
  "Map all active locks to actual code files using the dependency graph. Shows which files each lock protects and the combined blast radius. Helps understand the structural impact of constraints.",
  {},
  async () => {
    const perm = requirePermission("speclock_map_locks");
    if (!perm.allowed) return { content: [{ type: "text", text: perm.error }], isError: true };

    const mappings = mapLocksToFiles(PROJECT_ROOT);

    if (mappings.length === 0) {
      return { content: [{ type: "text", text: "No active locks to map. Add locks first." }] };
    }

    const lines = [`Lock-to-File Mappings (${mappings.length} locks):\n`];

    for (const m of mappings) {
      lines.push(`Lock: "${m.lockText}"`);
      lines.push(`  ID: ${m.lockId}`);
      lines.push(`  Matched Files: ${m.matchedFiles.length}`);
      if (m.matchedFiles.length > 0) {
        m.matchedFiles.slice(0, 10).forEach(f => lines.push(`    - ${f}`));
        if (m.matchedFiles.length > 10) lines.push(`    ... and ${m.matchedFiles.length - 10} more`);
      }
      if (m.matchedModules.length > 0) {
        lines.push(`  Modules: ${m.matchedModules.join(", ")}`);
      }
      lines.push(`  Blast Radius: ${m.blastRadius} files`);
      lines.push("");
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
);

// --- Patch Gateway (v5.1) ---

server.tool(
  "speclock_review_patch",
  "Review a proposed code change and get an ALLOW/WARN/BLOCK verdict. Combines semantic conflict detection, lock-to-file mapping, blast radius analysis, and typed constraint awareness into a single risk assessment. The patch-time decision engine that gates every change.",
  {
    description: z.string().describe("What the change does (e.g. 'Add social login to auth page')"),
    files: z.array(z.string()).optional().default([]).describe("Files being changed (project-relative paths, e.g. ['src/auth/login.js'])"),
    useLLM: z.boolean().optional().default(false).describe("If true, uses LLM for enhanced conflict detection on ambiguous cases"),
  },
  async ({ description, files, useLLM }) => {
    const perm = requirePermission("speclock_review_patch");
    if (!perm.allowed) return { content: [{ type: "text", text: perm.error }], isError: true };

    const result = useLLM
      ? await reviewPatchAsync(PROJECT_ROOT, { description, files })
      : reviewPatch(PROJECT_ROOT, { description, files });

    if (result.verdict === "ERROR") {
      return { content: [{ type: "text", text: result.error }], isError: true };
    }

    const lines = [
      `Patch Gateway Verdict: ${result.verdict}`,
      `Risk Score: ${result.riskScore}/100`,
      `Source: ${result.source || "heuristic"}`,
      `Active Locks: ${result.lockCount}`,
      `Files Reviewed: ${result.fileCount}`,
      ``,
      result.summary,
    ];

    if (result.reasons.length > 0) {
      lines.push(``, `Reasons:`);
      for (const r of result.reasons) {
        const icon = r.severity === "block" ? "BLOCK" : r.severity === "warn" ? "WARN" : "INFO";
        lines.push(`  [${icon}] ${r.type}: "${r.lockText || r.details?.[0] || ""}" (confidence: ${r.confidence}%)`);
        if (r.details && r.details.length > 0) {
          r.details.forEach(d => lines.push(`    - ${d}`));
        }
      }
    }

    if (result.blastRadius) {
      lines.push(``, `Blast Radius:`);
      for (const b of result.blastRadius.files) {
        lines.push(`  ${b.file}: ${b.transitiveDependents} dependents (${b.impactPercent.toFixed(1)}% impact)`);
      }
    }

    if (result.lockFileOverlaps) {
      lines.push(``, `Lock-File Overlaps:`);
      for (const o of result.lockFileOverlaps) {
        lines.push(`  Lock: "${o.lockText}" → Files: ${o.overlappingFiles.join(", ")}`);
      }
    }

    return {
      content: [{ type: "text", text: lines.join("\n") }],
      isError: result.verdict === "BLOCK",
    };
  }
);

// --- Diff-Native Patch Review (v5.2) ---

server.tool(
  "speclock_review_patch_diff",
  "Review a code change using actual diff content (git diff output). Analyzes interface breaks, protected symbol edits, dependency drift, schema changes, and public API impact. Returns ALLOW/WARN/BLOCK with per-signal scoring. When diff is provided, runs unified review (intent + diff merged, 35/65 weight).",
  {
    description: z.string().describe("What the change does"),
    files: z.array(z.string()).optional().default([]).describe("Files being changed"),
    diff: z.string().describe("Raw unified diff (git diff output)"),
    useLLM: z.boolean().optional().default(false).describe("Use LLM for enhanced detection"),
    options: z.object({
      includeSymbolAnalysis: z.boolean().optional().default(true),
      includeDependencyAnalysis: z.boolean().optional().default(true),
      includeSchemaAnalysis: z.boolean().optional().default(true),
      includeApiAnalysis: z.boolean().optional().default(true),
    }).optional().default({}),
  },
  async ({ description, files, diff, useLLM, options }) => {
    const perm = requirePermission("speclock_review_patch_diff");
    if (!perm.allowed) return { content: [{ type: "text", text: perm.error }], isError: true };

    const result = useLLM
      ? await reviewPatchDiffAsync(PROJECT_ROOT, { description, files, diff, options })
      : reviewPatchUnified(PROJECT_ROOT, { description, files, diff, options });

    if (result.verdict === "ERROR") {
      return { content: [{ type: "text", text: result.error }], isError: true };
    }

    const lines = [
      `Patch Review Verdict: ${result.verdict}`,
      `Risk Score: ${result.riskScore}/100`,
      `Review Mode: ${result.reviewMode}`,
      `Source: ${result.source || "diff-native"}`,
      ``,
      result.summary,
    ];

    if (result.intentVerdict) {
      lines.push(``, `Layer Breakdown:`, `  Intent: ${result.intentVerdict} (${result.intentRisk}/100)`, `  Diff: ${result.diffVerdict} (${result.diffRisk}/100)`);
    }

    if (result.parsedDiff) {
      lines.push(``, `Diff Stats:`, `  Files: ${result.parsedDiff.filesChanged}`, `  Additions: +${result.parsedDiff.additions}`, `  Deletions: -${result.parsedDiff.deletions}`, `  Hunks: ${result.parsedDiff.hunks}`);
    }

    if (result.signals) {
      const activeSignals = Object.entries(result.signals).filter(([_, s]) => s.score > 0);
      if (activeSignals.length > 0) {
        lines.push(``, `Active Signals:`);
        for (const [name, sig] of activeSignals) {
          lines.push(`  ${name}: ${sig.score} pts`);
        }
      }
    }

    if (result.reasons && result.reasons.length > 0) {
      lines.push(``, `Reasons:`);
      for (const r of result.reasons) {
        const icon = r.severity === "critical" ? "CRITICAL" : r.severity === "high" ? "HIGH" : r.severity === "medium" ? "MEDIUM" : "LOW";
        lines.push(`  [${icon}] ${r.type}: ${r.message} (conf: ${typeof r.confidence === "number" ? (r.confidence > 1 ? r.confidence + "%" : Math.round(r.confidence * 100) + "%") : "N/A"})`);
      }
    }

    if (result.recommendation) {
      lines.push(``, `Recommendation: ${result.recommendation.action}`, `  ${result.recommendation.why}`);
    }

    return {
      content: [{ type: "text", text: lines.join("\n") }],
      isError: result.verdict === "BLOCK",
    };
  }
);

server.tool(
  "speclock_parse_diff",
  "Parse a raw unified diff into structured changes. Shows imports added/removed, exports changed, symbols touched, route changes, and schema file detection. Useful for debugging, observability, and inspecting what SpecLock thinks changed.",
  {
    diff: z.string().describe("Raw unified diff (git diff output)"),
  },
  async ({ diff }) => {
    const parsed = parseUnifiedDiff(diff);

    const lines = [
      `Parsed Diff:`,
      `  Files Changed: ${parsed.stats.filesChanged}`,
      `  Additions: +${parsed.stats.additions}`,
      `  Deletions: -${parsed.stats.deletions}`,
      `  Hunks: ${parsed.stats.hunks}`,
    ];

    for (const file of parsed.files) {
      lines.push(``, `File: ${file.path} (${file.language})`);
      lines.push(`  +${file.additions} / -${file.deletions}`);
      if (file.importsAdded.length > 0) lines.push(`  Imports Added: ${file.importsAdded.join(", ")}`);
      if (file.importsRemoved.length > 0) lines.push(`  Imports Removed: ${file.importsRemoved.join(", ")}`);
      if (file.exportsAdded.length > 0) lines.push(`  Exports Added: ${file.exportsAdded.map(e => e.symbol).join(", ")}`);
      if (file.exportsRemoved.length > 0) lines.push(`  Exports Removed: ${file.exportsRemoved.map(e => e.symbol).join(", ")}`);
      if (file.exportsModified.length > 0) lines.push(`  Exports Modified: ${file.exportsModified.map(e => e.symbol).join(", ")}`);
      if (file.symbolsTouched.length > 0) lines.push(`  Symbols Touched: ${file.symbolsTouched.map(s => `${s.symbol} (${s.changeType})`).join(", ")}`);
      if (file.routeChanges.length > 0) lines.push(`  Route Changes: ${file.routeChanges.map(r => `${r.method} ${r.path} [${r.changeType}]`).join(", ")}`);
      if (file.isSchemaFile) lines.push(`  ** Schema/Migration File **`);
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
);

// --- Universal Rules Sync (v5.3) ---

// Tool 36: speclock_sync_rules
server.tool(
  "speclock_sync_rules",
  "Sync SpecLock constraints to AI tool rules files. Generates .cursorrules, CLAUDE.md, AGENTS.md, .windsurfrules, copilot-instructions.md, GEMINI.md, and .aider.conf.yml from your SpecLock constraints. One source of truth for all AI tools. Use --format for a specific tool, or sync all at once.",
  {
    format: z.enum(["cursor", "claude", "agents", "windsurf", "copilot", "gemini", "codex", "aider", "all"]).optional().default("all").describe("Target format. 'all' syncs to every supported AI tool."),
    dryRun: z.boolean().optional().default(false).describe("Preview output without writing files"),
    append: z.boolean().optional().default(false).describe("Append to existing CLAUDE.md instead of overwriting (only for claude format)"),
  },
  async ({ format, dryRun, append }) => {
    const options = { dryRun };
    if (format && format !== "all") options.format = format;
    if (append) options.append = true;

    const result = syncRules(PROJECT_ROOT, options);

    if (result.errors.length > 0 && result.synced.length === 0) {
      return { content: [{ type: "text", text: `Sync failed: ${result.errors.join(", ")}` }], isError: true };
    }

    const lines = [
      `## Rules Sync ${dryRun ? "(Preview)" : "Complete"}`,
      ``,
      `Constraints synced: ${result.lockCount} lock(s), ${result.decisionCount || 0} decision(s)`,
      ``,
    ];

    for (const s of result.synced) {
      if (dryRun && s.content) {
        lines.push(`### ${s.name} → ${s.file}`);
        lines.push("```");
        lines.push(s.content);
        lines.push("```");
        lines.push("");
      } else {
        lines.push(`- **${s.name}** → \`${s.file}\` (${s.size} bytes)`);
      }
    }

    if (!dryRun && result.synced.length > 0) {
      lines.push(``, `${result.synced.length} file(s) written. Your AI tools will now see SpecLock constraints.`);
      lines.push(``, `Tip: Commit these files to git so they're always in sync.`);
    }

    if (result.errors.length > 0) {
      lines.push(``, `Warnings: ${result.errors.join(", ")}`);
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
);

// Tool 37: speclock_replay
server.tool(
  "speclock_replay",
  "Replay a session's activity log — shows exactly what AI agents tried and what SpecLock caught. Returns chronological event list with ALLOW/WARN/BLOCK verdicts, changes logged, locks added/removed, and session stats. Like a flight recorder for your AI coding sessions.",
  {
    sessionId: z.string().optional().describe("Specific session ID to replay. Omit to replay most recent session."),
    limit: z.number().optional().default(50).describe("Max events to return"),
  },
  async ({ sessionId, limit }) => {
    const replay = getReplay(PROJECT_ROOT, { sessionId, limit });

    if (!replay.found) {
      return { content: [{ type: "text", text: replay.error }], isError: true };
    }

    const formatted = formatReplay(replay);
    return { content: [{ type: "text", text: `## Incident Replay\n\n\`\`\`\n${formatted}\n\`\`\`` }] };
  }
);

// Tool 38: speclock_list_sessions
server.tool(
  "speclock_list_sessions",
  "List available sessions for replay. Shows session IDs, tools used, timestamps, and event counts.",
  {
    limit: z.number().optional().default(10).describe("Max sessions to list"),
  },
  async ({ limit }) => {
    const result = listSessions(PROJECT_ROOT, limit);

    if (result.sessions.length === 0) {
      return { content: [{ type: "text", text: "No sessions recorded yet." }] };
    }

    const lines = [`## Sessions (${result.total} total)`, ""];
    for (const s of result.sessions) {
      const current = s.isCurrent ? " **[ACTIVE]**" : "";
      lines.push(`- **${s.id}** — ${s.tool} — ${s.startedAt.substring(0, 16)} — ${s.events} events${current}`);
      if (s.summary && s.summary !== "(no summary)") {
        lines.push(`  _${s.summary.substring(0, 80)}_`);
      }
    }
    lines.push("", "Use `speclock_replay` with a session ID to see full activity log.");

    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
);

// Tool 39: speclock_drift_score
server.tool(
  "speclock_drift_score",
  "Compute a 0-100 Drift Score measuring how much the project has drifted from the founder's original intent. Analyzes violations, overrides, reverts, lock churn, goal stability, and session gaps. Returns score, grade, trend, signal breakdown, and per-session impact. Only SpecLock can compute this because only SpecLock knows what was INTENDED vs what was DONE.",
  {
    days: z.number().optional().default(30).describe("Look back N days (default: 30)"),
  },
  async ({ days }) => {
    const result = computeDriftScore(PROJECT_ROOT, { days });
    const formatted = formatDriftScore(result);
    return { content: [{ type: "text", text: `## Drift Score\n\n\`\`\`\n${formatted}\n\`\`\`` }] };
  }
);

// Tool 40: speclock_coverage
server.tool(
  "speclock_coverage",
  "Lock Coverage Audit — scans the codebase for high-risk patterns (auth, payments, database, secrets, API routes, security, error handling, logging) and identifies areas with no lock protecting them. Auto-suggests the missing locks you need. Like a security scanner but for AI constraint gaps.",
  {},
  async () => {
    const result = computeCoverage(PROJECT_ROOT);
    const formatted = formatCoverage(result);
    return { content: [{ type: "text", text: `## Lock Coverage Audit\n\n\`\`\`\n${formatted}\n\`\`\`` }] };
  }
);

// Tool 41: speclock_strengthen
server.tool(
  "speclock_strengthen",
  "Lock Strengthener — grades each lock's specificity, scope, and detection power (0-100). Identifies weak locks and suggests stronger versions that catch more violations. Checks for: vagueness, missing enforcement verbs, no scope, no consequence, ambiguous language, missing euphemism guards.",
  {},
  async () => {
    const result = analyzeLockStrength(PROJECT_ROOT);
    const formatted = formatStrength(result);
    return { content: [{ type: "text", text: `## Lock Strength Analysis\n\n\`\`\`\n${formatted}\n\`\`\`` }] };
  }
);

// Tool 42: speclock_list_sync_formats
server.tool(
  "speclock_list_sync_formats",
  "List all available AI tool formats that SpecLock can sync constraints to. Shows format key, tool name, output file path, and description.",
  {},
  async () => {
    const formats = getSyncFormats();
    const lines = [
      `## Available Sync Formats`,
      ``,
      `| Format | Tool | Output File | Description |`,
      `|--------|------|-------------|-------------|`,
    ];

    for (const f of formats) {
      lines.push(`| ${f.key} | ${f.name} | \`${f.file}\` | ${f.description} |`);
    }

    lines.push(``);
    lines.push(`Use \`speclock_sync_rules\` with a specific format or "all" to sync.`);

    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
);

// Tool 43: speclock_protect
server.tool(
  "speclock_protect",
  "Zero-config Guardian Mode — Reads existing AI rule files (.cursorrules, CLAUDE.md, AGENTS.md, copilot-instructions.md, etc.), auto-extracts enforceable constraints, installs pre-commit hook, and syncs rules to all AI tools. One command, no flags. Makes your AI rules unbreakable.",
  {
    skipHook: { type: "boolean", description: "Skip pre-commit hook installation", default: false },
    skipSync: { type: "boolean", description: "Skip syncing rules to all formats", default: false },
  },
  async ({ skipHook, skipSync }) => {
    const report = protect(PROJECT_ROOT, { skipHook, skipSync });
    const formatted = formatProtectReport(report);
    return { content: [{ type: "text", text: formatted }] };
  }
);

// Tool 44: speclock_discover_rules
server.tool(
  "speclock_discover_rules",
  "Discover all AI rule files in the project (.cursorrules, CLAUDE.md, AGENTS.md, copilot-instructions.md, .windsurfrules, GEMINI.md, .aider.conf.yml). Shows which tools have rules configured and their sizes. Use this to see what rules exist before running speclock_protect.",
  {},
  async () => {
    const files = discoverRuleFiles(PROJECT_ROOT);
    if (files.length === 0) {
      return { content: [{ type: "text", text: "No AI rule files found in this project. Create a .cursorrules, CLAUDE.md, or AGENTS.md file first." }] };
    }
    const lines = [
      `## AI Rule Files Found`,
      ``,
      `| File | Tool | Lines | Size |`,
      `|------|------|-------|------|`,
    ];
    for (const f of files) {
      lines.push(`| \`${f.file}\` | ${f.tool} | ${f.lines} | ${f.size} bytes |`);
    }
    lines.push(``);
    lines.push(`Run \`speclock_protect\` to extract constraints and make them enforceable.`);
    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
);

// --- Smithery sandbox export ---
export default function createSandboxServer() {
  return server;
}

// --- Start server (skip when bundled as CJS for Smithery scanning) ---
const isScanMode = typeof import.meta.url === "undefined";

if (!isScanMode) {
  const transport = new StdioServerTransport();
  server.connect(transport).then(() => {
    process.stderr.write(
      `SpecLock MCP v${VERSION} running (stdio) — Developed by ${AUTHOR}. Root: ${PROJECT_ROOT}${os.EOL}`
    );
  }).catch((err) => {
    process.stderr.write(`SpecLock fatal: ${err.message}${os.EOL}`);
    process.exit(1);
  });
}
