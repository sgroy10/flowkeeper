import path from "path";
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
} from "../core/telemetry.js";
import {
  isSSOEnabled,
  getSSOConfig,
  saveSSOConfig,
} from "../core/sso.js";
import { syncRules, getSyncFormats } from "../core/rules-sync.js";
import { getReplay, listSessions, formatReplay } from "../core/replay.js";

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

// --- Help text ---

function printHelp() {
  console.log(`
SpecLock v5.3.0 — AI Constraint Engine (Universal Rules Sync + Spec Compiler + Code Graph + Typed Constraints + Python SDK + ROS2 + REST API v2 + Gemini LLM + Policy-as-Code + Auth + RBAC + Encryption)
Developed by Sandeep Roy (github.com/sgroy10)

Usage: speclock <command> [options]

Commands:
  setup [--goal <text>] [--template <name>]  Full setup: init + SPECLOCK.md + context
  init                            Initialize SpecLock in current directory
  goal <text>                     Set or update the project goal
  lock <text> [--tags a,b]        Add a non-negotiable constraint
  lock remove <id>                Remove a lock by ID
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
  audit                           Audit staged files against locks
  audit-semantic                  Semantic audit: analyze code changes vs locks
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
  watch                           Start file watcher (live dashboard)
  serve [--project <path>]        Start MCP stdio server
  status                          Show project brain summary

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
  telemetry [status]              Show telemetry status and analytics
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

// --- Main ---

async function main() {
  const { cmd, args } = parseArgs(process.argv);
  const root = rootDir();

  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    printHelp();
    process.exit(0);
  }

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
    const pkgResult = injectPackageJsonMarker(root);
    if (pkgResult.success) {
      console.log("Injected SpecLock marker into package.json.");
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
    console.log(`
SpecLock is ready!

Files created/updated:
  .speclock/brain.json          — Project memory
  .speclock/context/latest.md   — Context for AI (read this)
  SPECLOCK.md                   — AI rules (read this)
  package.json                  — Active locks embedded (AI auto-discovery)

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
    const result = auditStagedFiles(root);
    if (result.passed) {
      console.log(result.message);
      process.exit(0);
    } else {
      console.log("\nSPECLOCK AUDIT FAILED");
      console.log("=".repeat(50));
      for (const v of result.violations) {
        console.log(`  [${v.severity}] ${v.file}`);
        console.log(`    Lock: ${v.lockText}`);
        console.log(`    Reason: ${v.reason}`);
        console.log("");
      }
      console.log(result.message);
      console.log("Commit blocked. Unlock files or unstage them to proceed.");
      process.exit(1);
    }
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
    const result = semanticAudit(root);
    console.log(`\nSemantic Pre-Commit Audit`);
    console.log("=".repeat(50));
    console.log(`Mode: ${result.mode} | Threshold: ${result.threshold}%`);
    console.log(`Files analyzed: ${result.filesChecked}`);
    console.log(`Active locks: ${result.activeLocks}`);
    console.log(`Violations: ${result.violations.length}`);
    if (result.violations.length > 0) {
      console.log("");
      for (const v of result.violations) {
        console.log(`  [${v.level}] ${v.file} (confidence: ${v.confidence}%)`);
        console.log(`    Lock: "${v.lockText}"`);
        console.log(`    Reason: ${v.reason}`);
        if (v.addedLines !== undefined) {
          console.log(`    Changes: +${v.addedLines} / -${v.removedLines} lines`);
        }
      }
    }
    console.log(`\n${result.message}`);
    process.exit(result.blocked ? 1 : 0);
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

  // --- TELEMETRY (v3.5) ---
  if (cmd === "telemetry") {
    const sub = args[0];
    if (sub === "status" || !sub) {
      const enabled = isTelemetryEnabled();
      console.log(`\nTelemetry: ${enabled ? "ENABLED" : "DISABLED"}`);
      if (!enabled) {
        console.log("Set SPECLOCK_TELEMETRY=true to enable anonymous usage analytics.");
        return;
      }
      const summary = getTelemetrySummary(root);
      console.log(`Total calls: ${summary.totalCalls}`);
      console.log(`Avg response: ${summary.avgResponseMs}ms`);
      console.log(`Sessions: ${summary.sessions.total}`);
      console.log(`Conflicts: ${summary.conflicts.total} (blocked: ${summary.conflicts.blocked})`);
      if (summary.topTools.length > 0) {
        console.log(`\nTop tools:`);
        for (const t of summary.topTools.slice(0, 5)) {
          console.log(`  ${t.name}: ${t.count} calls`);
        }
      }
      return;
    }
    console.error("Usage: speclock telemetry [status]");
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

  console.error(`Unknown command: ${cmd}`);
  console.error("Run 'speclock --help' for usage.");
  process.exit(1);
}

main().catch((err) => {
  console.error("SpecLock error:", err.message);
  process.exit(1);
});
