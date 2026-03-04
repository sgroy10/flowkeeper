import fs from "fs";
import path from "path";
import {
  nowIso,
  ensureSpeclockDirs,
  speclockDir,
  newId,
  readBrain,
  writeBrain,
  appendEvent,
  makeBrain,
  bumpEvents,
  addRecentChange,
  addRevert,
  readEvents,
  addViolation,
} from "./storage.js";
import { hasGit, getHead, getDefaultBranch, captureDiff, getStagedFiles } from "./git.js";
import { getTemplateNames, getTemplate } from "./templates.js";
import { analyzeConflict } from "./semantics.js";

// --- Internal helpers ---

function recordEvent(root, brain, event) {
  bumpEvents(brain, event.eventId);
  appendEvent(root, event);
  writeBrain(root, brain);
}

function writePatch(root, eventId, content) {
  const patchPath = path.join(
    speclockDir(root),
    "patches",
    `${eventId}.patch`
  );
  fs.writeFileSync(patchPath, content);
  return path.join(".speclock", "patches", `${eventId}.patch`);
}

// --- Core functions (ported + extended) ---

export function ensureInit(root) {
  ensureSpeclockDirs(root);
  let brain = readBrain(root);
  if (!brain) {
    const gitExists = hasGit(root);
    const defaultBranch = gitExists ? getDefaultBranch(root) : "";
    brain = makeBrain(root, gitExists, defaultBranch);
    if (gitExists) {
      const head = getHead(root);
      brain.state.head.gitBranch = head.gitBranch;
      brain.state.head.gitCommit = head.gitCommit;
      brain.state.head.capturedAt = nowIso();
    }
    const eventId = newId("evt");
    const event = {
      eventId,
      type: "init",
      at: nowIso(),
      files: [],
      summary: "Initialized SpecLock",
      patchPath: "",
    };
    bumpEvents(brain, eventId);
    appendEvent(root, event);
    writeBrain(root, brain);
  }
  return brain;
}

export function setGoal(root, text) {
  const brain = ensureInit(root);
  brain.goal.text = text;
  brain.goal.updatedAt = nowIso();
  const eventId = newId("evt");
  const event = {
    eventId,
    type: "goal_updated",
    at: nowIso(),
    files: [],
    summary: `Goal set: ${text.substring(0, 80)}`,
    patchPath: "",
  };
  recordEvent(root, brain, event);
  return brain;
}

export function addLock(root, text, tags, source) {
  const brain = ensureInit(root);
  const lockId = newId("lock");
  brain.specLock.items.unshift({
    id: lockId,
    text,
    createdAt: nowIso(),
    source: source || "user",
    tags: tags || [],
    active: true,
  });
  const eventId = newId("evt");
  const event = {
    eventId,
    type: "lock_added",
    at: nowIso(),
    files: [],
    summary: `Lock added: ${text.substring(0, 80)}`,
    patchPath: "",
  };
  recordEvent(root, brain, event);
  return { brain, lockId };
}

export function removeLock(root, lockId) {
  const brain = ensureInit(root);
  const lock = brain.specLock.items.find((l) => l.id === lockId);
  if (!lock) {
    return { brain, removed: false, error: `Lock not found: ${lockId}` };
  }
  lock.active = false;
  const eventId = newId("evt");
  const event = {
    eventId,
    type: "lock_removed",
    at: nowIso(),
    files: [],
    summary: `Lock removed: ${lock.text.substring(0, 80)}`,
    patchPath: "",
  };
  recordEvent(root, brain, event);
  return { brain, removed: true, lockText: lock.text };
}

export function addDecision(root, text, tags, source) {
  const brain = ensureInit(root);
  const decId = newId("dec");
  brain.decisions.unshift({
    id: decId,
    text,
    createdAt: nowIso(),
    source: source || "user",
    tags: tags || [],
  });
  const eventId = newId("evt");
  const event = {
    eventId,
    type: "decision_added",
    at: nowIso(),
    files: [],
    summary: `Decision: ${text.substring(0, 80)}`,
    patchPath: "",
  };
  recordEvent(root, brain, event);
  return { brain, decId };
}

export function addNote(root, text, pinned = true) {
  const brain = ensureInit(root);
  const noteId = newId("note");
  brain.notes.unshift({
    id: noteId,
    text,
    createdAt: nowIso(),
    pinned,
  });
  const eventId = newId("evt");
  const event = {
    eventId,
    type: "note_added",
    at: nowIso(),
    files: [],
    summary: `Note: ${text.substring(0, 80)}`,
    patchPath: "",
  };
  recordEvent(root, brain, event);
  return { brain, noteId };
}

export function updateDeployFacts(root, payload) {
  const brain = ensureInit(root);
  const deploy = brain.facts.deploy;
  if (payload.provider !== undefined) deploy.provider = payload.provider;
  if (typeof payload.autoDeploy === "boolean")
    deploy.autoDeploy = payload.autoDeploy;
  if (payload.branch !== undefined) deploy.branch = payload.branch;
  if (payload.url !== undefined) deploy.url = payload.url;
  if (payload.notes !== undefined) deploy.notes = payload.notes;
  const eventId = newId("evt");
  const event = {
    eventId,
    type: "fact_updated",
    at: nowIso(),
    files: [],
    summary: "Updated deploy facts",
    patchPath: "",
  };
  recordEvent(root, brain, event);
  return brain;
}

export function logChange(root, summary, files = []) {
  const brain = ensureInit(root);
  const eventId = newId("evt");
  let patchPath = "";
  if (brain.facts.repo.hasGit) {
    const diff = captureDiff(root);
    if (diff && diff.trim().length > 0) {
      patchPath = writePatch(root, eventId, diff);
    }
  }
  const event = {
    eventId,
    type: "manual_change",
    at: nowIso(),
    files,
    summary,
    patchPath,
  };
  addRecentChange(brain, {
    eventId,
    summary,
    files,
    at: event.at,
  });
  recordEvent(root, brain, event);
  return { brain, eventId };
}

export function handleFileEvent(root, brain, type, filePath) {
  const eventId = newId("evt");
  const rel = path.relative(root, filePath);
  let patchPath = "";
  if (brain.facts.repo.hasGit) {
    const diff = captureDiff(root);
    const patchContent =
      diff && diff.trim().length > 0 ? diff : "(no diff available)";
    patchPath = writePatch(root, eventId, patchContent);
  }
  const summary = `${type.replace("_", " ")}: ${rel}`;
  const event = {
    eventId,
    type,
    at: nowIso(),
    files: [rel],
    summary,
    patchPath,
  };
  addRecentChange(brain, {
    eventId,
    summary,
    files: [rel],
    at: event.at,
  });
  recordEvent(root, brain, event);
}

// --- Legacy synonym groups (deprecated — kept for backward compatibility) ---
// @deprecated Use analyzeConflict() from semantics.js instead
const SYNONYM_GROUPS = [
  ["remove", "delete", "drop", "eliminate", "destroy", "kill", "purge", "wipe"],
  ["add", "create", "introduce", "insert", "new"],
  ["change", "modify", "alter", "update", "mutate", "transform", "rewrite"],
  ["break", "breaking", "incompatible", "destabilize"],
  ["public", "external", "exposed", "user-facing", "client-facing"],
  ["private", "internal", "hidden", "encapsulated"],
  ["database", "db", "schema", "table", "migration", "sql"],
  ["api", "endpoint", "route", "rest", "graphql"],
  ["test", "testing", "spec", "coverage", "assertion"],
  ["deploy", "deployment", "release", "ship", "publish", "production"],
  ["security", "auth", "authentication", "authorization", "token", "credential"],
  ["dependency", "package", "library", "module", "import"],
  ["refactor", "restructure", "reorganize", "cleanup"],
  ["disable", "deactivate", "turn-off", "switch-off"],
  ["enable", "activate", "turn-on", "switch-on"],
];

// @deprecated
const NEGATION_WORDS = ["no", "not", "never", "without", "dont", "don't", "cannot", "can't", "shouldn't", "mustn't", "avoid", "prevent", "prohibit", "forbid", "disallow"];

// @deprecated
const DESTRUCTIVE_WORDS = ["remove", "delete", "drop", "destroy", "kill", "purge", "wipe", "break", "disable", "revert", "rollback", "undo"];

// @deprecated — use analyzeConflict() from semantics.js
function expandWithSynonyms(words) {
  const expanded = new Set(words);
  for (const word of words) {
    for (const group of SYNONYM_GROUPS) {
      if (group.includes(word)) {
        for (const syn of group) expanded.add(syn);
      }
    }
  }
  return [...expanded];
}

// @deprecated
function hasNegation(text) {
  const lower = text.toLowerCase();
  return NEGATION_WORDS.some((neg) => lower.includes(neg));
}

// @deprecated
function isDestructiveAction(text) {
  const lower = text.toLowerCase();
  return DESTRUCTIVE_WORDS.some((w) => lower.includes(w));
}

// Check if a proposed action conflicts with any active SpecLock
// v2: Uses the semantic analysis engine from semantics.js
export function checkConflict(root, proposedAction) {
  const brain = ensureInit(root);
  const activeLocks = brain.specLock.items.filter((l) => l.active !== false);
  if (activeLocks.length === 0) {
    return {
      hasConflict: false,
      conflictingLocks: [],
      analysis: "No active locks. No constraints to check against.",
    };
  }

  const conflicting = [];
  for (const lock of activeLocks) {
    const result = analyzeConflict(proposedAction, lock.text);

    if (result.isConflict) {
      conflicting.push({
        id: lock.id,
        text: lock.text,
        matchedKeywords: [],
        confidence: result.confidence,
        level: result.level,
        reasons: result.reasons,
      });
    }
  }

  if (conflicting.length === 0) {
    return {
      hasConflict: false,
      conflictingLocks: [],
      analysis: `Checked against ${activeLocks.length} active lock(s). No conflicts detected (semantic analysis v2). Proceed with caution.`,
    };
  }

  // Sort by confidence descending
  conflicting.sort((a, b) => b.confidence - a.confidence);

  const details = conflicting
    .map(
      (c) =>
        `- [${c.level}] "${c.text}" (confidence: ${c.confidence}%)\n  Reasons: ${c.reasons.join("; ")}`
    )
    .join("\n");

  const result = {
    hasConflict: true,
    conflictingLocks: conflicting,
    analysis: `Potential conflict with ${conflicting.length} lock(s):\n${details}\nReview before proceeding.`,
  };

  // Record violation for reporting
  addViolation(brain, {
    at: nowIso(),
    action: proposedAction,
    locks: conflicting.map((c) => ({ id: c.id, text: c.text, confidence: c.confidence, level: c.level })),
    topLevel: conflicting[0].level,
    topConfidence: conflicting[0].confidence,
  });
  writeBrain(root, brain);

  return result;
}

// Async version — uses LLM if available, falls back to heuristic
export async function checkConflictAsync(root, proposedAction) {
  // Try LLM first (if llm-checker is available)
  try {
    const { llmCheckConflict } = await import("./llm-checker.js");
    const llmResult = await llmCheckConflict(root, proposedAction);
    if (llmResult) return llmResult;
  } catch (_) {
    // LLM checker not available or failed — fall through to heuristic
  }

  // Fallback to heuristic
  return checkConflict(root, proposedAction);
}

// --- Auto-lock suggestions ---
export function suggestLocks(root) {
  const brain = ensureInit(root);
  const suggestions = [];

  // Analyze decisions for implicit constraints
  for (const dec of brain.decisions) {
    const lower = dec.text.toLowerCase();
    // Decisions with strong commitment language become lock candidates
    if (/\b(always|must|only|exclusively|never|required)\b/.test(lower)) {
      suggestions.push({
        text: dec.text,
        source: "decision",
        sourceId: dec.id,
        reason: `Decision contains strong commitment language — consider promoting to a lock`,
      });
    }
  }

  // Analyze notes for implicit constraints
  for (const note of brain.notes) {
    const lower = note.text.toLowerCase();
    if (/\b(never|must not|do not|don't|avoid|prohibit|forbidden)\b/.test(lower)) {
      suggestions.push({
        text: note.text,
        source: "note",
        sourceId: note.id,
        reason: `Note contains prohibitive language — consider promoting to a lock`,
      });
    }
  }

  // Check for common patterns that should be locked
  const existingLockTexts = brain.specLock.items
    .filter((l) => l.active)
    .map((l) => l.text.toLowerCase());

  // Suggest common locks if not already present
  const commonPatterns = [
    { keyword: "api", suggestion: "No breaking changes to public API" },
    { keyword: "database", suggestion: "No destructive database migrations without backup" },
    { keyword: "deploy", suggestion: "All deployments must pass CI checks" },
    { keyword: "security", suggestion: "No secrets or credentials in source code" },
    { keyword: "test", suggestion: "No merging without passing tests" },
  ];

  // Check if project context suggests these
  const allText = [
    brain.goal.text,
    ...brain.decisions.map((d) => d.text),
    ...brain.notes.map((n) => n.text),
  ].join(" ").toLowerCase();

  for (const pattern of commonPatterns) {
    if (allText.includes(pattern.keyword)) {
      const alreadyLocked = existingLockTexts.some((t) =>
        t.includes(pattern.keyword)
      );
      if (!alreadyLocked) {
        suggestions.push({
          text: pattern.suggestion,
          source: "pattern",
          sourceId: null,
          reason: `Project mentions "${pattern.keyword}" but has no lock protecting it`,
        });
      }
    }
  }

  return { suggestions, totalLocks: brain.specLock.items.filter((l) => l.active).length };
}

// --- Drift detection (v2: uses semantic engine) ---
export function detectDrift(root) {
  const brain = ensureInit(root);
  const activeLocks = brain.specLock.items.filter((l) => l.active !== false);
  if (activeLocks.length === 0) {
    return { drifts: [], status: "no_locks", message: "No active locks to check against." };
  }

  const drifts = [];

  // Check recent changes against locks using the semantic engine
  for (const change of brain.state.recentChanges) {
    for (const lock of activeLocks) {
      const result = analyzeConflict(change.summary, lock.text);

      if (result.isConflict) {
        drifts.push({
          lockId: lock.id,
          lockText: lock.text,
          changeEventId: change.eventId,
          changeSummary: change.summary,
          changeAt: change.at,
          matchedTerms: result.reasons,
          severity: result.level === "HIGH" ? "high" : "medium",
        });
      }
    }
  }

  // Check for reverts (always a drift signal)
  for (const revert of brain.state.reverts) {
    drifts.push({
      lockId: null,
      lockText: "(git revert detected)",
      changeEventId: revert.eventId,
      changeSummary: `Git ${revert.kind} to ${revert.target.substring(0, 12)}`,
      changeAt: revert.at,
      matchedTerms: ["revert"],
      severity: "high",
    });
  }

  const status = drifts.length === 0 ? "clean" : "drift_detected";
  const message = drifts.length === 0
    ? `All clear. ${activeLocks.length} lock(s) checked against ${brain.state.recentChanges.length} recent change(s). No drift detected.`
    : `WARNING: ${drifts.length} potential drift(s) detected. Review immediately.`;

  return { drifts, status, message };
}

// --- Session management ---

export function startSession(root, toolName = "unknown") {
  const brain = ensureInit(root);

  // Auto-close previous session if open
  if (brain.sessions.current) {
    const prev = brain.sessions.current;
    prev.endedAt = nowIso();
    prev.summary = prev.summary || "Session auto-closed (new session started)";
    brain.sessions.history.unshift(prev);
    if (brain.sessions.history.length > 50) {
      brain.sessions.history = brain.sessions.history.slice(0, 50);
    }
  }

  const session = {
    id: newId("ses"),
    startedAt: nowIso(),
    endedAt: null,
    summary: "",
    toolUsed: toolName,
    eventsInSession: 0,
  };
  brain.sessions.current = session;

  const eventId = newId("evt");
  const event = {
    eventId,
    type: "session_started",
    at: nowIso(),
    files: [],
    summary: `Session started (${toolName})`,
    patchPath: "",
  };
  recordEvent(root, brain, event);
  return { brain, session };
}

export function endSession(root, summary) {
  const brain = ensureInit(root);
  if (!brain.sessions.current) {
    return { brain, ended: false, error: "No active session to end." };
  }

  const session = brain.sessions.current;
  session.endedAt = nowIso();
  session.summary = summary;

  // Count events during this session
  const events = readEvents(root, { since: session.startedAt });
  session.eventsInSession = events.length;

  brain.sessions.history.unshift(session);
  if (brain.sessions.history.length > 50) {
    brain.sessions.history = brain.sessions.history.slice(0, 50);
  }
  brain.sessions.current = null;

  const eventId = newId("evt");
  const event = {
    eventId,
    type: "session_ended",
    at: nowIso(),
    files: [],
    summary: `Session ended: ${summary.substring(0, 100)}`,
    patchPath: "",
  };
  recordEvent(root, brain, event);
  return { brain, ended: true, session };
}

export function getSessionBriefing(root, toolName = "unknown") {
  const { brain, session } = startSession(root, toolName);

  const lastSession =
    brain.sessions.history.length > 0 ? brain.sessions.history[0] : null;

  let changesSinceLastSession = 0;
  let warnings = [];

  if (lastSession && lastSession.endedAt) {
    const eventsSince = readEvents(root, { since: lastSession.endedAt });
    changesSinceLastSession = eventsSince.length;

    // Check for reverts since last session
    const revertsSince = eventsSince.filter(
      (e) => e.type === "revert_detected"
    );
    if (revertsSince.length > 0) {
      warnings.push(
        `${revertsSince.length} revert(s) detected since last session. Verify current state before proceeding.`
      );
    }
  }

  return {
    brain,
    session,
    lastSession,
    changesSinceLastSession,
    warnings,
  };
}

// --- File watcher ---

export async function watchRepo(root) {
  const { default: chokidar } = await import("chokidar");
  const brain = ensureInit(root);
  const ignore = [
    "**/node_modules/**",
    "**/.git/**",
    "**/.speclock/**",
  ];

  let lastFileEventAt = 0;

  const watcher = chokidar.watch(root, {
    ignored: ignore,
    ignoreInitial: true,
    persistent: true,
  });

  watcher.on("add", (p) => {
    lastFileEventAt = Date.now();
    handleFileEvent(root, brain, "file_created", p);
  });
  watcher.on("change", (p) => {
    lastFileEventAt = Date.now();
    handleFileEvent(root, brain, "file_changed", p);
  });
  watcher.on("unlink", (p) => {
    lastFileEventAt = Date.now();
    handleFileEvent(root, brain, "file_deleted", p);
  });

  // Revert detection via HEAD polling
  if (brain.facts.repo.hasGit) {
    setInterval(() => {
      const head = getHead(root);
      if (!head.gitCommit) return;
      const prev = brain.state.head.gitCommit;
      const now = Date.now();
      if (prev && head.gitCommit !== prev && now - lastFileEventAt > 2000) {
        const eventId = newId("evt");
        const event = {
          eventId,
          type: "revert_detected",
          at: nowIso(),
          files: [],
          summary: `HEAD moved to ${head.gitCommit.substring(0, 12)}`,
          patchPath: "",
        };
        addRevert(brain, {
          eventId,
          kind: "git_checkout",
          target: head.gitCommit,
          at: event.at,
          note: "",
        });
        recordEvent(root, brain, event);
      }
      brain.state.head.gitBranch = head.gitBranch;
      brain.state.head.gitCommit = head.gitCommit;
      brain.state.head.capturedAt = nowIso();
      writeBrain(root, brain);
    }, 5000);
  }

  console.log("SpecLock watching for changes...");
  return watcher;
}

// --- SPECLOCK.md generator (for npm dependency / file-based mode) ---

export function createSpecLockMd(root) {
  const mdContent = `# SpecLock — AI Constraint Engine Active

## CRITICAL: LOCKED FILES CANNOT BE MODIFIED

If a lock says "never modify auth files" then you CANNOT modify those files.
Not now. Not later. Not if the user asks a question. Not for any reason.

**The ONLY way to modify a locked file:** The user must explicitly say "unlock" or "remove the lock."
Asking a question is NOT permission. Talking about a feature is NOT permission.
ONLY the words "unlock", "remove the lock", or "I changed my mind about the lock" count.

**If a file contains "SPECLOCK-GUARD" at the top → DO NOT EDIT IT. No exceptions.**

## On EVERY message — do this FIRST:

1. Read \`.speclock/context/latest.md\` for project memory
2. Run \`npx speclock check "what you plan to do"\` BEFORE any code changes
3. If conflict found → STOP. Tell user. Do NOT proceed. Do NOT ask "should I proceed?"
4. Wait for user to explicitly say "unlock" or "remove the lock" before touching locked files

## Returning to This Project? (New Chat Session)

SpecLock is ALREADY installed. Do NOT reinstall it. Do NOT say "it's not installed."
1. Run \`npx speclock status\` to see current locks and decisions
2. Read \`.speclock/context/latest.md\` for full project context
3. Respect ALL existing locks — they carry over between sessions

## What Counts as Permission to Bypass a Lock?

| User says | Is this permission? | What you do |
|-----------|-------------------|-------------|
| "add google auth" | NO — lock still active | Say "Auth files are locked. Want me to unlock them first?" |
| "is speclock initialized?" | NO — just a question | Answer the question. Do NOT change any code. |
| "yeah go ahead" (after you warned about lock) | NO — too vague | Say "To modify locked files, please confirm: unlock the auth files" |
| "ok unlock the auth files" | YES — explicit unlock | Run \`npx speclock lock remove <lockId>\`, then make changes |
| "remove the lock on auth" | YES — explicit unlock | Run \`npx speclock lock remove <lockId>\`, then make changes |
| "I changed my mind, you can edit auth" | YES — explicit unlock | Run \`npx speclock lock remove <lockId>\`, then make changes |

**When in doubt: DO NOT modify locked files. Ask for clarification instead.**

## Detect Constraints from Natural Language

Users will NOT say "lock this." They speak naturally. YOU must detect intent and lock automatically.

| User says | You do |
|-----------|--------|
| "don't touch the auth" | \`npx speclock lock "Never modify auth files"\` + \`npx speclock guard\` the auth files |
| "database is firebase, don't change it" | \`npx speclock lock "Database must always be Firebase"\` |
| "leave the payment system alone" | \`npx speclock lock "Never modify payment system"\` + guard payment files |
| "always use Supabase" | \`npx speclock lock "Always use Supabase"\` |
| "the API is done, don't mess with it" | \`npx speclock lock "Never modify API endpoints"\` + guard API files |

When you lock something, ALSO guard the specific files:
\`npx speclock guard <filepath> --lock "the constraint"\`

## Unlocking (When User Gives Explicit Permission)

1. User says "unlock auth" or "remove the auth lock" or "I changed my mind about auth"
2. Run \`npx speclock lock remove <lockId>\` + \`npx speclock unguard <file>\`
3. Make the changes
4. Ask: "Want me to re-lock this?"

## After Building Something

\`npx speclock log-change "what you built" --files file1.tsx,file2.ts\`

## Commands

\`\`\`bash
npx speclock status                              # Check current state
npx speclock check "what you plan to do"         # ALWAYS RUN BEFORE CHANGES
npx speclock lock "constraint"                   # Lock a constraint
npx speclock guard <file> --lock "constraint"    # Protect a specific file
npx speclock unguard <file>                      # Remove file protection
npx speclock lock remove <lockId>                # Unlock (only after explicit permission)
npx speclock log-change "what changed"           # Log changes
npx speclock decide "decision"                   # Record a decision
npx speclock template list                       # List constraint templates
npx speclock template apply <name>               # Apply a template (nextjs, react, etc.)
npx speclock report                              # Show violation stats
npx speclock hook install                        # Install git pre-commit hook
npx speclock audit                               # Audit staged files vs locks
npx speclock context                             # Refresh context file
\`\`\`

## Key Rules

1. **A question is NOT permission to bypass a lock.**
2. **Run speclock check before EVERY code change, EVERY time, EVERY message.**
3. **If you already warned about a conflict, the lock is STILL active until explicitly removed.**
4. **The user will NEVER tell you to run these commands. You run them automatically.**
5. **If this file exists, SpecLock is installed. Do NOT reinstall.**
`;
  const filePath = path.join(root, "SPECLOCK.md");
  fs.writeFileSync(filePath, mdContent);
  return filePath;
}

// --- File-level lock guard ---

const GUARD_MARKERS = {
  js: { start: "// ", block: false },
  ts: { start: "// ", block: false },
  jsx: { start: "// ", block: false },
  tsx: { start: "// ", block: false },
  py: { start: "# ", block: false },
  rb: { start: "# ", block: false },
  sh: { start: "# ", block: false },
  css: { start: "/* ", end: " */", block: true },
  html: { start: "<!-- ", end: " -->", block: true },
  vue: { start: "<!-- ", end: " -->", block: true },
  svelte: { start: "<!-- ", end: " -->", block: true },
  sql: { start: "-- ", block: false },
};

const GUARD_TAG = "SPECLOCK-GUARD";

function getCommentStyle(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return GUARD_MARKERS[ext] || { start: "// ", block: false };
}

export function guardFile(root, relativeFilePath, lockText) {
  const fullPath = path.join(root, relativeFilePath);
  if (!fs.existsSync(fullPath)) {
    return { success: false, error: `File not found: ${relativeFilePath}` };
  }

  const content = fs.readFileSync(fullPath, "utf-8");
  const style = getCommentStyle(fullPath);

  // Check if already guarded
  if (content.includes(GUARD_TAG)) {
    return { success: false, error: `File already guarded: ${relativeFilePath}` };
  }

  const warningLines = [
    `${style.start}${"=".repeat(60)}${style.end || ""}`,
    `${style.start}${GUARD_TAG} — DO NOT MODIFY THIS FILE${style.end || ""}`,
    `${style.start}LOCKED: ${lockText}${style.end || ""}`,
    `${style.start}THIS FILE IS LOCKED. DO NOT EDIT, CHANGE, OR REWRITE ANY PART OF IT.${style.end || ""}`,
    `${style.start}The user must say "unlock" before this file can be changed.${style.end || ""}`,
    `${style.start}A question is NOT permission. Asking about features is NOT permission.${style.end || ""}`,
    `${style.start}ONLY "unlock" or "remove the lock" is permission to edit this file.${style.end || ""}`,
    `${style.start}${"=".repeat(60)}${style.end || ""}`,
    "",
  ];

  const guarded = warningLines.join("\n") + content;
  fs.writeFileSync(fullPath, guarded);

  return { success: true };
}

// --- Package.json lock sync (Solution 2: embed active locks directly in package.json) ---

export function syncLocksToPackageJson(root) {
  const pkgPath = path.join(root, "package.json");
  if (!fs.existsSync(pkgPath)) {
    return { success: false, error: "No package.json found in project root." };
  }

  try {
    const raw = fs.readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(raw);
    const brain = readBrain(root);
    if (!brain) {
      return { success: false, error: "SpecLock not initialized." };
    }

    const activeLocks = brain.specLock.items
      .filter((l) => l.active !== false)
      .map((l) => l.text);

    pkg.speclock = {
      active: true,
      message: "STOP — This project has SpecLock constraints. Read SPECLOCK.md and .speclock/context/latest.md BEFORE making ANY changes. Run 'npx speclock check' before ALL code changes. If a lock below is violated, STOP and ask user to unlock.",
      locks: activeLocks,
      context: ".speclock/context/latest.md",
      rules: "SPECLOCK.md",
    };

    const indent = raw.match(/^(\s+)/m)?.[1] || "  ";
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, indent) + "\n");

    return { success: true, lockCount: activeLocks.length };
  } catch (err) {
    return { success: false, error: `Failed to sync locks to package.json: ${err.message}` };
  }
}

// Backward-compatible alias
export function injectPackageJsonMarker(root) {
  return syncLocksToPackageJson(root);
}

// --- Auto-guard related files (Solution 1: scan project and guard files matching lock keywords) ---

const FILE_KEYWORD_PATTERNS = [
  { keywords: ["auth", "authentication", "login", "signup", "signin", "sign-in", "sign-up"], patterns: ["**/Auth*", "**/auth*", "**/Login*", "**/login*", "**/SignUp*", "**/signup*", "**/SignIn*", "**/signin*", "**/*Auth*", "**/*auth*"] },
  { keywords: ["database", "db", "supabase", "firebase", "mongo", "postgres", "sql", "prisma"], patterns: ["**/supabase*", "**/firebase*", "**/database*", "**/db.*", "**/db/**", "**/prisma/**", "**/*Client*", "**/*client*"] },
  { keywords: ["payment", "pay", "stripe", "billing", "checkout", "subscription"], patterns: ["**/payment*", "**/Payment*", "**/pay*", "**/Pay*", "**/stripe*", "**/Stripe*", "**/billing*", "**/Billing*", "**/checkout*", "**/Checkout*"] },
  { keywords: ["api", "endpoint", "route", "routes"], patterns: ["**/api/**", "**/routes/**", "**/endpoints/**"] },
  { keywords: ["config", "configuration", "settings", "env"], patterns: ["**/config*", "**/Config*", "**/settings*", "**/Settings*"] },
];

function findRelatedFiles(root, lockText) {
  const lockLower = lockText.toLowerCase();
  const matchedFiles = [];

  // Find which keyword patterns match this lock text
  const matchingPatterns = [];
  for (const group of FILE_KEYWORD_PATTERNS) {
    const hasMatch = group.keywords.some((kw) => lockLower.includes(kw));
    if (hasMatch) {
      matchingPatterns.push(...group.patterns);
    }
  }

  if (matchingPatterns.length === 0) return matchedFiles;

  // Scan the src/ directory (and common directories) for matching files
  const searchDirs = ["src", "app", "components", "pages", "lib", "utils", "contexts", "hooks", "services"];

  for (const dir of searchDirs) {
    const dirPath = path.join(root, dir);
    if (!fs.existsSync(dirPath)) continue;
    scanDirForMatches(root, dirPath, matchingPatterns, matchedFiles);
  }

  // Also check root-level files
  try {
    const rootFiles = fs.readdirSync(root);
    for (const file of rootFiles) {
      const fullPath = path.join(root, file);
      if (!fs.statSync(fullPath).isFile()) continue;
      const ext = path.extname(file).slice(1).toLowerCase();
      if (!GUARD_MARKERS[ext]) continue;

      for (const pattern of matchingPatterns) {
        const simpleMatch = patternMatchesFile(pattern, file);
        if (simpleMatch) {
          const rel = path.relative(root, fullPath).replace(/\\/g, "/");
          if (!matchedFiles.includes(rel)) matchedFiles.push(rel);
        }
      }
    }
  } catch (_) {}

  return matchedFiles;
}

function scanDirForMatches(root, dirPath, patterns, results) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".speclock" || entry.name === ".git") continue;
        scanDirForMatches(root, fullPath, patterns, results);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).slice(1).toLowerCase();
        if (!GUARD_MARKERS[ext]) continue;
        const relPath = path.relative(root, fullPath).replace(/\\/g, "/");
        for (const pattern of patterns) {
          if (patternMatchesFile(pattern, relPath) || patternMatchesFile(pattern, entry.name)) {
            if (!results.includes(relPath)) results.push(relPath);
            break;
          }
        }
      }
    }
  } catch (_) {}
}

function patternMatchesFile(pattern, filePath) {
  // Simple glob matching: convert glob to regex
  // Handle ** (any path), * (any chars in segment)
  const clean = pattern.replace(/\\/g, "/");
  const fileLower = filePath.toLowerCase();
  const patternLower = clean.toLowerCase();

  // Strip leading **/ for simple name matching
  const namePattern = patternLower.replace(/^\*\*\//, "");

  // Check if pattern is just a name pattern (no path separators)
  if (!namePattern.includes("/")) {
    const fileName = fileLower.split("/").pop();
    // Convert glob * to regex .*
    const regex = new RegExp("^" + namePattern.replace(/\*/g, ".*") + "$");
    if (regex.test(fileName)) return true;
    // Also check if the pattern appears anywhere in the filename
    const corePattern = namePattern.replace(/\*/g, "");
    if (corePattern.length > 2 && fileName.includes(corePattern)) return true;
  }

  // Full path match
  const regex = new RegExp("^" + patternLower.replace(/\*\*\//g, "(.*/)?").replace(/\*/g, "[^/]*") + "$");
  return regex.test(fileLower);
}

export function autoGuardRelatedFiles(root, lockText) {
  const relatedFiles = findRelatedFiles(root, lockText);
  const guarded = [];
  const skipped = [];

  for (const relFile of relatedFiles) {
    const result = guardFile(root, relFile, lockText);
    if (result.success) {
      guarded.push(relFile);
    } else {
      skipped.push({ file: relFile, reason: result.error });
    }
  }

  return { guarded, skipped, scannedPatterns: relatedFiles.length };
}

export function unguardFile(root, relativeFilePath) {
  const fullPath = path.join(root, relativeFilePath);
  if (!fs.existsSync(fullPath)) {
    return { success: false, error: `File not found: ${relativeFilePath}` };
  }

  const content = fs.readFileSync(fullPath, "utf-8");
  if (!content.includes(GUARD_TAG)) {
    return { success: false, error: `File is not guarded: ${relativeFilePath}` };
  }

  // Remove everything from first marker line to the blank line after last marker
  const lines = content.split("\n");
  let guardEnd = 0;
  let inGuard = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(GUARD_TAG)) inGuard = true;
    if (inGuard && lines[i].includes("=".repeat(60)) && i > 0) {
      guardEnd = i + 1; // Skip the blank line after
      if (lines[guardEnd] === "") guardEnd++;
      break;
    }
  }

  const unguarded = lines.slice(guardEnd).join("\n");
  fs.writeFileSync(fullPath, unguarded);

  return { success: true };
}

// --- Constraint Templates ---

export function listTemplates() {
  const names = getTemplateNames();
  return names.map((name) => {
    const t = getTemplate(name);
    return {
      name: t.name,
      displayName: t.displayName,
      description: t.description,
      lockCount: t.locks.length,
      decisionCount: t.decisions.length,
    };
  });
}

export function applyTemplate(root, templateName) {
  const template = getTemplate(templateName);
  if (!template) {
    return { applied: false, error: `Template not found: "${templateName}". Available: ${getTemplateNames().join(", ")}` };
  }

  ensureInit(root);

  let locksAdded = 0;
  let decisionsAdded = 0;

  for (const lockText of template.locks) {
    addLock(root, lockText, [template.name], "agent");
    autoGuardRelatedFiles(root, lockText);
    locksAdded++;
  }

  for (const decText of template.decisions) {
    addDecision(root, decText, [template.name], "agent");
    decisionsAdded++;
  }

  syncLocksToPackageJson(root);

  return {
    applied: true,
    templateName: template.name,
    displayName: template.displayName,
    locksAdded,
    decisionsAdded,
  };
}

// --- Violation Report ---

export function generateReport(root) {
  const brain = ensureInit(root);
  const violations = brain.state.violations || [];

  if (violations.length === 0) {
    return {
      totalViolations: 0,
      violationsByLock: {},
      mostTestedLocks: [],
      recentViolations: [],
      summary: "No violations recorded yet. SpecLock is watching.",
    };
  }

  // Count violations per lock
  const byLock = {};
  for (const v of violations) {
    for (const lock of v.locks) {
      if (!byLock[lock.text]) {
        byLock[lock.text] = { count: 0, lockId: lock.id, text: lock.text };
      }
      byLock[lock.text].count++;
    }
  }

  // Sort by count descending
  const mostTested = Object.values(byLock).sort((a, b) => b.count - a.count);

  // Recent 10
  const recent = violations.slice(0, 10).map((v) => ({
    at: v.at,
    action: v.action,
    topLevel: v.topLevel,
    topConfidence: v.topConfidence,
    lockCount: v.locks.length,
  }));

  // Time range
  const oldest = violations[violations.length - 1];
  const newest = violations[0];

  return {
    totalViolations: violations.length,
    timeRange: { from: oldest.at, to: newest.at },
    violationsByLock: byLock,
    mostTestedLocks: mostTested.slice(0, 5),
    recentViolations: recent,
    summary: `SpecLock blocked ${violations.length} violation(s). Most tested lock: "${mostTested[0].text}" (${mostTested[0].count} blocks).`,
  };
}

// --- Pre-commit Audit ---

export function auditStagedFiles(root) {
  const brain = ensureInit(root);
  const activeLocks = brain.specLock.items.filter((l) => l.active !== false);

  if (activeLocks.length === 0) {
    return { passed: true, violations: [], checkedFiles: 0, activeLocks: 0, message: "No active locks. Audit passed." };
  }

  const stagedFiles = getStagedFiles(root);
  if (stagedFiles.length === 0) {
    return { passed: true, violations: [], checkedFiles: 0, activeLocks: activeLocks.length, message: "No staged files. Audit passed." };
  }

  const violations = [];

  for (const file of stagedFiles) {
    // Check 1: Does the file have a SPECLOCK-GUARD header?
    const fullPath = path.join(root, file);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        if (content.includes(GUARD_TAG)) {
          violations.push({
            file,
            reason: "File has SPECLOCK-GUARD header — it is locked and must not be modified",
            lockText: "(file-level guard)",
            severity: "HIGH",
          });
          continue;
        }
      } catch (_) {}
    }

    // Check 2: Does the file path match any lock keywords?
    const fileLower = file.toLowerCase();
    for (const lock of activeLocks) {
      const lockLower = lock.text.toLowerCase();
      const lockHasNegation = hasNegation(lockLower);
      if (!lockHasNegation) continue;

      // Check if any FILE_KEYWORD_PATTERNS keywords from the lock match this file
      for (const group of FILE_KEYWORD_PATTERNS) {
        const lockMatchesKeyword = group.keywords.some((kw) => lockLower.includes(kw));
        if (!lockMatchesKeyword) continue;

        const fileMatchesPattern = group.patterns.some((pattern) => patternMatchesFile(pattern, fileLower) || patternMatchesFile(pattern, fileLower.split("/").pop()));
        if (fileMatchesPattern) {
          violations.push({
            file,
            reason: `File matches lock keyword pattern`,
            lockText: lock.text,
            severity: "MEDIUM",
          });
          break;
        }
      }
    }
  }

  // Deduplicate by file
  const seen = new Set();
  const unique = violations.filter((v) => {
    if (seen.has(v.file)) return false;
    seen.add(v.file);
    return true;
  });

  const passed = unique.length === 0;
  const message = passed
    ? `Audit passed. ${stagedFiles.length} file(s) checked against ${activeLocks.length} lock(s).`
    : `AUDIT FAILED: ${unique.length} violation(s) in ${stagedFiles.length} staged file(s).`;

  return {
    passed,
    violations: unique,
    checkedFiles: stagedFiles.length,
    activeLocks: activeLocks.length,
    message,
  };
}
