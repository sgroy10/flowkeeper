/**
 * SpecLock v5.0.0 — LIVE DEMO
 * ALL new features: Semantic Detection, Typed Constraints,
 * Code Graph, Spec Compiler
 */

import {
  ensureInit, setGoal, addLock, addTypedLock,
  checkConflict, validateTypedLock, checkTypedConstraint,
  buildGraph, getBlastRadius, mapLocksToFiles, getCriticalPaths,
  compileSpec,
} from "./src/core/engine.js";
import fs from "fs";
import path from "path";

const root = process.env.TEMP + "/speclock-v5-demo";
fs.mkdirSync(root, { recursive: true });
fs.rmSync(root + "/.speclock", { recursive: true, force: true });

// Create a mock project structure for Code Graph demo
const dirs = ["src", "src/api", "src/db", "src/auth", "src/utils", "src/middleware"];
dirs.forEach(d => fs.mkdirSync(path.join(root, d), { recursive: true }));

fs.writeFileSync(path.join(root, "src/index.js"), `import { router } from "./api/routes.js";\nimport { authMiddleware } from "./middleware/auth.js";\n`);
fs.writeFileSync(path.join(root, "src/api/routes.js"), `import { getUsers } from "./users.js";\nimport { authCheck } from "../auth/auth.js";\n`);
fs.writeFileSync(path.join(root, "src/api/users.js"), `import { query } from "../db/postgres.js";\nimport { validate } from "../utils/validator.js";\n`);
fs.writeFileSync(path.join(root, "src/auth/auth.js"), `import { signJWT, verifyJWT } from "../utils/jwt.js";\nimport { findUser } from "../db/postgres.js";\n`);
fs.writeFileSync(path.join(root, "src/db/postgres.js"), `import pg from "pg";\nexport function query(sql) { /* ... */ }\nexport function findUser(id) { /* ... */ }\n`);
fs.writeFileSync(path.join(root, "src/utils/jwt.js"), `export function signJWT(payload) { /* ... */ }\nexport function verifyJWT(token) { /* ... */ }\n`);
fs.writeFileSync(path.join(root, "src/utils/validator.js"), `export function validate(schema, data) { /* ... */ }\n`);
fs.writeFileSync(path.join(root, "src/middleware/auth.js"), `import { verifyJWT } from "../utils/jwt.js";\nimport { authCheck } from "../auth/auth.js";\n`);
fs.writeFileSync(path.join(root, "package.json"), `{"name":"demo","type":"module"}`);

// Initialize
ensureInit(root);
setGoal(root, "Hospital ERP — HIPAA compliant, PostgreSQL, Stripe payments");
addLock(root, "Never delete patient records", "user", ["hipaa"]);
addLock(root, "Database must stay PostgreSQL", "user", ["infrastructure"]);
addLock(root, "All API endpoints must require authentication", "user", ["security"]);
addLock(root, "We use Stripe for payments — never switch provider", "user", ["payments"]);
addLock(root, "Never modify auth files", "user", ["security"]);

console.log("");
console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║           SpecLock v5.0.0 — LIVE FEATURE DEMO              ║");
console.log("║     AI Constraint Engine — 39 Tools, 940 Tests, 99.4%      ║");
console.log("╚══════════════════════════════════════════════════════════════╝");

// ═══════════════════════════════════════════════════════
// DEMO 1: SEMANTIC CONFLICT DETECTION
// ═══════════════════════════════════════════════════════
console.log("");
console.log("┌──────────────────────────────────────────────────────────────┐");
console.log("│  FEATURE 1: SEMANTIC CONFLICT DETECTION ENGINE v4           │");
console.log("│  65+ synonym groups · 80+ euphemisms · intent classifier    │");
console.log("│  Domain concept maps · temporal evasion detection            │");
console.log("└──────────────────────────────────────────────────────────────┘");

const conflictTests = [
  { action: "Clean up old patient data from cold storage",    expect: true,  why: "euphemism 'clean up' = delete" },
  { action: "Migrate to MongoDB for better scalability",      expect: true,  why: "MongoDB vs PostgreSQL = same domain" },
  { action: "Make the health check endpoint public without auth", expect: true,  why: "public = bypasses auth requirement" },
  { action: "Integrate Razorpay for better Indian merchant rates", expect: true,  why: "Razorpay vs Stripe = payment gateways" },
  { action: "Enable comprehensive audit logging",             expect: false, why: "enabling != disabling (intent alignment)" },
  { action: "Add a new patient intake form",                  expect: false, why: "adding != deleting records" },
];

let blocked = 0, allowed = 0, correct = 0;
for (const t of conflictTests) {
  const result = checkConflict(root, t.action);
  const isBlocked = result.hasConflict;
  if (isBlocked) {
    blocked++;
    const topLock = result.conflictingLocks?.[0];
    const conf = topLock?.confidence || "?";
    console.log(`  [X] BLOCKED │ "${t.action}"`);
    console.log(`      └─ ${t.why} (${conf}%)`);
  } else {
    allowed++;
    console.log(`  [v] ALLOWED │ "${t.action}"`);
  }
  if (isBlocked === t.expect) correct++;
}
console.log(`\n  Results: ${blocked} blocked, ${allowed} allowed, ${correct}/${conflictTests.length} correct`);

// ═══════════════════════════════════════════════════════
// DEMO 2: TYPED CONSTRAINTS
// ═══════════════════════════════════════════════════════
console.log("");
console.log("┌──────────────────────────────────────────────────────────────┐");
console.log("│  FEATURE 2: TYPED CONSTRAINTS                               │");
console.log("│  Machine-enforceable: numerical, range, state, temporal      │");
console.log("│  For autonomous systems, IoT, robotics, SRE                  │");
console.log("└──────────────────────────────────────────────────────────────┘");

// Numerical
const numLock = { constraintType: "numerical", metric: "response_time_ms", operator: "<=", value: 200, unit: "ms", description: "API response time <= 200ms" };
validateTypedLock(numLock);
addTypedLock(root, numLock, "user");
const n1 = checkTypedConstraint(numLock, { metric: "response_time_ms", value: 150 });
const n2 = checkTypedConstraint(numLock, { metric: "response_time_ms", value: 350 });
console.log("  [numerical] response_time_ms <= 200ms");
console.log(`    150ms -> ${n1.hasConflict ? "VIOLATION" : "PASS"}     350ms -> ${n2.hasConflict ? "VIOLATION (" + n2.confidence + "%)" : "PASS"}`);

// Range
const rangeLock = { constraintType: "range", metric: "cpu_usage", min: 0, max: 80, unit: "%", description: "CPU 0-80%" };
addTypedLock(root, rangeLock, "user");
const r1 = checkTypedConstraint(rangeLock, { metric: "cpu_usage", value: 65 });
const r2 = checkTypedConstraint(rangeLock, { metric: "cpu_usage", value: 95 });
console.log("  [range]     cpu_usage: 0-80%");
console.log(`    65% -> ${r1.hasConflict ? "VIOLATION" : "PASS"}        95% -> ${r2.hasConflict ? "VIOLATION (" + r2.confidence + "%)" : "PASS"}`);

// State
const stateLock = { constraintType: "state", metric: "deploy_env", allowedValues: ["staging", "production"], forbiddenTransitions: [{ from: "production", to: "development" }], description: "No prod->dev downgrade" };
addTypedLock(root, stateLock, "user");
const s1 = checkTypedConstraint(stateLock, { metric: "deploy_env", value: "development", previousValue: "production" });
const s2 = checkTypedConstraint(stateLock, { metric: "deploy_env", value: "production", previousValue: "staging" });
console.log("  [state]     deploy_env: forbidden prod->dev");
console.log(`    prod->dev: ${s1.hasConflict ? "VIOLATION (" + s1.confidence + "%)" : "PASS"}  staging->prod: ${s2.hasConflict ? "VIOLATION" : "PASS"}`);

// Temporal
const tempLock = { constraintType: "temporal", metric: "maintenance_window", schedule: { daysOfWeek: [0, 6], startHour: 2, endHour: 6 }, description: "Maintenance only weekends 2-6 AM" };
addTypedLock(root, tempLock, "user");
console.log("  [temporal]  maintenance_window: weekends 2-6 AM only");
console.log("\n  4 typed constraints added — machine-enforceable, zero ambiguity");

// ═══════════════════════════════════════════════════════
// DEMO 3: CODE GRAPH
// ═══════════════════════════════════════════════════════
console.log("");
console.log("┌──────────────────────────────────────────────────────────────┐");
console.log("│  FEATURE 3: CODE GRAPH — Structural Code Intelligence       │");
console.log("│  Dependency parsing · blast radius · lock-to-file mapping    │");
console.log("│  Module detection · critical path analysis                   │");
console.log("└──────────────────────────────────────────────────────────────┘");

const graph = buildGraph(root);
console.log(`  Graph: ${graph.stats.totalFiles} files, ${graph.stats.totalEdges} edges`);
console.log(`  Languages: ${JSON.stringify(graph.stats.languages)}`);

// Blast radius
const blast = getBlastRadius(root, "src/db/postgres.js");
console.log(`\n  Blast radius — src/db/postgres.js:`);
console.log(`    Direct dependents:     ${blast.directDependents.join(", ")}`);
console.log(`    Transitive dependents: ${blast.transitiveDependents.join(", ")}`);
console.log(`    Impact: ${blast.impactPercent.toFixed(1)}% of codebase | Depth: ${blast.depth} hops`);

const blast2 = getBlastRadius(root, "src/utils/jwt.js");
console.log(`\n  Blast radius — src/utils/jwt.js:`);
console.log(`    Direct dependents:     ${blast2.directDependents.join(", ")}`);
console.log(`    Transitive dependents: ${blast2.transitiveDependents.join(", ")}`);
console.log(`    Impact: ${blast2.impactPercent.toFixed(1)}% of codebase | Depth: ${blast2.depth} hops`);

// Lock-to-file mapping
const lockMap = mapLocksToFiles(root);
console.log(`\n  Lock-to-file mapping:`);
for (const mapping of lockMap) {
  if (mapping.matchedFiles.length > 0) {
    console.log(`    "${mapping.lockText.substring(0, 50)}"`);
    console.log(`      -> [${mapping.matchedFiles.join(", ")}]`);
  }
}

// Critical paths
const critical = getCriticalPaths(root, { limit: 3 });
console.log(`\n  Top 3 critical paths (highest risk):`);
for (const cp of critical) {
  console.log(`    ${cp.file} — score: ${cp.score}, dependents: ${cp.directDependents}`);
}

// ═══════════════════════════════════════════════════════
// DEMO 4: SPEC COMPILER
// ═══════════════════════════════════════════════════════
console.log("");
console.log("┌──────────────────────────────────────────────────────────────┐");
console.log("│  FEATURE 4: SPEC COMPILER — Natural Language -> Constraints │");
console.log("│  Paste a PRD, README, or design doc                         │");
console.log("│  Auto-extracts locks, typed locks, decisions, notes         │");
console.log("│  Uses Gemini Flash LLM (~$0.01 per 1000 compilations)       │");
console.log("└──────────────────────────────────────────────────────────────┘");

const samplePRD = `
We're building a fintech app for Indian merchants.
- Use React for frontend and FastAPI for backend
- Never touch the auth module — it's been audited
- Response time must stay under 200ms for all API calls
- Payments go through Stripe — don't change the payment gateway
- All user data must be encrypted at rest (AES-256)
- Never store passwords in plain text
- The app must support Hindi and English
- Deploy on AWS — never switch cloud provider
`;

console.log("  Input PRD (8 requirements in natural language):");
console.log("  ───────────────────────────────────────────────");
for (const line of samplePRD.trim().split("\n")) {
  if (line.trim()) console.log("  " + line.trim());
}
console.log("  ───────────────────────────────────────────────");
console.log("\n  Compiling with Gemini Flash...");

try {
  const compiled = await compileSpec(root, samplePRD);
  console.log(`\n  EXTRACTED:`);
  console.log(`    Text locks:  ${compiled.locks?.length || 0}`);
  console.log(`    Typed locks: ${compiled.typedLocks?.length || 0}`);
  console.log(`    Decisions:   ${compiled.decisions?.length || 0}`);
  console.log(`    Notes:       ${compiled.notes?.length || 0}`);
  if (compiled.locks?.length > 0) {
    console.log("\n  Locks:");
    for (const l of compiled.locks) {
      console.log(`    [LOCK] "${l.text}"`);
    }
  }
  if (compiled.typedLocks?.length > 0) {
    console.log("\n  Typed locks:");
    for (const tl of compiled.typedLocks) {
      console.log(`    [TYPED] [${tl.constraintType}] ${tl.description || tl.metric}`);
    }
  }
  if (compiled.decisions?.length > 0) {
    console.log("\n  Decisions:");
    for (const d of compiled.decisions) {
      console.log(`    [DECISION] "${d.text}"`);
    }
  }
  if (compiled.notes?.length > 0) {
    console.log("\n  Notes:");
    for (const n of compiled.notes) {
      console.log(`    [NOTE] "${n.text}"`);
    }
  }
} catch (err) {
  console.log(`  Error: ${err.message}`);
}

// ═══════════════════════════════════════════════════════
// FINAL SUMMARY
// ═══════════════════════════════════════════════════════
console.log("");
console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║               v5.0.0 — COMPLETE FEATURE LIST               ║");
console.log("╠══════════════════════════════════════════════════════════════╣");
console.log("║                                                            ║");
console.log("║  NEW IN v5.0 (Today):                                      ║");
console.log("║  ─────────────────────────────────────────────              ║");
console.log("║  1. Spec Compiler     NL -> constraints (Gemini Flash)     ║");
console.log("║  2. Code Graph        blast radius, lock-to-file mapping   ║");
console.log("║  3. Typed Constraints numerical, range, state, temporal    ║");
console.log("║  4. Python SDK        pip install speclock                 ║");
console.log("║  5. ROS2 Guardian     real-time robot safety enforcement   ║");
console.log("║  6. REST API v2       typed constraints + graph endpoints  ║");
console.log("║                                                            ║");
console.log("║  EXISTING (Already shipped):                               ║");
console.log("║  ─────────────────────────────────────────────              ║");
console.log("║  7.  Semantic Engine v4     99.4% accuracy, 0 FP           ║");
console.log("║  8.  Gemini LLM Hybrid     heuristic + LLM for unknowns   ║");
console.log("║  9.  HMAC Audit Chain       tamper-proof event log         ║");
console.log("║  10. Hard Enforcement       isError blocking, not warns    ║");
console.log("║  11. SOC 2/HIPAA Exports    enterprise compliance          ║");
console.log("║  12. AES-256-GCM            at-rest encryption             ║");
console.log("║  13. RBAC + API Keys        4-role access control          ║");
console.log("║  14. Policy-as-Code         YAML declarative rules         ║");
console.log("║  15. File Guards            SPECLOCK-GUARD headers         ║");
console.log("║  16. Git Pre-Commit Hook    blocks commits at git level    ║");
console.log("║  17. Constraint Templates   nextjs, react, express, etc    ║");
console.log("║  18. Session Continuity     briefings survive compaction   ║");
console.log("║  19. Violation Reports      stats + tracking               ║");
console.log("║  20. 3 Integration Modes    MCP remote/local + npm CLI     ║");
console.log("║                                                            ║");
console.log("╠══════════════════════════════════════════════════════════════╣");
console.log("║  39 MCP Tools | 940 Tests | 13 Suites | 15+ Domains       ║");
console.log("║  MIT License | Free | No API key needed for core features  ║");
console.log("╚══════════════════════════════════════════════════════════════╝");
console.log("");
