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
  setEnforcementMode,
  overrideLock,
  getOverrideHistory,
  getEnforcementConfig,
  semanticAudit,
} from "../core/engine.js";
import { generateContext } from "../core/context.js";
import { readBrain } from "../core/storage.js";
import { installHook, removeHook } from "../core/hooks.js";

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
SpecLock v2.5.0 — AI Constraint Engine (Hard Enforcement + Semantic Pre-Commit)
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
  watch                           Start file watcher (auto-track changes)
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

Templates: nextjs, react, express, supabase, stripe, security-hardened

Enterprise:
  SPECLOCK_AUDIT_SECRET           HMAC secret for audit chain (env var)
  SPECLOCK_LICENSE_KEY            License key for Pro/Enterprise features
  SPECLOCK_LLM_KEY                API key for LLM-powered conflict detection

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
  To log changes:      npx speclock log-change "Built landing page"
  To see status:       npx speclock status

Tip: When starting a new chat, tell the AI:
  "Check speclock status and read the project constraints before doing anything"
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
    const { lockId } = addLock(root, text, parseTags(flags.tags), flags.source || "user");

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
    const result = enforceConflictCheck(root, text);
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

  // --- STATUS ---
  if (cmd === "status") {
    showStatus(root);
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
