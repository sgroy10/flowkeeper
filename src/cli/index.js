import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getStagedDiff, parseDiff, shouldSkipForSemanticAudit } from "../core/pre-commit-semantic.js";
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
  watchRepo,
  createSpecLockMd,
  guardFile,
  unguardFile,
  injectPackageJsonMarker,
  syncLocksToPackageJson,
  autoGuardRelatedFiles,
  listTemplates,
  applyTemplate,
  generateReport,
  auditStagedFiles,
  verifyAuditChain,
  exportCompliance,
  getLicenseInfo,
  enforceConflictCheck,
  enforceConflictCheckAsync,
  setEnforcementMode,
  overrideLock,
  getOverrideHistory,
  getEnforcementConfig,
  semanticAudit,
} from "../core/engine.js";
import { generateContext } from "../core/context.js";
import { readBrain } from "../core/storage.js";
import { installHook, removeHook } from "../core/hooks.js";
import {
  isAuthEnabled,
  enableAuth,
  disableAuth,
  createApiKey,
  rotateApiKey,
  revokeApiKey,
  listApiKeys,
} from "../core/auth.js";
import { isEncryptionEnabled } from "../core/crypto.js";
import {
  initPolicy,
  addPolicyRule,
  removePolicyRule,
  listPolicyRules,
  evaluatePolicy,
  exportPolicy,
  importPolicy,
} from "../core/policy.js";
import {
  isTelemetryEnabled,
  getTelemetrySummary,
  isTelemetryOptedIn,
  hasTelemetryDecision,
  enableTelemetry,
  disableTelemetry,
  clearTelemetryLog,
  getOptInTelemetryStatus,
  ensureTelemetryDecision,
  recordCommand,
  TELEMETRY_DEFAULT_ENDPOINT,
  buildUsageStats,
} from "../core/telemetry.js";
import {
  isSSOEnabled,
  getSSOConfig,
  saveSSOConfig,
} from "../core/sso.js";
import { syncRules, getSyncFormats } from "../core/rules-sync.js";
import { getReplay, listSessions, formatReplay } from "../core/replay.js";
import { computeDriftScore, formatDriftScore } from "../core/drift-score.js";
import { computeCoverage, formatCoverage } from "../core/coverage.js";
import { analyzeLockStrength, formatStrength } from "../core/strengthen.js";
import { protect, formatProtectReport, discoverRuleFiles, extractConstraints, RULE_FILES } from "../core/guardian.js";
import {
  installForClient,
  uninstallForClient,
  installAll,
  uninstallAll,
  formatResult,
  nextStepsFor,
  SUPPORTED_CLIENTS,
} from "../core/mcp-install.js";

// --- Argument parsing ---

function parseArgs(argv) {
  const args = argv.slice(2);
  const cmd = args.shift() || "";
  return { cmd, args };
}

function parseFlags(args) {
  const out = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (!next || next.startsWith("--")) {
        out[key] = true;
      } else {
        out[key] = next;
        i++;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

function parseTags(raw) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function rootDir() {
  return process.cwd();
}

// --- Auto-regenerate context after write operations ---

function refreshContext(root) {
  try {
    generateContext(root);
  } catch (_) {
    // Silently skip if context generation fails
  }
}

// --- Rule packs (speclock init --from <framework>) ---

const RULE_PACKS = {
  nextjs: {
    name: "nextjs",
    displayName: "Next.js",
    description: "Next.js (App Router, Server Components, TypeScript)",
  },
  fastapi: {
    name: "fastapi",
    displayName: "FastAPI",
    description: "FastAPI + Python (async, Pydantic, JWT)",
  },
  rails: {
    name: "rails",
    displayName: "Ruby on Rails",
    description: "Ruby on Rails (Strong Params, ActiveRecord)",
  },
  react: {
    name: "react",
    displayName: "React",
    description: "Generic React (hooks, state management)",
  },
  python: {
    name: "python",
    displayName: "Python",
    description: "Generic Python (security, type hints)",
  },
  node: {
    name: "node",
    displayName: "Node.js/Express",
    description: "Node.js/Express (async, security)",
  },
};

/**
 * Locate the rule-packs directory relative to this module.
 * Works for local dev, npm global installs, and npx cache.
 */
function getRulePacksDir() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // src/cli/index.js -> src/templates/rule-packs
  return path.resolve(here, "..", "templates", "rule-packs");
}

/**
 * Read a rule pack file. Returns the raw markdown and an estimated rule count
 * (number of list items under any "## Rules" section).
 */
export function loadRulePack(framework) {
  const pack = RULE_PACKS[framework];
  if (!pack) {
    return {
      ok: false,
      error:
        `Unknown framework "${framework}". ` +
        `Run "speclock init --from list" to see available rule packs.`,
    };
  }
  const dir = getRulePacksDir();
  const filePath = path.join(dir, `${pack.name}.md`);
  if (!fs.existsSync(filePath)) {
    return {
      ok: false,
      error: `Rule pack file missing: ${filePath}`,
    };
  }
  const content = fs.readFileSync(filePath, "utf-8");
  if (!content.trim()) {
    return { ok: false, error: `Rule pack "${framework}" is empty.` };
  }
  // Count rules: lines under any "## Rules" heading that begin with "- " or "* ".
  const lines = content.split("\n");
  let inRules = false;
  let ruleCount = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^##\s+Rules\s*$/i.test(trimmed)) {
      inRules = true;
      continue;
    }
    if (inRules && /^##\s+/.test(trimmed)) {
      inRules = false;
      continue;
    }
    if (inRules && /^[-*]\s+/.test(trimmed)) ruleCount++;
  }
  return { ok: true, pack, content, ruleCount, filePath };
}

function printRulePackList() {
  console.log("\nAvailable rule packs:");
  const order = ["nextjs", "fastapi", "rails", "react", "python", "node"];
  const pad = Math.max(...order.map((k) => k.length));
  for (const key of order) {
    const p = RULE_PACKS[key];
    console.log(`  ${p.name.padEnd(pad)}  — ${p.description}`);
  }
  console.log("\nUsage: speclock init --from <framework>");
  console.log("Example: speclock init --from nextjs\n");
}

/**
 * Write (or append) a rule pack to CLAUDE.md in `root`.
 * Returns { ok, displayName, ruleCount, appended, listed, error }.
 */
export function initFromRulePack(root, framework) {
  if (framework === "list" || framework === "--list" || framework === "help") {
    printRulePackList();
    return { listed: true };
  }

  const loaded = loadRulePack(framework);
  if (!loaded.ok) return { ok: false, error: loaded.error };

  const claudePath = path.join(root, "CLAUDE.md");
  let appended = false;
  if (fs.existsSync(claudePath)) {
    appended = true;
    const existing = fs.readFileSync(claudePath, "utf-8");
    const sep =
      existing.endsWith("\n\n") ? "" : existing.endsWith("\n") ? "\n" : "\n\n";
    const banner =
      `\n<!-- Appended by speclock init --from ${framework} -->\n\n`;
    fs.writeFileSync(claudePath, existing + sep + banner + loaded.content);
    console.log(
      `⚠  CLAUDE.md already exists — appending ${loaded.pack.displayName} rule pack ` +
      `instead of overwriting.`
    );
  } else {
    fs.writeFileSync(claudePath, loaded.content);
  }

  return {
    ok: true,
    displayName: loaded.pack.displayName,
    ruleCount: loaded.ruleCount,
    appended,
    path: claudePath,
  };
}

// --- Help text ---

function printHelp() {
  console.log(`
SpecLock v5.5.7 — Your AI has rules. SpecLock makes them unbreakable.
Developed by Sandeep Roy (github.com/sgroy10)

Usage: speclock <command> [options]

Commands:
  setup [--goal <text>] [--template <name>]  Full setup: init + SPECLOCK.md + context
  init                            Initialize SpecLock in current directory
  init --from <framework>         Bootstrap CLAUDE.md from a curated rule pack
                                  (nextjs, fastapi, rails, react, python, node, list)
  goal <text>                     Set or update the project goal
  lock <text> [--tags a,b]        Add a non-negotiable constraint
  lock remove <id>                Remove a lock by ID
  protect [--strict]              Zero-config: read rule files, extract locks, install hook
                                  (default: warn mode — violations print but DON'T block commits.
                                   Add --strict for hard blocks.)
  mcp install <client>            Auto-install SpecLock MCP server into an AI client
                                  (claude-code, cursor, windsurf, cline, codex, all)
  mcp uninstall <client>          Remove SpecLock MCP server from an AI client
  guard <file> [--lock "text"]    Inject lock warning into a file
  unguard <file>                  Remove lock warning from a file
  decide <text> [--tags a,b]      Record a decision
  note <text> [--pinned]          Add a pinned note
  log-change <text> [--files x,y] Log a significant change
  check <text>                    Check if action conflicts with locks
  template list                   List available constraint templates
  template apply <name>           Apply a template (nextjs, react, etc.)
  report                          Show violation report + stats
  hook install                    Install git pre-commit hook
  hook remove                     Remove git pre-commit hook
  audit [--strict]                Audit staged files against locks (warn mode default;
                                  --strict or SPECLOCK_STRICT=1 exits 1 on violation)
  audit-semantic [--strict]       Semantic audit: analyze code changes vs locks
                                  (warn mode default; use --strict for hard blocks)
  audit-verify                    Verify HMAC audit chain integrity
  enforce <advisory|hard>         Set enforcement mode (advisory=warn, hard=block)
  override <lockId> <reason>      Override a lock with justification
  overrides [--lock <id>]         Show override history
  export --format <soc2|hipaa|csv>  Export compliance report
  license                         Show license tier and usage info
  context                         Generate and print context pack
  facts deploy [--provider X]     Set deployment facts
  sync [--format <name>]           Sync constraints to AI tool rules files
  sync --all                      Sync to ALL formats at once
  sync --list                     List available sync formats
  sync --preview <format>         Preview without writing files
  replay [--session <id>]         Replay session activity — what AI tried & what was caught
  replay --list                   List available sessions for replay
  drift [--days 30]               Drift Score — how much has AI deviated from intent (0-100)
  coverage                        Lock Coverage Audit — find unprotected code areas
  strengthen                      Lock Strengthener — grade locks and suggest improvements
  watch                           Start file watcher (live dashboard)
  serve [--project <path>]        Start MCP stdio server
  status                          Show project brain summary
  stats                           Show YOUR usage dashboard from local telemetry log
  doctor                          Diagnostic health check (install, git, rules, MCP)

Options:
  --tags <a,b,c>                  Comma-separated tags
  --source <user|agent>           Who created this (default: user)
  --files <a.ts,b.ts>             Comma-separated file paths
  --goal <text>                   Goal text (for setup command)
  --template <name>               Template to apply during setup
  --lock <text>                   Lock text (for guard command)
  --format <soc2|hipaa|csv>       Compliance export format
  --project <path>                Project root (for serve)

Templates: nextjs, react, express, supabase, stripe, security-hardened,
           safe-defaults, hipaa, api-stability, solo-founder

Sync Formats: cursor, claude, agents, windsurf, copilot, gemini, codex, aider

Policy-as-Code (v3.5):
  policy list                     List all policy rules
  policy init                     Initialize policy-as-code
  policy add --name <name>        Add a policy rule (--files, --enforce, --severity)
  policy remove <ruleId>          Remove a policy rule
  policy evaluate <action>        Evaluate action against policy rules
  policy export                   Export policy as YAML
  telemetry on                    Opt in to anonymous usage telemetry
  telemetry off                   Opt out of telemetry (revokes immediately)
  telemetry status                Show opt-in state + last 10 recorded events
  telemetry clear                 Clear the local telemetry event log
  sso status                      Show SSO configuration
  sso configure --issuer <url>    Configure SSO (--client-id, --client-secret)

Security (v3.0):
  auth status                     Show auth status and active keys
  auth create-key --role <role>   Create API key (viewer/developer/architect/admin)
  auth rotate-key <keyId>         Rotate an API key
  auth revoke-key <keyId>         Revoke an API key
  auth list-keys                  List all API keys
  auth enable                     Enable API key authentication
  auth disable                    Disable authentication
  encrypt [status]                Show encryption status

Enterprise:
  SPECLOCK_AUDIT_SECRET           HMAC secret for audit chain (env var)
  SPECLOCK_LICENSE_KEY            License key for Pro/Enterprise features
  SPECLOCK_LLM_KEY                API key for LLM-powered conflict detection
  SPECLOCK_ENCRYPTION_KEY         Master key for AES-256-GCM encryption
  SPECLOCK_API_KEY                API key for MCP server auth

Examples:
  npx speclock setup --goal "Build PawPalace pet shop" --template nextjs
  npx speclock lock "Never modify auth files"
  npx speclock check "Adding social login to auth page"
  npx speclock audit-verify
  npx speclock export --format soc2
  npx speclock license
  npx speclock status
`);
}

// --- Status display ---

function showStatus(root) {
  const brain = readBrain(root);
  if (!brain) {
    console.log("SpecLock not initialized. Run: npx speclock setup");
    return;
  }

  const activeLocks = brain.specLock.items.filter((l) => l.active !== false);

  console.log(`\nSpecLock Status — ${brain.project.name}`);
  console.log("=".repeat(50));
  console.log(`Goal: ${brain.goal.text || "(not set)"}`);
  console.log(`Locks: ${activeLocks.length} active`);
  console.log(`Decisions: ${brain.decisions.length}`);
  console.log(`Notes: ${brain.notes.length}`);
  console.log(`Events: ${brain.events.count}`);
  console.log(`Deploy: ${brain.facts.deploy.provider || "(not set)"}`);

  if (brain.sessions.current) {
    console.log(`Session: active (${brain.sessions.current.toolUsed})`);
  } else {
    console.log(`Session: none active`);
  }

  if (brain.sessions.history.length > 0) {
    const last = brain.sessions.history[0];
    console.log(
      `Last session: ${last.toolUsed} — ${last.summary || "(no summary)"}`
    );
  }

  console.log(`Recent changes: ${brain.state.recentChanges.length}`);
  console.log(`Auth: ${isAuthEnabled(root) ? "enabled" : "disabled"}`);
  console.log(`Encryption: ${isEncryptionEnabled() ? "enabled (AES-256-GCM)" : "disabled"}`);
  const policyRules = listPolicyRules(root);
  console.log(`Policy rules: ${policyRules.active}/${policyRules.total}`);
  console.log(`Telemetry: ${isTelemetryEnabled() ? "enabled" : "disabled"}`);
  console.log(`SSO: ${isSSOEnabled(root) ? "configured" : "not configured"}`);
  console.log("");
}

// --- Stats dashboard (speclock stats) ---

/**
 * Build a self-contained view-model for the `speclock stats` dashboard.
 * Pure data — no console I/O — so tests can assert against it.
 *
 * Combines three sources:
 *   1. Local telemetry log (~/.speclock/telemetry.jsonl) via buildUsageStats
 *   2. Current project brain.json (enforcement mode, lock count)
 *   3. Rule file discovery + MCP client detection (from a sample telemetry event)
 *
 * Falls back gracefully when telemetry is disabled or the log is missing —
 * the "Current State" section is still populated from brain.json.
 *
 * @param {string} root - project root
 * @param {object} [opts] - passed through to buildUsageStats (e.g. { events, now })
 */
export function buildStatsView(root, opts = {}) {
  const usage = buildUsageStats(opts);

  let lockCount = 0;
  let enforcementMode = "unknown";
  let brainExists = false;
  try {
    const brain = readBrain(root);
    if (brain) {
      brainExists = true;
      const items = brain.specLock && Array.isArray(brain.specLock.items)
        ? brain.specLock.items
        : [];
      lockCount = items.filter((l) => l && l.active !== false).length;
      const cfg = getEnforcementConfig(brain);
      // Map internal ("advisory" | "hard") to user-facing ("warn" | "hard").
      enforcementMode = cfg.mode === "hard" ? "hard" : "warn";
    }
  } catch (_) { /* swallow */ }

  // Rule files (from the same list guardian.js uses).
  let ruleFiles = [];
  try {
    const discovered = discoverRuleFiles(root);
    ruleFiles = discovered.map((f) => f.file);
  } catch (_) { /* swallow */ }

  // MCP clients — reuse the detector embedded in the sample telemetry event.
  let mcpClients = [];
  try {
    const sample = getOptInTelemetryStatus({ eventLimit: 0 }).sampleEvent;
    if (sample && Array.isArray(sample.mcpClientsConfigured)) {
      mcpClients = sample.mcpClientsConfigured;
    }
  } catch (_) { /* swallow */ }

  return {
    ...usage,
    brainExists,
    enforcementMode,
    lockCount,
    ruleFiles,
    mcpClients,
  };
}

/**
 * Render the stats view-model as a human-readable dashboard string.
 * Kept separate from console output so tests can assert on the rendered
 * text without capturing stdout.
 */
export function formatStatsDashboard(view) {
  const lines = [];
  const firstInstallDate = view.firstInstallIso
    ? view.firstInstallIso.slice(0, 10)
    : "(unknown)";
  const installIdShort = view.installId && view.installId !== "unknown"
    ? view.installId.slice(0, 8) + "..."
    : "(none)";

  lines.push("");
  lines.push("SpecLock Stats — Your Usage");
  lines.push("=".repeat(32));
  lines.push("");
  lines.push("Installation");
  lines.push(`  First install:   ${firstInstallDate}`);
  lines.push(`  Days active:     ${view.daysActive}`);
  lines.push(`  Total events:    ${view.totalEvents}`);
  lines.push(`  Install ID:      ${installIdShort}`);
  lines.push("");

  lines.push("Commands Used");
  const entries = Object.entries(view.commandsByType).sort(
    ([, a], [, b]) => b - a
  );
  if (entries.length === 0) {
    if (view.telemetryEnabled) {
      lines.push("  (no events recorded yet — run some commands!)");
    } else {
      lines.push("  (telemetry disabled — enable with 'speclock telemetry on' to track usage)");
    }
  } else {
    const maxName = Math.max(...entries.map(([n]) => n.length));
    for (const [name, count] of entries) {
      lines.push(`  ${(name + ":").padEnd(maxName + 2)}${count}`);
    }
  }
  lines.push("");

  lines.push("Current State");
  lines.push(`  Enforcement:  ${view.enforcementMode}`);
  lines.push(`  Locks:        ${view.lockCount}`);
  if (view.ruleFiles.length > 0) {
    lines.push(`  Rule files:   ${view.ruleFiles.length} (${view.ruleFiles.join(", ")})`);
  } else {
    lines.push("  Rule files:   0");
  }
  if (view.mcpClients.length > 0) {
    lines.push(`  MCP clients:  ${view.mcpClients.join(", ")}`);
  } else {
    lines.push("  MCP clients:  (none detected)");
  }
  lines.push("");

  lines.push(`Recent Activity (last ${view.recentEvents.length})`);
  if (view.recentEvents.length === 0) {
    lines.push("  (no activity recorded)");
  } else {
    // Most recent first in the dashboard.
    const sorted = view.recentEvents.slice().reverse();
    for (const e of sorted) {
      const ts = (e.timestamp || "").replace("T", " ").slice(0, 16);
      const cmd = (e.command || "unknown").padEnd(10);
      const exit = typeof e.exitCode === "number" ? e.exitCode : "?";
      lines.push(`  ${ts}  ${cmd}  exit ${exit}`);
    }
  }
  lines.push("");

  if (!view.telemetryEnabled) {
    lines.push("Note: telemetry is DISABLED — stats above reflect any pre-existing log");
    lines.push("      plus the current project state from .speclock/brain.json.");
  }
  lines.push("Tip: Run 'speclock telemetry status' to see telemetry settings");
  lines.push("");

  return lines.join("\n");
}

// --- Main ---

async function main() {
  let { cmd, args } = parseArgs(process.argv);
  const root = rootDir();

  // Fire-and-forget telemetry: hook process exit so we record every
  // invocation exactly once with its final exit code. Wrapped in try/catch
  // so telemetry failures can never block or break the CLI.
  try {
    process.once("exit", (code) => {
      try {
        recordCommand(cmd || "unknown", typeof code === "number" ? code : 0, {
          projectRoot: root,
        });
      } catch (_) { /* swallow */ }
    });
  } catch (_) { /* swallow */ }

  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    printHelp();
    process.exit(0);
  }

  // Dispatch loop — allows certain commands to rewrite `cmd`/`args` and
  // `continue dispatch` to re-enter the command switch (used by
  // `audit --pre-commit` to delegate to `audit-semantic`).
  // eslint-disable-next-line no-labels
  dispatch: while (true) {
  // --- SETUP (new: one-shot full setup) ---
  if (cmd === "setup") {
    const flags = parseFlags(args);
    const goalText = flags.goal || flags._.join(" ").trim();

    // 1. Initialize
    ensureInit(root);
    console.log("Initialized .speclock/ directory.");

    // 2. Set goal if provided
    if (goalText) {
      setGoal(root, goalText);
      console.log(`Goal set: "${goalText}"`);
    }

    // 3. Create SPECLOCK.md in project root
    const mdPath = createSpecLockMd(root);
    console.log(`Created SPECLOCK.md (AI instructions file).`);

    // 4. Inject marker into package.json (so AI tools auto-discover SpecLock)
    //    — only when package.json actually exists. We do NOT create one.
    const pkgJsonPath = path.join(root, "package.json");
    const pkgJsonExistedBefore = fs.existsSync(pkgJsonPath);
    let pkgJsonUpdated = false;
    if (pkgJsonExistedBefore) {
      const pkgResult = injectPackageJsonMarker(root);
      if (pkgResult.success) {
        pkgJsonUpdated = true;
        console.log("Injected SpecLock marker into package.json.");
      }
    }

    // 5. Apply template if specified
    if (flags.template) {
      const result = applyTemplate(root, flags.template);
      if (result.applied) {
        console.log(`Applied template "${result.displayName}": ${result.locksAdded} lock(s), ${result.decisionsAdded} decision(s).`);
      } else {
        console.error(`Template error: ${result.error}`);
      }
    }

    // 6. Generate context
    generateContext(root);
    console.log("Generated .speclock/context/latest.md");

    // 7. Print summary
    const pkgJsonLine = pkgJsonUpdated
      ? "  package.json                  — Active locks embedded (AI auto-discovery)"
      : "  package.json (skipped — not found)";
    console.log(`
SpecLock is ready!

Files created/updated:
  .speclock/brain.json          — Project memory
  .speclock/context/latest.md   — Context for AI (read this)
  SPECLOCK.md                   — AI rules (read this)
${pkgJsonLine}

Next steps:
  To add constraints:  npx speclock lock "Never touch auth files"
  To check conflicts:  npx speclock check "Modifying auth page"
  To sync to AI tools: npx speclock sync --all
  To replay sessions:  npx speclock replay
  To see status:       npx speclock status
${!flags.template ? `
Quick start templates:
  npx speclock template apply safe-defaults     — Prevent the 5 most common AI disasters
  npx speclock template apply solo-founder      — Essential protection for indie builders
  npx speclock template apply hipaa             — HIPAA healthcare compliance (8 locks)
  npx speclock template apply api-stability     — Protect your public API contracts
` : ""}
Tip: Run "speclock sync --all" to push constraints to Cursor, Claude, Copilot, Windsurf, and more.
`);
    return;
  }

  // --- INIT ---
  if (cmd === "init") {
    const flags = parseFlags(args);

    // init --from <framework> : bootstrap CLAUDE.md from a curated rule pack
    if (flags.from) {
      const framework = String(flags.from).trim().toLowerCase();
      const result = initFromRulePack(root, framework);
      if (result.listed) {
        // Already printed list, nothing else to do.
        return;
      }
      if (!result.ok) {
        console.error(result.error);
        process.exit(1);
      }
      // Fall through into the rest of the protect flow so the rule pack is
      // actually activated (locks extracted, hook installed, context refreshed).
      const report = protect(root, { strict: false });
      console.log(formatProtectReport(report));
      try {
        setEnforcementMode(root, "advisory");
      } catch (_) { /* ignore */ }
      console.log(
        `✓ Initialized SpecLock with ${result.displayName} rule pack ` +
        `(${result.ruleCount} rules). Edit CLAUDE.md to customize.`
      );
      if (result.appended) {
        console.log(
          "  Note: CLAUDE.md already existed — rule pack was APPENDED, not overwritten."
        );
      }
      return;
    }

    ensureInit(root);
    createSpecLockMd(root);
    injectPackageJsonMarker(root);
    generateContext(root);
    console.log("SpecLock initialized. Created SPECLOCK.md, updated package.json, and generated context file.");
    return;
  }

  // --- GOAL ---
  if (cmd === "goal") {
    const text = args.join(" ").trim();
    if (!text) {
      console.error("Error: Goal text is required.");
      console.error("Usage: speclock goal <text>");
      process.exit(1);
    }
    setGoal(root, text);
    refreshContext(root);
    console.log(`Goal set: "${text}"`);
    return;
  }

  // --- LOCK ---
  if (cmd === "lock") {
    // Check for "lock remove <id>"
    if (args[0] === "remove") {
      const lockId = args[1];
      if (!lockId) {
        console.error("Error: Lock ID is required.");
        console.error("Usage: speclock lock remove <lockId>");
        process.exit(1);
      }
      const result = removeLock(root, lockId);
      if (result.removed) {
        // Sync updated locks to package.json
        syncLocksToPackageJson(root);
        refreshContext(root);
        console.log(`Lock removed: "${result.lockText}"`);
      } else {
        console.error(result.error);
        process.exit(1);
      }
      return;
    }

    const flags = parseFlags(args);
    const text = flags._.join(" ").trim();
    if (!text) {
      console.error("Error: Lock text is required.");
      console.error("Usage: speclock lock <text> [--tags a,b] [--source user]");
      process.exit(1);
    }
    const { lockId, rewritten, rewriteReason } = addLock(root, text, parseTags(flags.tags), flags.source || "user");

    // Auto-guard related files (Solution 1)
    const guardResult = autoGuardRelatedFiles(root, text);
    if (guardResult.guarded.length > 0) {
      console.log(`Auto-guarded ${guardResult.guarded.length} related file(s):`);
      for (const f of guardResult.guarded) {
        console.log(`  🔒 ${f}`);
      }
    }

    // Sync locks to package.json (Solution 2)
    const syncResult = syncLocksToPackageJson(root);
    if (syncResult.success) {
      console.log(`Synced ${syncResult.lockCount} lock(s) to package.json.`);
    }

    refreshContext(root);
    console.log(`Locked (${lockId}): "${text}"`);
    if (rewritten) {
      console.log(`  Note: Engine optimized for detection. Your original text is preserved.`);
    }
    return;
  }

  // --- DECIDE ---
  if (cmd === "decide") {
    const flags = parseFlags(args);
    const text = flags._.join(" ").trim();
    if (!text) {
      console.error("Error: Decision text is required.");
      console.error("Usage: speclock decide <text> [--tags a,b]");
      process.exit(1);
    }
    const { decId } = addDecision(root, text, parseTags(flags.tags), flags.source || "user");
    refreshContext(root);
    console.log(`Decision recorded (${decId}): "${text}"`);
    return;
  }

  // --- NOTE ---
  if (cmd === "note") {
    const flags = parseFlags(args);
    const text = flags._.join(" ").trim();
    if (!text) {
      console.error("Error: Note text is required.");
      console.error("Usage: speclock note <text> [--pinned]");
      process.exit(1);
    }
    const pinned = flags.pinned !== false;
    const { noteId } = addNote(root, text, pinned);
    refreshContext(root);
    console.log(`Note added (${noteId}): "${text}"`);
    return;
  }

  // --- LOG-CHANGE (new) ---
  if (cmd === "log-change") {
    const flags = parseFlags(args);
    const text = flags._.join(" ").trim();
    if (!text) {
      console.error("Error: Change summary is required.");
      console.error('Usage: speclock log-change "what changed" --files a.ts,b.ts');
      process.exit(1);
    }
    const files = flags.files ? flags.files.split(",").map((f) => f.trim()).filter(Boolean) : [];
    logChange(root, text, files);
    refreshContext(root);
    console.log(`Change logged: "${text}"`);
    if (files.length > 0) {
      console.log(`Files: ${files.join(", ")}`);
    }
    return;
  }

  // --- CHECK (new: conflict check) ---
  if (cmd === "check") {
    const text = args.join(" ").trim();
    if (!text) {
      console.error("Error: Action description is required.");
      console.error('Usage: speclock check "what you plan to do"');
      process.exit(1);
    }
    // Use async version for Gemini proxy coverage on grey-zone cases
    const result = await enforceConflictCheckAsync(root, text);
    if (result.hasConflict) {
      console.log(`\n${result.blocked ? "BLOCKED" : "CONFLICT DETECTED"}`);
      console.log("=".repeat(50));
      console.log(`Mode: ${result.mode} | Threshold: ${result.threshold}%`);
      console.log("");
      for (const lock of result.conflictingLocks) {
        console.log(`  [${lock.level}] "${lock.text}"`);
        console.log(`  Confidence: ${lock.confidence}%`);
        if (lock.reasons && lock.reasons.length > 0) {
          for (const reason of lock.reasons) {
            console.log(`  - ${reason}`);
          }
        }
        console.log("");
      }
      console.log(result.analysis);
      if (result.blocked) {
        process.exit(1);
      }
    } else {
      console.log(`No conflicts found. Safe to proceed with: "${text}"`);
    }
    return;
  }

  // --- GUARD (new: file-level lock) ---
  if (cmd === "guard") {
    const flags = parseFlags(args);
    const filePath = flags._[0];
    if (!filePath) {
      console.error("Error: File path is required.");
      console.error('Usage: speclock guard <file> --lock "constraint text"');
      process.exit(1);
    }
    const lockText = flags.lock || "This file is locked by SpecLock. Do not modify.";
    const result = guardFile(root, filePath, lockText);
    if (result.success) {
      console.log(`Guarded: ${filePath}`);
      console.log(`Lock warning injected: "${lockText}"`);
    } else {
      console.error(result.error);
      process.exit(1);
    }
    return;
  }

  // --- UNGUARD ---
  if (cmd === "unguard") {
    const filePath = args[0];
    if (!filePath) {
      console.error("Error: File path is required.");
      console.error("Usage: speclock unguard <file>");
      process.exit(1);
    }
    const result = unguardFile(root, filePath);
    if (result.success) {
      console.log(`Unguarded: ${filePath}`);
    } else {
      console.error(result.error);
      process.exit(1);
    }
    return;
  }

  // --- PROTECT (zero-config guardian mode) ---
  if (cmd === "protect") {
    // First-run opt-in prompt (only on the first 'protect' ever, only on TTY).
    try {
      if (!hasTelemetryDecision()) {
        await ensureTelemetryDecision();
      }
    } catch (_) { /* swallow — telemetry must never block protect */ }

    const flags = parseFlags(args);
    const strict = flags.strict === true || flags.block === true;
    const opts = {
      skipHook: flags["no-hook"] === true,
      skipSync: flags["no-sync"] === true,
      strict,
    };
    const report = protect(root, opts);
    console.log(formatProtectReport(report));

    // Set persistent enforcement mode on the brain so the hook honours it.
    // Default is "advisory" (warn). Users opt in to hard blocks with --strict.
    try {
      setEnforcementMode(root, strict ? "hard" : "advisory");
    } catch (_) { /* ignore — brain may not exist yet */ }

    if (strict) {
      console.log("  Hard enforcement active. Every commit that violates a lock will be BLOCKED.");
      console.log("  To relax: speclock protect   (without --strict)");
    } else {
      console.log("  Warning mode active. To enforce hard blocks, run: speclock protect --strict");
      console.log("  Violations will be printed at commit time but commits will NOT be blocked.");
    }
    console.log("");

    if (report.errors.length > 0 && report.discovered.length === 0) {
      process.exit(1);
    }
    return;
  }

  // --- FACTS ---
  if (cmd === "facts") {
    const sub = args.shift();
    if (sub !== "deploy") {
      console.error("Error: Only 'facts deploy' is supported.");
      console.error(
        "Usage: speclock facts deploy --provider X --branch Y"
      );
      process.exit(1);
    }
    const flags = parseFlags(args);
    const payload = {
      provider: flags.provider,
      branch: flags.branch,
      notes: flags.notes,
      url: flags.url,
    };
    if (flags.autoDeploy !== undefined) {
      payload.autoDeploy =
        String(flags.autoDeploy).toLowerCase() === "true";
    }
    updateDeployFacts(root, payload);
    refreshContext(root);
    console.log("Deploy facts updated.");
    return;
  }

  // --- CONTEXT ---
  if (cmd === "context") {
    const md = generateContext(root);
    console.log(md);
    return;
  }

  // --- WATCH ---
  if (cmd === "watch") {
    await watchRepo(root);
    return;
  }

  // --- SERVE ---
  if (cmd === "serve") {
    // Start MCP server — pass through --project if provided
    const flags = parseFlags(args);
    const projectArg = flags.project || root;
    process.env.SPECLOCK_PROJECT_ROOT = projectArg;
    await import("../mcp/server.js");
    return;
  }

  // --- MCP INSTALL / UNINSTALL ---
  // One-command autoinstaller: wires SpecLock into Claude Code, Cursor,
  // Windsurf, Cline, Codex (or all of them) without any JSON hand-editing.
  if (cmd === "mcp") {
    const sub = args[0];
    const client = args[1];
    const flags = parseFlags(args.slice(2));

    const supportedLabel = SUPPORTED_CLIENTS.join(", ");

    if (!sub || (sub !== "install" && sub !== "uninstall")) {
      console.error("Usage:");
      console.error(`  speclock mcp install <client>     (${supportedLabel})`);
      console.error(`  speclock mcp uninstall <client>`);
      console.error("");
      console.error("Flags:");
      console.error("  --no-project     Skip project-scoped config (.mcp.json, .cursor/mcp.json)");
      process.exit(1);
    }

    if (!client) {
      console.error(`Error: <client> is required.`);
      console.error(`Supported: ${supportedLabel}`);
      process.exit(1);
    }

    if (!SUPPORTED_CLIENTS.includes(client)) {
      console.error(`Unknown client "${client}".`);
      console.error(`Supported: ${supportedLabel}`);
      process.exit(1);
    }

    const options = {
      includeProject: flags["no-project"] !== true,
    };

    const isInstall = sub === "install";
    const header = isInstall
      ? "\nSpecLock MCP — Autoinstaller"
      : "\nSpecLock MCP — Uninstaller";
    console.log(header);
    console.log("=".repeat(50));

    let results;
    if (client === "all") {
      results = isInstall
        ? installAll(root, options)
        : uninstallAll(root, options);
    } else {
      results = [
        isInstall
          ? installForClient(client, root, options)
          : uninstallForClient(client, root, options),
      ];
    }

    let anySuccess = false;
    let anyError = false;

    for (const r of results) {
      console.log(`\n  ${r.client}:`);
      console.log(formatResult(r, sub));
      if (r.errors.length > 0) anyError = true;
      if (
        r.writes.some(
          (w) => w.status === "installed" || w.status === "removed"
        )
      ) {
        anySuccess = true;
      }
    }

    console.log("");
    if (isInstall && anySuccess) {
      console.log("  Next steps:");
      if (client === "all") {
        console.log("    Restart any AI clients that were updated.");
      } else {
        console.log(`    ${nextStepsFor(client)}`);
      }
      console.log("");
      console.log("  Verify: speclock status");
    } else if (!isInstall && anySuccess) {
      console.log("  SpecLock MCP server removed. Restart your AI client to apply.");
    } else if (!anySuccess && !anyError) {
      console.log(
        isInstall
          ? "  SpecLock was already installed everywhere. Nothing to do."
          : "  SpecLock was not installed anywhere. Nothing to do."
      );
    }

    process.exit(anyError ? 1 : 0);
  }

  // --- TEMPLATE ---
  if (cmd === "template") {
    const sub = args[0];
    if (sub === "list" || !sub) {
      const templates = listTemplates();
      console.log("\nAvailable Templates:");
      console.log("=".repeat(50));
      for (const t of templates) {
        console.log(`  ${t.name.padEnd(20)} ${t.displayName} — ${t.description}`);
        console.log(`  ${"".padEnd(20)} ${t.lockCount} lock(s), ${t.decisionCount} decision(s)`);
        console.log("");
      }
      console.log("Apply: npx speclock template apply <name>");
      return;
    }
    if (sub === "apply") {
      const name = args[1];
      if (!name) {
        console.error("Error: Template name is required.");
        console.error("Usage: speclock template apply <name>");
        console.error("Run 'speclock template list' to see available templates.");
        process.exit(1);
      }
      const result = applyTemplate(root, name);
      if (result.applied) {
        refreshContext(root);
        console.log(`Template "${result.displayName}" applied successfully!`);
        console.log(`  Locks added: ${result.locksAdded}`);
        console.log(`  Decisions added: ${result.decisionsAdded}`);
      } else {
        console.error(result.error);
        process.exit(1);
      }
      return;
    }
    console.error(`Unknown template command: ${sub}`);
    console.error("Usage: speclock template list | speclock template apply <name>");
    process.exit(1);
  }

  // --- REPORT ---
  if (cmd === "report") {
    const report = generateReport(root);
    console.log("\nSpecLock Violation Report");
    console.log("=".repeat(50));
    console.log(`Total violations blocked: ${report.totalViolations}`);
    if (report.timeRange) {
      console.log(`Period: ${report.timeRange.from.substring(0, 10)} to ${report.timeRange.to.substring(0, 10)}`);
    }
    if (report.mostTestedLocks.length > 0) {
      console.log("\nMost tested locks:");
      for (const lock of report.mostTestedLocks) {
        console.log(`  ${lock.count}x — "${lock.text}"`);
      }
    }
    if (report.recentViolations.length > 0) {
      console.log("\nRecent violations:");
      for (const v of report.recentViolations) {
        console.log(`  [${v.at.substring(0, 19)}] ${v.topLevel} (${v.topConfidence}%) — "${v.action.substring(0, 60)}"`);
      }
    }
    console.log(`\n${report.summary}`);
    return;
  }

  // --- HOOK ---
  if (cmd === "hook") {
    const sub = args[0];
    if (sub === "install") {
      const result = installHook(root);
      if (result.success) {
        console.log(result.message);
      } else {
        console.error(result.error);
        process.exit(1);
      }
      return;
    }
    if (sub === "remove") {
      const result = removeHook(root);
      if (result.success) {
        console.log(result.message);
      } else {
        console.error(result.error);
        process.exit(1);
      }
      return;
    }
    console.error("Usage: speclock hook install | speclock hook remove");
    process.exit(1);
  }

  // --- AUDIT ---
  if (cmd === "audit") {
    const flags = parseFlags(args);
    // When invoked from the pre-commit hook (either new or legacy), always
    // route to the semantic audit path so the commit message + diff content
    // are actually fed through the semantic conflict engine. We do this by
    // rewriting cmd/args so the audit-semantic branch below picks it up on
    // the next iteration of the outer dispatch loop.
    if (flags["pre-commit"] === true) {
      cmd = "audit-semantic";
      args = args.filter((a) => a !== "--pre-commit");
      // Skip the rest of this audit block; dispatch loop will re-enter.
      // (See `dispatch:` label wrapping the command switch.)
      // eslint-disable-next-line no-labels
      continue dispatch;
    }
    // Warn mode is the default (investor audit: hard-block had too many false positives).
    // Users opt in to hard blocking with --strict, SPECLOCK_STRICT=1, or by running
    // `speclock enforce hard` (which sets the persistent brain enforcement mode).
    const brain = readBrain(root);
    const brainMode = brain ? (getEnforcementConfig(brain).mode || "advisory") : "advisory";
    const strict =
      flags.strict === true ||
      flags.block === true ||
      process.env.SPECLOCK_STRICT === "1" ||
      process.env.SPECLOCK_STRICT === "true" ||
      brainMode === "hard";

    const result = auditStagedFiles(root);
    if (result.passed) {
      console.log(result.message);
      process.exit(0);
    }

    // Violations found — print them for both warn and strict modes.
    const header = strict ? "SPECLOCK AUDIT FAILED" : "SPECLOCK WARNINGS";
    console.log(`\n${header}`);
    console.log("=".repeat(50));
    for (const v of result.violations) {
      console.log(`  [${v.severity}] ${v.file}`);
      console.log(`    Lock: ${v.lockText}`);
      console.log(`    Reason: ${v.reason}`);
      console.log("");
    }
    console.log(result.message);

    if (strict) {
      console.log("Commit blocked. Unlock files or unstage them to proceed.");
      process.exit(1);
    }

    console.log("Warning mode active — commit allowed. To enforce hard blocks, run:");
    console.log("  speclock audit --strict");
    console.log("  SPECLOCK_STRICT=1 git commit ...");
    console.log("  speclock enforce hard   (persistent, project-wide)");
    process.exit(0);
  }

  // --- AUDIT-VERIFY (v2.1 enterprise) ---
  if (cmd === "audit-verify") {
    ensureInit(root);
    const result = verifyAuditChain(root);
    console.log(`\nAudit Chain Verification`);
    console.log("=".repeat(50));
    console.log(`Status: ${result.valid ? "VALID" : "BROKEN"}`);
    console.log(`Total events: ${result.totalEvents}`);
    console.log(`Hashed events: ${result.hashedEvents}`);
    console.log(`Legacy events (pre-v2.1): ${result.unhashedEvents}`);
    if (!result.valid && result.errors) {
      console.log(`\nErrors:`);
      for (const err of result.errors) {
        console.log(`  Line ${err.line}: ${err.error}`);
      }
    }
    console.log(`\n${result.message}`);
    process.exit(result.valid ? 0 : 1);
  }

  // --- EXPORT (v2.1 enterprise) ---
  if (cmd === "export") {
    const flags = parseFlags(args);
    const format = flags.format;
    if (!format || !["soc2", "hipaa", "csv"].includes(format)) {
      console.error("Error: Valid format is required.");
      console.error("Usage: speclock export --format <soc2|hipaa|csv>");
      process.exit(1);
    }
    ensureInit(root);
    const result = exportCompliance(root, format);
    if (result.error) {
      console.error(result.error);
      process.exit(1);
    }
    if (format === "csv") {
      console.log(result.data);
    } else {
      console.log(JSON.stringify(result.data, null, 2));
    }
    return;
  }

  // --- LICENSE (v2.1 enterprise) ---
  if (cmd === "license") {
    const info = getLicenseInfo(root);
    console.log(`\nSpecLock License Info`);
    console.log("=".repeat(50));
    console.log(`Tier: ${info.tier} (${info.tierKey})`);
    if (info.expiresAt) console.log(`Expires: ${info.expiresAt}`);
    if (info.expired) console.log(`STATUS: EXPIRED — reverted to Free tier`);
    console.log(`\nUsage:`);
    if (info.usage) {
      const { locks, decisions, events } = info.usage;
      console.log(`  Locks: ${locks.current}/${locks.max === Infinity ? "unlimited" : locks.max}`);
      console.log(`  Decisions: ${decisions.current}/${decisions.max === Infinity ? "unlimited" : decisions.max}`);
      console.log(`  Events: ${events.current}/${events.max === Infinity ? "unlimited" : events.max}`);
    }
    if (info.warnings && info.warnings.length > 0) {
      console.log(`\nWarnings:`);
      for (const w of info.warnings) console.log(`  - ${w}`);
    }
    console.log(`\nFeatures: ${info.features.join(", ")}`);
    return;
  }

  // --- ENFORCE (v2.5) ---
  if (cmd === "enforce") {
    const mode = args[0];
    if (!mode || (mode !== "advisory" && mode !== "hard")) {
      console.error("Usage: speclock enforce <advisory|hard> [--threshold 70]");
      process.exit(1);
    }
    const flags = parseFlags(args.slice(1));
    const options = {};
    if (flags.threshold) options.blockThreshold = parseInt(flags.threshold, 10);
    if (flags.override !== undefined) options.allowOverride = flags.override !== "false";
    const result = setEnforcementMode(root, mode, options);
    if (!result.success) {
      console.error(result.error);
      process.exit(1);
    }
    console.log(`\nEnforcement mode: ${result.mode.toUpperCase()}`);
    console.log(`Block threshold: ${result.config.blockThreshold}%`);
    console.log(`Overrides: ${result.config.allowOverride ? "allowed" : "disabled"}`);
    if (result.mode === "hard") {
      console.log(`\nHard mode active — conflicts above ${result.config.blockThreshold}% confidence will BLOCK actions.`);
    }
    return;
  }

  // --- OVERRIDE (v2.5) ---
  if (cmd === "override") {
    const lockId = args[0];
    const reason = args.slice(1).join(" ");
    if (!lockId || !reason) {
      console.error("Usage: speclock override <lockId> <reason>");
      process.exit(1);
    }
    const result = overrideLock(root, lockId, "(CLI override)", reason);
    if (!result.success) {
      console.error(result.error);
      process.exit(1);
    }
    console.log(`Lock overridden: "${result.lockText}"`);
    console.log(`Override count: ${result.overrideCount}`);
    if (result.escalated) {
      console.log(`\n${result.escalationMessage}`);
    }
    return;
  }

  // --- OVERRIDES (v2.5) ---
  if (cmd === "overrides") {
    const flags = parseFlags(args);
    const result = getOverrideHistory(root, flags.lock || null);
    if (result.total === 0) {
      console.log("No overrides recorded.");
      return;
    }
    console.log(`\nOverride History (${result.total})`);
    console.log("=".repeat(50));
    for (const o of result.overrides) {
      console.log(`[${o.at.substring(0, 19)}] Lock: "${o.lockText}"`);
      console.log(`  Action: ${o.action}`);
      console.log(`  Reason: ${o.reason}`);
      console.log("");
    }
    return;
  }

  // --- AUDIT-SEMANTIC (v2.5) ---
  if (cmd === "audit-semantic") {
    const flags = parseFlags(args);
    const verbose =
      flags.verbose === true ||
      process.env.SPECLOCK_VERBOSE === "1" ||
      process.env.SPECLOCK_VERBOSE === "true";
    const result = semanticAudit(root);

    // --- Commit-message + diff-content semantic check ---
    // The diff-level semanticAudit() above only inspects per-file change
    // summaries. It does NOT see the commit message, and its summaries can
    // miss short fragments like "delete user data" that collide with locks
    // such as "NEVER delete user data". Here we explicitly build a combined
    // "action description" from the commit message + every added line and
    // run it through enforceConflictCheck — the same engine used by
    // `speclock check`.
    const extraViolations = [];
    try {
      // 1. Read commit message (.git/COMMIT_EDITMSG is written by git BEFORE
      //    pre-commit hooks run).
      let commitMsg = "";
      const editMsgPath = path.join(root, ".git", "COMMIT_EDITMSG");
      if (fs.existsSync(editMsgPath)) {
        try {
          commitMsg = fs.readFileSync(editMsgPath, "utf-8")
            .split("\n")
            .filter((l) => !l.trim().startsWith("#"))
            .join("\n")
            .trim();
        } catch { /* ignore */ }
      }

      // 2. Collect added lines from the staged diff, skipping SpecLock-internal
      //    files (see shouldSkipForSemanticAudit). Those files' contents literally
      //    restate the locks, so scanning their added lines produces 100%
      //    false-positive matches for every lock in the brain.
      const diffText = getStagedDiff(root);
      const allParsedChanges = diffText ? parseDiff(diffText) : [];
      const fileChanges = allParsedChanges.filter(
        (fc) => !shouldSkipForSemanticAudit(fc.file, root)
      );
      const addedSnippets = [];
      for (const fc of fileChanges) {
        for (const line of fc.addedLines) {
          // Strip common comment markers so "// delete user data" becomes
          // "delete user data" for the semantic engine.
          const cleaned = line
            .replace(/^\s*(\/\/|#|\/\*+|\*+\/?|--|<!--|-->|;)\s*/, "")
            .replace(/\*\/\s*$/, "")
            .replace(/-->\s*$/, "")
            .trim();
          if (cleaned) addedSnippets.push(cleaned);
        }
      }

      // 3. Build a combined action description. We check the commit message
      //    as one unit (highest priority), then individual added snippets.
      const actionsToCheck = [];
      if (commitMsg) {
        actionsToCheck.push({ kind: "commit message", text: commitMsg });
      }
      // Cap added snippets to avoid blowing up the check loop on huge diffs.
      for (const snip of addedSnippets.slice(0, 100)) {
        actionsToCheck.push({ kind: "added code", text: snip });
      }

      if (actionsToCheck.length > 0) {
        for (const item of actionsToCheck) {
          const check = enforceConflictCheck(root, item.text);
          if (check.hasConflict && check.conflictingLocks.length > 0) {
            for (const lock of check.conflictingLocks) {
              extraViolations.push({
                file: item.kind === "commit message" ? "(commit message)" : "(staged diff)",
                lockId: lock.id,
                lockText: lock.text,
                confidence: lock.confidence,
                level: lock.level,
                reason: `${item.kind}: "${item.text.substring(0, 80)}" — ${(lock.reasons || []).join("; ")}`,
                source: "commit-msg-semantic",
              });
            }
          }
        }
      }
    } catch (err) {
      // Never fail the hook on internal errors — just note it.
      console.log(`(speclock: commit-message semantic check skipped: ${err.message})`);
    }

    // Merge + dedupe by lockId+source-ish key, keeping highest confidence.
    if (extraViolations.length > 0) {
      const merged = [...result.violations, ...extraViolations];
      const bestByKey = new Map();
      for (const v of merged) {
        const key = `${v.file}::${v.lockId || v.lockText}`;
        const existing = bestByKey.get(key);
        if (!existing || (v.confidence || 0) > (existing.confidence || 0)) {
          bestByKey.set(key, v);
        }
      }
      result.violations = [...bestByKey.values()].sort(
        (a, b) => (b.confidence || 0) - (a.confidence || 0)
      );
      // Recompute blocked state against the configured threshold.
      const threshold = result.threshold || 70;
      if (result.mode === "hard") {
        result.blocked = result.violations.some((v) => (v.confidence || 0) >= threshold);
      }
      result.passed = result.violations.length === 0;
      result.message = result.blocked
        ? `BLOCKED: ${result.violations.length} violation(s) detected. Hard enforcement active — commit rejected.`
        : `WARNING: ${result.violations.length} violation(s) detected. Review before proceeding.`;
    }

    // Warn mode default: only exit 1 if --strict, SPECLOCK_STRICT=1, or brain is in "hard" mode.
    //
    // Enforcement mode precedence (first match wins):
    //   1. --strict / --block CLI flag
    //   2. SPECLOCK_STRICT=1 env var
    //   3. brain.enforcement.mode === "hard" from .speclock/brain.json
    //   4. Default: warn mode (exit 0)
    //
    // We re-read brain.json here as a belt-and-braces fallback because
    // semanticAudit() may early-return (no staged diff, no locks, brain
    // missing) WITHOUT setting result.mode/result.blocked, and git hooks
    // can run in sanitized environments where SPECLOCK_STRICT=1 on the
    // `git commit` command line gets stripped by some shells. The
    // persistent brain mode (set by `speclock enforce hard`) is the only
    // reliable way to enforce hard blocking across all git/shell combos.
    const cliStrict = flags.strict === true || flags.block === true;
    const envStrict =
      process.env.SPECLOCK_STRICT === "1" ||
      process.env.SPECLOCK_STRICT === "true";

    let brainHardMode = false;
    try {
      const brainForMode = readBrain(root);
      if (brainForMode) {
        const cfg = getEnforcementConfig(brainForMode);
        brainHardMode = cfg.mode === "hard";
      }
    } catch { /* brain unreadable — treat as advisory */ }

    // If brain is in hard mode but semanticAudit() returned without
    // reflecting that (early-return path), retro-fit the result so the
    // downstream printing + blocking decision stays consistent.
    if (brainHardMode && result.mode !== "hard") {
      result.mode = "hard";
      if (result.threshold === undefined) result.threshold = 70;
    }
    if (brainHardMode && !result.blocked) {
      const thresh = result.threshold || 70;
      result.blocked = (result.violations || []).some(
        (v) => (v.confidence || 0) >= thresh
      );
    }

    const strict = cliStrict || envStrict || brainHardMode || result.blocked;

    // --- Three-tier output filter (v5.5.7) ---
    // Investor audit: walls of LOW-confidence matches are user-hostile.
    // Only HIGH and MEDIUM print by default. LOW rolls up into a one-liner.
    // --verbose / SPECLOCK_VERBOSE=1 shows everything.
    const OUTPUT_MIN_CONFIDENCE = 40;  // below this = "LOW", hidden by default
    const MAX_VISIBLE_VIOLATIONS = 10; // hard cap on printed items

    const allViolations = result.violations || [];
    const highViolations = allViolations.filter((v) => (v.confidence || 0) >= 70);
    const mediumViolations = allViolations.filter(
      (v) => (v.confidence || 0) >= OUTPUT_MIN_CONFIDENCE && (v.confidence || 0) < 70
    );
    const lowViolations = allViolations.filter(
      (v) => (v.confidence || 0) < OUTPUT_MIN_CONFIDENCE
    );

    // What actually gets printed
    const visibleViolations = verbose
      ? allViolations
      : [...highViolations, ...mediumViolations];

    console.log(`\nSemantic Pre-Commit Audit`);
    console.log("=".repeat(50));
    console.log(`Mode: ${result.mode} | Threshold: ${result.threshold}%`);
    const filesLine = result.filesSkipped
      ? `Files analyzed: ${result.filesChecked} (${result.filesSkipped} skipped)`
      : `Files analyzed: ${result.filesChecked}`;
    console.log(filesLine);
    console.log(`Active locks: ${result.activeLocks}`);

    if (visibleViolations.length > 0) {
      console.log("");
      const toPrint = visibleViolations.slice(0, MAX_VISIBLE_VIOLATIONS);
      for (const v of toPrint) {
        console.log(`  [${v.level}] ${v.file} (confidence: ${v.confidence}%)`);
        console.log(`    Lock: "${v.lockText}"`);
        console.log(`    Reason: ${v.reason}`);
        if (v.addedLines !== undefined) {
          console.log(`    Changes: +${v.addedLines} / -${v.removedLines} lines`);
        }
      }
      const hiddenByCap = visibleViolations.length - toPrint.length;
      if (hiddenByCap > 0) {
        console.log(`  ... + ${hiddenByCap} more (output capped at ${MAX_VISIBLE_VIOLATIONS})`);
      }
    }

    // LOW-confidence rollup
    if (!verbose && lowViolations.length > 0) {
      console.log(
        `  + ${lowViolations.length} low-confidence match(es) hidden (use --verbose or SPECLOCK_VERBOSE=1 to see)`
      );
    }

    // --- New summary line ---
    console.log("");
    let summaryLine;
    if (highViolations.length === 0 && mediumViolations.length === 0) {
      summaryLine = `[OK] ${result.filesChecked} file(s) checked, no concerns.`;
    } else if (highViolations.length > 0) {
      summaryLine = `[!] ${highViolations.length} HIGH-confidence concern(s) — review before merging.`;
    } else {
      summaryLine = `[i] ${mediumViolations.length} medium-confidence note(s) (informational).`;
    }
    console.log(summaryLine);

    // Preserve the machine-readable status message for any callers that grep for it
    if (result.blocked) {
      console.log(
        `BLOCKED: ${highViolations.length} high-confidence violation(s) — hard enforcement active.`
      );
    }

    if (highViolations.length > 0 && !strict) {
      console.log("\nWarning mode active — commit allowed. To enforce hard blocks, run:");
      console.log("  speclock audit-semantic --strict");
      console.log("  SPECLOCK_STRICT=1 git commit ...");
      console.log("  speclock enforce hard   (persistent, project-wide)");
    }

    // Blocking decision is still driven by the engine's 70% threshold, so
    // only HIGH-confidence matches can ever cause a non-zero exit.
    process.exit(strict && highViolations.length > 0 ? 1 : 0);
  }

  // --- AUTH (v3.0) ---
  if (cmd === "auth") {
    const sub = args[0];
    if (!sub || sub === "status") {
      const enabled = isAuthEnabled(root);
      console.log(`\nAuth Status: ${enabled ? "ENABLED" : "DISABLED"}`);
      if (enabled) {
        const keys = listApiKeys(root);
        const active = keys.keys.filter(k => k.active);
        console.log(`Active keys: ${active.length}`);
        for (const k of active) {
          console.log(`  ${k.id} — ${k.name} (${k.role}) — last used: ${k.lastUsed || "never"}`);
        }
      } else {
        console.log("Run 'speclock auth create-key --role admin' to enable auth.");
      }
      return;
    }
    if (sub === "create-key") {
      const flags = parseFlags(args.slice(1));
      const role = flags.role || "developer";
      const name = flags.name || flags._.join(" ") || "";
      const result = createApiKey(root, role, name);
      if (!result.success) {
        console.error(result.error);
        process.exit(1);
      }
      console.log(`\nAPI Key Created`);
      console.log("=".repeat(50));
      console.log(`Key ID:  ${result.keyId}`);
      console.log(`Role:    ${result.role}`);
      console.log(`Name:    ${result.name}`);
      console.log(`\nRaw Key: ${result.rawKey}`);
      console.log(`\nSave this key — it CANNOT be retrieved later.`);
      console.log(`\nUsage:`);
      console.log(`  HTTP:  Authorization: Bearer ${result.rawKey}`);
      console.log(`  MCP:   Set SPECLOCK_API_KEY=${result.rawKey} in MCP config`);
      return;
    }
    if (sub === "rotate-key") {
      const keyId = args[1];
      if (!keyId) {
        console.error("Usage: speclock auth rotate-key <keyId>");
        process.exit(1);
      }
      const result = rotateApiKey(root, keyId);
      if (!result.success) {
        console.error(result.error);
        process.exit(1);
      }
      console.log(`\nKey Rotated`);
      console.log(`Old key: ${result.oldKeyId} (revoked)`);
      console.log(`New key: ${result.newKeyId}`);
      console.log(`Raw Key: ${result.rawKey}`);
      console.log(`\nSave this key — it CANNOT be retrieved later.`);
      return;
    }
    if (sub === "revoke-key") {
      const keyId = args[1];
      if (!keyId) {
        console.error("Usage: speclock auth revoke-key <keyId>");
        process.exit(1);
      }
      const reason = args.slice(2).join(" ") || "manual";
      const result = revokeApiKey(root, keyId, reason);
      if (!result.success) {
        console.error(result.error);
        process.exit(1);
      }
      console.log(`Key revoked: ${result.keyId} (${result.name}, ${result.role})`);
      return;
    }
    if (sub === "list-keys") {
      const result = listApiKeys(root);
      console.log(`\nAPI Keys (auth ${result.enabled ? "enabled" : "disabled"}):`);
      console.log("=".repeat(50));
      if (result.keys.length === 0) {
        console.log("  No keys configured.");
      } else {
        for (const k of result.keys) {
          const status = k.active ? "active" : `revoked (${k.revokedAt?.substring(0, 10) || "unknown"})`;
          console.log(`  ${k.id} — ${k.name} (${k.role}) [${status}]`);
        }
      }
      return;
    }
    if (sub === "enable") {
      enableAuth(root);
      console.log("Auth enabled. API keys are now required for HTTP access.");
      return;
    }
    if (sub === "disable") {
      disableAuth(root);
      console.log("Auth disabled. All operations allowed without keys.");
      return;
    }
    console.error("Usage: speclock auth <create-key|rotate-key|revoke-key|list-keys|enable|disable|status>");
    process.exit(1);
  }

  // --- POLICY (v3.5) ---
  if (cmd === "policy") {
    const sub = args[0];
    if (!sub || sub === "list") {
      const result = listPolicyRules(root);
      console.log(`\nPolicy Rules (${result.active}/${result.total} active):`);
      console.log("=".repeat(50));
      if (result.rules.length === 0) {
        console.log("  No rules. Run 'speclock policy init' to create a policy.");
      } else {
        for (const r of result.rules) {
          const status = r.active !== false ? "active" : "inactive";
          console.log(`  ${r.id} — ${r.name} [${r.enforce}/${r.severity}] (${status})`);
          console.log(`    Files: ${(r.match?.files || []).join(", ")}`);
          console.log(`    Actions: ${(r.match?.actions || []).join(", ")}`);
          console.log("");
        }
      }
      return;
    }
    if (sub === "init") {
      const result = initPolicy(root);
      if (!result.success) { console.error(result.error); process.exit(1); }
      console.log("Policy-as-code initialized. Edit .speclock/policy.yml to add rules.");
      return;
    }
    if (sub === "add") {
      const flags = parseFlags(args.slice(1));
      const name = flags.name || flags._.join(" ");
      if (!name) { console.error("Usage: speclock policy add --name <name> --files '**/*.js' --enforce block"); process.exit(1); }
      const rule = {
        name,
        description: flags.description || "",
        match: {
          files: flags.files ? flags.files.split(",").map(s => s.trim()) : ["**/*"],
          actions: flags.actions ? flags.actions.split(",").map(s => s.trim()) : ["modify", "delete"],
        },
        enforce: flags.enforce || "warn",
        severity: flags.severity || "medium",
        notify: flags.notify ? flags.notify.split(",").map(s => s.trim()) : [],
      };
      const result = addPolicyRule(root, rule);
      if (!result.success) { console.error(result.error); process.exit(1); }
      console.log(`Policy rule added: "${result.rule.name}" (${result.ruleId}) [${result.rule.enforce}]`);
      return;
    }
    if (sub === "remove") {
      const ruleId = args[1];
      if (!ruleId) { console.error("Usage: speclock policy remove <ruleId>"); process.exit(1); }
      const result = removePolicyRule(root, ruleId);
      if (!result.success) { console.error(result.error); process.exit(1); }
      console.log(`Policy rule removed: "${result.removed.name}"`);
      return;
    }
    if (sub === "evaluate") {
      const text = args.slice(1).join(" ");
      if (!text) { console.error("Usage: speclock policy evaluate 'what you plan to do'"); process.exit(1); }
      const result = evaluatePolicy(root, { description: text, text, type: "modify" });
      if (result.passed) {
        console.log(`Policy check passed. ${result.rulesChecked} rules evaluated.`);
      } else {
        console.log(`\nPolicy Violations (${result.violations.length}):`);
        for (const v of result.violations) {
          console.log(`  [${v.severity.toUpperCase()}] ${v.ruleName} (${v.enforce})`);
          if (v.matchedFiles.length) console.log(`    Files: ${v.matchedFiles.join(", ")}`);
        }
        if (result.blocked) process.exit(1);
      }
      return;
    }
    if (sub === "export") {
      const result = exportPolicy(root);
      if (!result.success) { console.error(result.error); process.exit(1); }
      console.log(result.yaml);
      return;
    }
    console.error("Usage: speclock policy <list|init|add|remove|evaluate|export>");
    process.exit(1);
  }

  // --- STATS (user-facing usage dashboard) ---
  if (cmd === "stats") {
    try {
      const view = buildStatsView(root);
      console.log(formatStatsDashboard(view));
    } catch (err) {
      console.error(`Failed to build stats: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // --- TELEMETRY (opt-in, v5.5) ---
  if (cmd === "telemetry") {
    const sub = args[0];

    if (sub === "on" || sub === "enable") {
      try {
        enableTelemetry();
        console.log("Telemetry: ENABLED.");
        console.log("We collect anonymous usage data only. See: speclock telemetry status");
        console.log("To opt out at any time: speclock telemetry off");
      } catch (_) {
        console.error("Failed to enable telemetry (ignored).");
      }
      return;
    }

    if (sub === "off" || sub === "disable") {
      try {
        disableTelemetry();
        console.log("Telemetry: DISABLED. No further events will be recorded or sent.");
      } catch (_) {
        console.error("Failed to disable telemetry (ignored).");
      }
      return;
    }

    if (sub === "clear") {
      try {
        const r = clearTelemetryLog();
        console.log(r.cleared ? "Telemetry log cleared." : "No telemetry log to clear.");
      } catch (_) {
        console.error("Failed to clear telemetry log (ignored).");
      }
      return;
    }

    if (sub === "status" || !sub) {
      try {
        const st = getOptInTelemetryStatus({ eventLimit: 10 });
        console.log(`\nSpecLock Telemetry (opt-in)`);
        console.log("=".repeat(50));
        console.log(`State:         ${st.enabled ? "ENABLED" : "DISABLED"}`);
        console.log(`Decided:       ${st.decided ? "yes" : "no (will prompt on next 'speclock protect')"}`);
        if (st.decidedAt) console.log(`Decided at:    ${st.decidedAt}`);
        if (st.installedAt) console.log(`First run:     ${st.installedAt}`);
        console.log(`Install id:    ${st.installId}`);
        console.log(`Endpoint:      ${st.endpoint || "(disabled)"}`);
        console.log(`Config file:   ${st.configPath}`);
        console.log(`Events file:   ${st.eventsPath}`);
        if (st.envOverride) console.log(`Env override:  SPECLOCK_TELEMETRY=${st.envOverride}`);
        console.log(`Total events:  ${st.eventCount}`);
        console.log("");
        console.log("What we collect (anonymous, no PII):");
        console.log("  installId, version, os, nodeVersion, command, exitCode,");
        console.log("  enforcementMode, lockCount, ruleFilesFound,");
        console.log("  mcpClientsConfigured, daysSinceInstall, timestamp");
        console.log("");
        console.log("What we NEVER collect:");
        console.log("  file contents, commit messages, lock content, user names,");
        console.log("  file paths, IP addresses, project names");
        console.log("");
        if (st.sampleEvent) {
          console.log("Sample event payload:");
          console.log(JSON.stringify(st.sampleEvent, null, 2));
          console.log("");
        }
        if (st.recentEvents.length > 0) {
          console.log(`Last ${st.recentEvents.length} event(s):`);
          for (const e of st.recentEvents) {
            console.log(`  ${e.timestamp}  ${e.command}  exit=${e.exitCode}  mode=${e.enforcementMode}  locks=${e.lockCount}`);
          }
          console.log("");
        } else {
          console.log("No events recorded yet.");
          console.log("");
        }

        // Also surface the legacy per-project analytics if that layer is enabled.
        if (isTelemetryEnabled()) {
          const legacy = getTelemetrySummary(root);
          if (legacy.enabled) {
            console.log("Per-project analytics (SPECLOCK_TELEMETRY):");
            console.log(`  Total MCP tool calls: ${legacy.totalCalls}`);
            console.log(`  Avg response:         ${legacy.avgResponseMs}ms`);
            console.log(`  Sessions:             ${legacy.sessions.total}`);
            console.log(`  Conflicts:            ${legacy.conflicts.total} (blocked: ${legacy.conflicts.blocked})`);
            console.log("");
          }
        }
      } catch (_) {
        console.error("Failed to read telemetry status (ignored).");
      }
      return;
    }

    console.error("Usage: speclock telemetry <on|off|status|clear>");
    process.exit(1);
  }

  // --- SSO (v3.5) ---
  if (cmd === "sso") {
    const sub = args[0];
    if (sub === "status" || !sub) {
      const enabled = isSSOEnabled(root);
      const config = getSSOConfig(root);
      console.log(`\nSSO: ${enabled ? "CONFIGURED" : "NOT CONFIGURED"}`);
      if (enabled) {
        console.log(`Issuer: ${config.issuer}`);
        console.log(`Client ID: ${config.clientId}`);
        console.log(`Redirect: ${config.redirectUri}`);
        console.log(`Default role: ${config.defaultRole}`);
      } else {
        console.log("Set SPECLOCK_SSO_ISSUER and SPECLOCK_SSO_CLIENT_ID to enable SSO.");
      }
      return;
    }
    if (sub === "configure") {
      const flags = parseFlags(args.slice(1));
      const config = getSSOConfig(root);
      if (flags.issuer) config.issuer = flags.issuer;
      if (flags["client-id"]) config.clientId = flags["client-id"];
      if (flags["client-secret"]) config.clientSecret = flags["client-secret"];
      if (flags["redirect-uri"]) config.redirectUri = flags["redirect-uri"];
      if (flags["default-role"]) config.defaultRole = flags["default-role"];
      saveSSOConfig(root, config);
      console.log("SSO configuration saved.");
      return;
    }
    console.error("Usage: speclock sso <status|configure> [--issuer URL --client-id ID]");
    process.exit(1);
  }

  // --- ENCRYPT STATUS (v3.0) ---
  if (cmd === "encrypt") {
    const sub = args[0];
    if (sub === "status" || !sub) {
      const enabled = isEncryptionEnabled();
      console.log(`\nEncryption: ${enabled ? "ENABLED (AES-256-GCM)" : "DISABLED"}`);
      if (!enabled) {
        console.log("Set SPECLOCK_ENCRYPTION_KEY env var to enable encryption.");
        console.log("All data will be encrypted at rest (brain.json + events.log).");
      }
      return;
    }
    console.error("Usage: speclock encrypt [status]");
    process.exit(1);
  }

  // --- DRIFT (new: drift score) ---
  if (cmd === "drift") {
    const flags = parseFlags(args);
    const days = flags.days ? parseInt(flags.days, 10) : 30;
    const result = computeDriftScore(root, { days });

    console.log(`\nSpecLock Drift Score`);
    console.log("=".repeat(60));
    console.log(formatDriftScore(result));
    return;
  }

  // --- COVERAGE (new: lock coverage audit) ---
  if (cmd === "coverage") {
    const result = computeCoverage(root);

    console.log(`\nSpecLock Lock Coverage Audit`);
    console.log("=".repeat(60));
    console.log(formatCoverage(result));
    return;
  }

  // --- STRENGTHEN (new: lock strengthener) ---
  if (cmd === "strengthen") {
    const result = analyzeLockStrength(root);

    console.log(`\nSpecLock Lock Strengthener`);
    console.log("=".repeat(60));
    console.log(formatStrength(result));
    return;
  }

  // --- REPLAY (new: incident replay) ---
  if (cmd === "replay") {
    const flags = parseFlags(args);

    if (flags.list) {
      const result = listSessions(root, 10);
      console.log(`\nSession History (${result.total} total)`);
      console.log("=".repeat(60));
      if (result.sessions.length === 0) {
        console.log("  No sessions recorded yet.");
      } else {
        for (const s of result.sessions) {
          const current = s.isCurrent ? " [ACTIVE]" : "";
          console.log(`  ${s.id}  ${s.tool.padEnd(12)}  ${s.startedAt.substring(0, 16)}  ${s.events} events${current}`);
          if (s.summary && s.summary !== "(no summary)") {
            console.log(`  ${"".padEnd(16)}  ${s.summary.substring(0, 60)}`);
          }
        }
      }
      console.log(`\nReplay a session: speclock replay --session <id>`);
      return;
    }

    const replay = getReplay(root, {
      sessionId: flags.session || null,
      limit: flags.limit ? parseInt(flags.limit, 10) : 50,
    });

    if (!replay.found) {
      console.error(replay.error);
      process.exit(1);
    }

    console.log(`\nSpecLock Incident Replay`);
    console.log("=".repeat(60));
    console.log(formatReplay(replay));
    return;
  }

  // --- SYNC (new: universal rules sync) ---
  if (cmd === "sync") {
    const flags = parseFlags(args);

    // List available formats
    if (flags.list) {
      const formats = getSyncFormats();
      console.log("\nAvailable Sync Formats:");
      console.log("=".repeat(55));
      for (const f of formats) {
        console.log(`  ${f.key.padEnd(12)} ${f.name.padEnd(18)} → ${f.file}`);
        console.log(`  ${"".padEnd(12)} ${f.description}`);
        console.log("");
      }
      console.log("Usage:");
      console.log("  speclock sync --format cursor    Sync to Cursor only");
      console.log("  speclock sync --all              Sync to ALL formats");
      console.log("  speclock sync --preview claude   Preview without writing");
      return;
    }

    // Preview mode
    if (flags.preview) {
      const result = syncRules(root, { format: flags.preview, dryRun: true });
      if (result.errors.length > 0) {
        for (const err of result.errors) console.error(err);
        process.exit(1);
      }
      for (const s of result.synced) {
        console.log(`\n${"=".repeat(55)}`);
        console.log(`Preview: ${s.name} → ${s.file} (${s.size} bytes)`);
        console.log("=".repeat(55));
        console.log(s.content);
      }
      return;
    }

    // Determine format
    const format = flags.format || (flags.all ? undefined : flags._[0]);
    if (!format && !flags.all) {
      console.error("Usage: speclock sync --format <cursor|claude|agents|windsurf|copilot|gemini|aider>");
      console.error("       speclock sync --all           Sync to all formats");
      console.error("       speclock sync --list          List formats");
      console.error("       speclock sync --preview <fmt> Preview output");
      process.exit(1);
    }

    const options = {};
    if (format) options.format = format;
    if (flags.append) options.append = true;

    const result = syncRules(root, options);

    if (result.errors.length > 0) {
      for (const err of result.errors) console.error(`Error: ${err}`);
      if (result.synced.length === 0) process.exit(1);
    }

    if (result.synced.length > 0) {
      console.log(`\nSpecLock Sync Complete`);
      console.log("=".repeat(55));
      console.log(`Constraints: ${result.lockCount} lock(s), ${result.decisionCount} decision(s)`);
      console.log("");
      for (const s of result.synced) {
        console.log(`  ✓ ${s.name.padEnd(18)} → ${s.file} (${s.size} bytes)`);
      }
      console.log(`\n${result.synced.length} file(s) synced. Your AI tools will now see SpecLock constraints.`);
      if (!format) {
        console.log("\nTip: Add these files to git so your AI tools read them automatically.");
      }
    }
    return;
  }

  // --- STATUS ---
  if (cmd === "status") {
    showStatus(root);
    return;
  }

  // --- DOCTOR: Diagnostic health check ---
  if (cmd === "doctor") {
    const fs = await import("fs");
    const os = await import("os");
    const lines = [];
    const fixes = [];
    let issueCount = 0;

    lines.push("");
    lines.push("SpecLock Doctor — Health Check");
    lines.push("================================");
    lines.push("");

    // --- 1. Installation ---
    lines.push("Installation");
    let pkgVersion = "unknown";
    try {
      // Walk up from this module's directory to find speclock's package.json
      // (works for: local install, npm global, npx cache)
      let dir = path.dirname(fileURLToPath(import.meta.url));
      for (let i = 0; i < 5; i++) {
        const candidate = path.join(dir, "package.json");
        if (fs.existsSync(candidate)) {
          const p = JSON.parse(fs.readFileSync(candidate, "utf-8"));
          if (p.name === "speclock") {
            pkgVersion = p.version;
            break;
          }
        }
        dir = path.dirname(dir);
      }
      // Fallbacks
      if (pkgVersion === "unknown") {
        const selfPkgPath = path.join(root, "node_modules", "speclock", "package.json");
        if (fs.existsSync(selfPkgPath)) {
          pkgVersion = JSON.parse(fs.readFileSync(selfPkgPath, "utf-8")).version;
        } else {
          const localPkg = path.join(root, "package.json");
          if (fs.existsSync(localPkg)) {
            const p = JSON.parse(fs.readFileSync(localPkg, "utf-8"));
            if (p.name === "speclock") pkgVersion = p.version;
          }
        }
      }
      lines.push(`  ✓ SpecLock v${pkgVersion} installed`);
    } catch (e) {
      lines.push(`  ✗ SpecLock version check failed: ${e.message}`);
      issueCount++;
    }

    const speclockDir = path.join(root, ".speclock");
    if (fs.existsSync(speclockDir)) {
      lines.push(`  ✓ .speclock/ directory present`);
    } else {
      lines.push(`  ✗ .speclock/ directory missing`);
      fixes.push("Run: speclock setup");
      issueCount++;
    }

    const brainPath = path.join(speclockDir, "brain.json");
    let brain = null;
    let activeLockCount = 0;
    if (fs.existsSync(brainPath)) {
      try {
        brain = JSON.parse(fs.readFileSync(brainPath, "utf-8"));
        activeLockCount = (brain.specLock?.items || []).filter((l) => l.active !== false).length;
        lines.push(`  ✓ brain.json valid (${activeLockCount} locks)`);
      } catch (e) {
        lines.push(`  ✗ brain.json is not valid JSON: ${e.message}`);
        fixes.push("Delete .speclock/brain.json and run: speclock setup");
        issueCount++;
      }
    } else if (fs.existsSync(speclockDir)) {
      lines.push(`  ✗ brain.json missing`);
      fixes.push("Run: speclock init");
      issueCount++;
    }
    lines.push("");

    // --- 2. Git Integration ---
    lines.push("Git Integration");
    const gitDir = path.join(root, ".git");
    const isGitRepo = fs.existsSync(gitDir);
    if (isGitRepo) {
      lines.push(`  ✓ Git repository detected`);
    } else {
      lines.push(`  ✗ Not a git repository`);
      fixes.push("Run: git init");
      issueCount++;
    }

    if (isGitRepo) {
      const hookPath = path.join(gitDir, "hooks", "pre-commit");
      if (fs.existsSync(hookPath)) {
        const hookContent = fs.readFileSync(hookPath, "utf-8");
        const hasMarker = hookContent.includes("SPECLOCK-HOOK");
        const runsSpeclock = /speclock\s+audit/.test(hookContent) || /speclock/.test(hookContent);
        if (hasMarker && runsSpeclock) {
          lines.push(`  ✓ Pre-commit hook installed`);
          lines.push(`  ✓ Hook runs speclock`);
        } else if (hasMarker) {
          lines.push(`  ⚠ Pre-commit hook has SpecLock marker but does not run speclock`);
          fixes.push("Run: speclock hook install");
          issueCount++;
        } else {
          lines.push(`  ✗ Pre-commit hook exists but was not installed by SpecLock`);
          fixes.push("Run: speclock hook install (will append to existing hook)");
          issueCount++;
        }
      } else {
        lines.push(`  ✗ Pre-commit hook not installed`);
        fixes.push("Run: speclock hook install");
        issueCount++;
      }
    }

    // Enforcement mode (if brain exists)
    if (brain) {
      const mode = brain.enforcement?.mode || "advisory";
      const modeLabel = mode === "hard" ? "hard (block)" : "warn (advisory)";
      lines.push(`  ✓ Mode: ${modeLabel}` + (mode !== "hard" ? " (use 'speclock enforce hard' for hard enforcement)" : ""));
    }
    lines.push("");

    // --- 3. Rule Files ---
    // Doctor checks both:
    //   (a) ORIGINAL rule files (.cursorrules, CLAUDE.md, etc.) that users author
    //   (b) SYNCED files written by `speclock protect` / `speclock sync`
    //       (.cursor/rules/speclock.mdc, .windsurf/rules/speclock.md, AGENTS.md
    //        with SpecLock marker, GEMINI.md, .github/copilot-instructions.md,
    //        .aider.conf.yml)
    // A file is considered "synced" if it has a SpecLock auto-gen marker in its header.
    lines.push("Rule Files");

    // All the files `speclock sync` can produce (mirrors FORMATS in rules-sync.js)
    const SYNCED_OUTPUT_FILES = [
      ".cursor/rules/speclock.mdc",
      ".windsurf/rules/speclock.md",
      ".github/copilot-instructions.md",
      "GEMINI.md",
      ".aider.conf.yml",
      "AGENTS.md",
    ];

    // Markers that indicate a file was written by SpecLock's sync pipeline.
    // Must match the markers used by isSpeclockGenerated() in guardian.js.
    const SPECLOCK_DOCTOR_SYNC_MARKERS = [
      "Auto-synced from SpecLock",
      "Auto-synced by SpecLock",
      "Auto-synced.",
      "(SpecLock)",
      "# SpecLock Constraints",
      "Do not edit manually — run `speclock sync`",
      "speclock sync --format",
      "speclock_session_briefing",
    ];

    function isSyncedFile(absPath) {
      try {
        const content = fs.readFileSync(absPath, "utf-8");
        const header = content.split("\n").slice(0, 10).join("\n");
        return SPECLOCK_DOCTOR_SYNC_MARKERS.some((m) => header.includes(m));
      } catch (_) {
        return false;
      }
    }

    const discovered = discoverRuleFiles(root);
    const discoveredMap = new Map(discovered.map((f) => [f.file, f]));
    const shownFiles = new Set();
    let totalRuleFilesFound = 0;

    // (a) Original/authored rule files
    for (const entry of RULE_FILES) {
      const found = discoveredMap.get(entry.file);
      if (found) {
        const extracted = extractConstraints(found.content, found.file);
        lines.push(`  ✓ ${entry.file} (${extracted.locks.length} locks extracted)`);
        shownFiles.add(entry.file);
        totalRuleFilesFound++;
      }
    }

    // (b) Synced files written by `speclock protect` / `speclock sync`
    for (const relPath of SYNCED_OUTPUT_FILES) {
      if (shownFiles.has(relPath)) continue; // already shown as an authored file
      const abs = path.join(root, relPath);
      if (!fs.existsSync(abs)) continue;
      if (isSyncedFile(abs)) {
        lines.push(`  ✓ ${relPath} (synced)`);
        shownFiles.add(relPath);
        totalRuleFilesFound++;
      }
    }

    // If nothing at all was found, show a clear diagnostic.
    if (totalRuleFilesFound === 0) {
      lines.push(`  ✗ No rule files found`);
      fixes.push("Run: speclock protect (auto-creates a starter CLAUDE.md)");
      issueCount++;
    }
    lines.push("");

    // --- 4. MCP Integration ---
    lines.push("MCP Integration");
    const home = os.homedir();

    function checkMcpConfig(label, filePath, fixCmd) {
      if (fs.existsSync(filePath)) {
        try {
          const cfg = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          const servers = cfg.mcpServers || cfg.servers || {};
          const hasSpeclock = Object.keys(servers).some((k) => /speclock/i.test(k)) ||
            JSON.stringify(cfg).toLowerCase().includes("speclock");
          if (hasSpeclock) {
            lines.push(`  ✓ ${label} (${filePath.replace(home, "~")})`);
            return true;
          }
          lines.push(`  ✗ ${label} (config exists at ${filePath.replace(home, "~")}, but SpecLock not configured)`);
          lines.push(`    Fix: ${fixCmd}`);
          issueCount++;
          return false;
        } catch (_) {
          lines.push(`  ✗ ${label} (${filePath.replace(home, "~")}: invalid JSON)`);
          lines.push(`    Fix: ${fixCmd}`);
          issueCount++;
          return false;
        }
      }
      lines.push(`  ✗ ${label} (${filePath.replace(home, "~")})`);
      lines.push(`    Fix: ${fixCmd}`);
      issueCount++;
      return false;
    }

    checkMcpConfig(
      "Claude Code project (.mcp.json)",
      path.join(root, ".mcp.json"),
      "speclock mcp install claude-code"
    );
    checkMcpConfig(
      "Claude Code global (~/.claude/mcp.json)",
      path.join(home, ".claude", "mcp.json"),
      "speclock mcp install claude-code --global"
    );
    checkMcpConfig(
      "Cursor project (.cursor/mcp.json)",
      path.join(root, ".cursor", "mcp.json"),
      "speclock mcp install cursor"
    );
    checkMcpConfig(
      "Cursor global (~/.cursor/mcp.json)",
      path.join(home, ".cursor", "mcp.json"),
      "speclock mcp install cursor --global"
    );
    checkMcpConfig(
      "Windsurf (~/.codeium/windsurf/mcp_config.json)",
      path.join(home, ".codeium", "windsurf", "mcp_config.json"),
      "speclock mcp install windsurf"
    );
    lines.push("");

    // --- 5. Summary ---
    if (issueCount === 0) {
      lines.push("VERDICT: ✓ HEALTHY — all checks passed");
    } else {
      lines.push(`VERDICT: ⚠ ${issueCount} issue${issueCount === 1 ? "" : "s"} found (see fixes above)`);
    }
    lines.push("");

    console.log(lines.join("\n"));
    process.exit(issueCount === 0 ? 0 : 1);
  }

  // --- RELEASE: Automated version bump + publish + deploy ---
  if (cmd === "release") {
    const bump = args[0]; // "patch", "minor", or "major"
    if (!bump || !["patch", "minor", "major"].includes(bump)) {
      console.log("Usage: speclock release <patch|minor|major>");
      console.log("  Bumps version in ALL files, commits, pushes, npm publishes, deploys.");
      process.exit(1);
    }

    const { execSync } = await import("child_process");
    const fs = await import("fs");

    // Read current version
    const pkgPath = path.join(root, "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const [major, minor, patch] = pkg.version.split(".").map(Number);
    let newVersion;
    if (bump === "patch") newVersion = `${major}.${minor}.${patch + 1}`;
    else if (bump === "minor") newVersion = `${major}.${minor + 1}.0`;
    else newVersion = `${major + 1}.0.0`;

    console.log(`\n  Releasing v${newVersion} (was ${pkg.version})\n`);

    // Step 1: Version bump in all 7 files
    const VERSION_FILES = [
      { file: "package.json", pattern: `"version": "${pkg.version}"`, replacement: `"version": "${newVersion}"` },
      { file: "src/mcp/http-server.js", pattern: `const VERSION = "${pkg.version}"`, replacement: `const VERSION = "${newVersion}"` },
      { file: "src/mcp/server.js", pattern: `const VERSION = "${pkg.version}"`, replacement: `const VERSION = "${newVersion}"` },
      { file: "src/core/compliance.js", pattern: `const VERSION = "${pkg.version}"`, replacement: `const VERSION = "${newVersion}"` },
      { file: "src/cli/index.js", pattern: `SpecLock v${pkg.version}`, replacement: `SpecLock v${newVersion}` },
      { file: "src/dashboard/index.html", pattern: `v${pkg.version}`, replacement: `v${newVersion}` },
    ];

    let filesUpdated = 0;
    for (const { file, pattern, replacement } of VERSION_FILES) {
      const filePath = path.join(root, file);
      if (!fs.existsSync(filePath)) {
        console.log(`  SKIP  ${file} (not found)`);
        continue;
      }
      const content = fs.readFileSync(filePath, "utf8");
      const updated = content.replaceAll(pattern, replacement);
      if (updated !== content) {
        fs.writeFileSync(filePath, updated);
        const count = (content.split(pattern).length - 1);
        console.log(`  DONE  ${file} (${count} replacement${count > 1 ? "s" : ""})`);
        filesUpdated++;
      } else {
        console.log(`  SKIP  ${file} (pattern not found)`);
      }
    }
    console.log(`\n  ${filesUpdated} files updated to v${newVersion}\n`);

    // Step 2: Git commit + push
    console.log("  Committing...");
    try {
      execSync(`git add -A`, { cwd: root, stdio: "pipe" });
      execSync(`git commit -m "v${newVersion}"`, { cwd: root, stdio: "pipe" });
      console.log("  DONE  git commit");
    } catch (e) {
      console.error("  FAIL  git commit:", e.message);
      process.exit(1);
    }

    console.log("  Pushing...");
    try {
      execSync(`git push origin main`, { cwd: root, stdio: "pipe" });
      console.log("  DONE  git push");
    } catch (e) {
      console.error("  FAIL  git push:", e.message);
    }

    // Step 3: npm publish
    console.log("  Publishing to npm...");
    try {
      execSync(`npm publish`, { cwd: root, stdio: "pipe" });
      console.log("  DONE  npm publish speclock@" + newVersion);
    } catch (e) {
      console.error("  FAIL  npm publish:", e.message);
    }

    // Step 4: Git tag
    console.log("  Tagging...");
    try {
      execSync(`git tag v${newVersion}`, { cwd: root, stdio: "pipe" });
      execSync(`git push origin v${newVersion}`, { cwd: root, stdio: "pipe" });
      console.log(`  DONE  git tag v${newVersion}`);
    } catch (e) {
      console.error("  FAIL  git tag:", e.message);
    }

    // Step 5: Railway deploy
    console.log("  Deploying to Railway...");
    try {
      execSync(`railway up`, { cwd: root, stdio: "pipe", timeout: 120000 });
      console.log("  DONE  railway up");
    } catch (e) {
      console.log("  WARN  railway up (may need manual deploy):", e.message?.slice(0, 100));
    }

    // Step 6: Verify
    console.log("\n  Verifying...");
    try {
      const health = execSync(`curl -s https://speclock-mcp-production.up.railway.app/health`, { timeout: 15000 }).toString();
      const parsed = JSON.parse(health);
      if (parsed.version === newVersion) {
        console.log(`  DONE  Railway health: v${parsed.version} (${parsed.tools} tools)`);
      } else {
        console.log(`  WARN  Railway shows v${parsed.version}, expected v${newVersion} (may need a moment)`);
      }
    } catch (e) {
      console.log("  WARN  Health check failed (Railway may still be deploying)");
    }

    try {
      const npmVer = execSync(`npm view speclock version`, { timeout: 10000 }).toString().trim();
      if (npmVer === newVersion) {
        console.log(`  DONE  npm: speclock@${npmVer}`);
      } else {
        console.log(`  WARN  npm shows ${npmVer}, expected ${newVersion} (cache delay)`);
      }
    } catch (e) {
      console.log("  WARN  npm check failed");
    }

    console.log(`\n  Release v${newVersion} complete.\n`);
    return;
  }

  // End of dispatch loop. If no handler returned/exited, fall through.
  break;
  } // end dispatch: while

  console.error(`Unknown command: ${cmd}`);
  console.error("Run 'speclock --help' for usage.");
  process.exit(1);
}

// Only run the CLI when this file is invoked as the entry point — either
// directly (`node src/cli/index.js`) or through the bin wrapper
// (`bin/speclock.js` does `import "../src/cli/index.js"`). Skip autorun when
// this module is imported by tests or other tooling that only needs the
// exported helpers (`loadRulePack`, `initFromRulePack`).
const shouldAutoRun = (() => {
  if (process.env.SPECLOCK_CLI_NO_AUTORUN === "1") return false;
  try {
    const thisFile = fileURLToPath(import.meta.url);
    const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : "";
    if (!entryFile) return true;
    if (thisFile === entryFile) return true;
    // bin wrapper: bin/speclock.js (or any file under a /bin/ directory
    // whose basename starts with "speclock").
    const base = path.basename(entryFile).toLowerCase();
    if (base.startsWith("speclock")) return true;
    return false;
  } catch (_) {
    return true;
  }
})();

if (shouldAutoRun) {
  main().catch((err) => {
    console.error("SpecLock error:", err.message);
    process.exit(1);
  });
}
