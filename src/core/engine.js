/**
 * SpecLock Engine — Orchestrator
 * Re-exports all functionality from focused modules.
 * This file exists for backward compatibility — all imports from engine.js still work.
 *
 * Module structure (v5.0):
 * - memory.js:     Goal, lock, typed lock, decision, note, deploy facts CRUD
 * - tracking.js:   Change logging, file event handling
 * - conflict.js:   Conflict checking, drift detection, suggestions, audit
 * - typed-constraints.js: Numerical, range, state, temporal constraint checking
 * - sessions.js:   Session management (briefing, start, end)
 * - enforcer.js:   Hard/advisory enforcement, overrides, escalation
 * - pre-commit-semantic.js: Semantic pre-commit analysis
 * - audit.js:      HMAC audit chain (v2.1)
 * - compliance.js: SOC 2/HIPAA/CSV exports (v2.1)
 * - license.js:    Freemium tier system (v2.1)
 *
 * Developed by Sandeep Roy (https://github.com/sgroy10)
 */

// --- Memory (CRUD) ---
export {
  ensureInit,
  setGoal,
  addLock,
  addTypedLock,
  updateTypedLockThreshold,
  removeLock,
  addDecision,
  addNote,
  updateDeployFacts,
} from "./memory.js";

// --- Tracking ---
export {
  logChange,
  handleFileEvent,
} from "./tracking.js";

// --- Conflict Detection & Enforcement ---
export {
  checkConflict,
  checkConflictAsync,
  suggestLocks,
  detectDrift,
  generateReport,
  auditStagedFiles,
} from "./conflict.js";

// --- Semantic Analysis (direct API for cross-platform usage) ---
export { analyzeConflict, scoreConflict } from "./semantics.js";

// --- Sessions ---
export {
  startSession,
  endSession,
  getSessionBriefing,
} from "./sessions.js";

// --- Hard Enforcement (v2.5) ---
export {
  getEnforcementConfig,
  setEnforcementMode,
  enforceConflictCheck,
  enforceConflictCheckAsync,
  overrideLock,
  getOverrideHistory,
} from "./enforcer.js";

// --- Semantic Pre-Commit (v2.5) ---
export {
  parseDiff,
  semanticAudit,
} from "./pre-commit-semantic.js";

// --- File Watcher ---
// watchRepo stays here because it uses multiple modules

import path from "path";
import { nowIso, newId, readBrain, writeBrain, appendEvent, bumpEvents, addRevert } from "./storage.js";
import { getHead } from "./git.js";
import { ensureInit, addLock as addLockFn, addDecision as addDecisionFn } from "./memory.js";
import { handleFileEvent } from "./tracking.js";

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
        bumpEvents(brain, eventId);
        appendEvent(root, event);
        writeBrain(root, brain);
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

// --- SPECLOCK.md generator ---

import fs from "fs";

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

export function injectPackageJsonMarker(root) {
  return syncLocksToPackageJson(root);
}

// --- Auto-guard related files ---

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

  const matchingPatterns = [];
  for (const group of FILE_KEYWORD_PATTERNS) {
    const hasMatch = group.keywords.some((kw) => lockLower.includes(kw));
    if (hasMatch) {
      matchingPatterns.push(...group.patterns);
    }
  }

  if (matchingPatterns.length === 0) return matchedFiles;

  const searchDirs = ["src", "app", "components", "pages", "lib", "utils", "contexts", "hooks", "services"];

  for (const dir of searchDirs) {
    const dirPath = path.join(root, dir);
    if (!fs.existsSync(dirPath)) continue;
    scanDirForMatches(root, dirPath, matchingPatterns, matchedFiles);
  }

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
  const clean = pattern.replace(/\\/g, "/");
  const fileLower = filePath.toLowerCase();
  const patternLower = clean.toLowerCase();
  const namePattern = patternLower.replace(/^\*\*\//, "");
  if (!namePattern.includes("/")) {
    const fileName = fileLower.split("/").pop();
    const regex = new RegExp("^" + namePattern.replace(/\*/g, ".*") + "$");
    if (regex.test(fileName)) return true;
    const corePattern = namePattern.replace(/\*/g, "");
    if (corePattern.length > 2 && fileName.includes(corePattern)) return true;
  }
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

  const lines = content.split("\n");
  let guardEnd = 0;
  let inGuard = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(GUARD_TAG)) inGuard = true;
    if (inGuard && lines[i].includes("=".repeat(60)) && i > 0) {
      guardEnd = i + 1;
      if (lines[guardEnd] === "") guardEnd++;
      break;
    }
  }

  const unguarded = lines.slice(guardEnd).join("\n");
  fs.writeFileSync(fullPath, unguarded);

  return { success: true };
}

// --- Templates ---
import { getTemplateNames, getTemplate } from "./templates.js";

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
    addLockFn(root, lockText, [template.name], "agent");
    autoGuardRelatedFiles(root, lockText);
    locksAdded++;
  }

  for (const decText of template.decisions) {
    addDecisionFn(root, decText, [template.name], "agent");
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

// --- Enterprise features (v2.1) ---
export { verifyAuditChain } from "./audit.js";
export { exportCompliance } from "./compliance.js";
export { checkFeature, checkLimits, getLicenseInfo } from "./license.js";

// --- Authentication & RBAC (v3.0) ---
export {
  isAuthEnabled,
  enableAuth,
  disableAuth,
  createApiKey,
  validateApiKey,
  checkPermission,
  rotateApiKey,
  revokeApiKey,
  listApiKeys,
  ROLES,
  TOOL_PERMISSIONS,
} from "./auth.js";

// --- Encrypted Storage (v3.0) ---
export {
  isEncryptionEnabled,
  isEncrypted,
  encrypt,
  decrypt,
  clearKeyCache,
} from "./crypto.js";

// --- Policy-as-Code (v3.5) ---
export {
  loadPolicy,
  savePolicy,
  initPolicy,
  addPolicyRule,
  removePolicyRule,
  listPolicyRules,
  evaluatePolicy,
  exportPolicy,
  importPolicy,
  generateNotifications,
} from "./policy.js";

// --- Telemetry & Analytics (v3.5) ---
export {
  isTelemetryEnabled,
  trackToolUsage,
  trackConflict,
  trackFeature,
  trackSession,
  getTelemetrySummary,
  flushToRemote,
  resetTelemetry,
} from "./telemetry.js";

// --- OAuth/OIDC SSO (v3.5) ---
export {
  isSSOEnabled,
  getSSOConfig,
  saveSSOConfig,
  getAuthorizationUrl,
  handleCallback,
  validateSession,
  revokeSession,
  listSessions,
} from "./sso.js";

// --- Typed Constraints for Autonomous Systems (v5.0) ---
export {
  CONSTRAINT_TYPES,
  OPERATORS,
  validateTypedLock,
  checkTypedConstraint,
  checkAllTypedConstraints,
  formatTypedLockText,
} from "./typed-constraints.js";

// --- Smart Lock Authoring (v4.0) ---
export {
  normalizeLock,
  detectVerbContamination,
  extractSubjects,
  compareSubjects,
  extractLockSubject,
  rewriteLock,
} from "./lock-author.js";
