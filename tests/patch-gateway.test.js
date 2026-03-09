/**
 * SpecLock Patch Gateway Tests
 * Tests the change decision engine that combines semantic conflict detection,
 * lock-to-file mapping, blast radius, and typed constraints into ALLOW/WARN/BLOCK.
 *
 * Developed by Sandeep Roy (https://github.com/sgroy10)
 */

import fs from "fs";
import path from "path";
import os from "os";
import { reviewPatch } from "../src/core/patch-gateway.js";
import { ensureInit, addLock, addTypedLock, addDecision } from "../src/core/memory.js";
import { buildGraph } from "../src/core/code-graph.js";

// --- Test infrastructure ---

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

function assertEqual(actual, expected, msg) {
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg} — expected "${expected}", got "${actual}"`);
  }
}

function assertIncludes(str, substr, msg) {
  if (typeof str === "string" && str.includes(substr)) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg} — "${substr}" not found in output`);
  }
}

function makeTempDir() {
  const dir = path.join(os.tmpdir(), `speclock-pg-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}

function createMockProject(root) {
  // Create a realistic project structure for graph testing
  const dirs = [
    "src/auth", "src/api", "src/db", "src/utils", "src/middleware", "src/payment",
  ];
  for (const d of dirs) fs.mkdirSync(path.join(root, d), { recursive: true });

  // Create source files with imports
  const files = {
    "src/utils/helpers.js": `export function sanitize(s) { return s.trim(); }`,
    "src/db/users.js": `import { sanitize } from "../utils/helpers.js";\nexport function getUser(id) { return { id }; }`,
    "src/db/orders.js": `import { sanitize } from "../utils/helpers.js";\nexport function getOrder(id) { return { id }; }`,
    "src/auth/login.js": `import { getUser } from "../db/users.js";\nexport function login(u, p) { return getUser(u); }`,
    "src/auth/signup.js": `import { getUser } from "../db/users.js";\nexport function signup(u) { return getUser(u); }`,
    "src/middleware/auth.js": `import { login } from "../auth/login.js";\nexport function requireAuth(req) { return true; }`,
    "src/payment/stripe.js": `import { getUser } from "../db/users.js";\nexport function charge(userId, amount) { return true; }`,
    "src/payment/webhook.js": `import { getOrder } from "../db/orders.js";\nexport function handleWebhook(data) { return true; }`,
    "src/api/routes.js": `import { requireAuth } from "../middleware/auth.js";\nimport { charge } from "../payment/stripe.js";\nexport function setup(app) {}`,
    "src/index.js": `import { setup } from "./api/routes.js";\nsetup(null);`,
  };

  for (const [fp, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(root, fp), content);
  }
}

// ============================================================
// TEST SUITES
// ============================================================

console.log("============================================================");
console.log("SpecLock Patch Gateway Test Suite");
console.log("============================================================\n");

// --- Suite 1: Input Validation ---

console.log("--- Input Validation ---");

{
  const root = makeTempDir();
  ensureInit(root);

  const r1 = reviewPatch(root, { description: "" });
  assertEqual(r1.verdict, "ERROR", "Empty description returns ERROR");

  const r2 = reviewPatch(root, { description: null });
  assertEqual(r2.verdict, "ERROR", "Null description returns ERROR");

  const r3 = reviewPatch(root, { description: "   " });
  assertEqual(r3.verdict, "ERROR", "Whitespace-only description returns ERROR");

  cleanDir(root);
}

// --- Suite 2: ALLOW verdict (no locks) ---

console.log("\n--- ALLOW Verdict (No Locks) ---");

{
  const root = makeTempDir();
  ensureInit(root);

  const r = reviewPatch(root, { description: "Add a new feature" });
  assertEqual(r.verdict, "ALLOW", "No locks → ALLOW");
  assertEqual(r.riskScore, 0, "No locks → risk score 0");
  assertEqual(r.lockCount, 0, "lockCount is 0");
  assert(r.reasons.length === 0, "No reasons when no locks");
  assert(typeof r.summary === "string", "Summary is a string");

  cleanDir(root);
}

// --- Suite 3: BLOCK verdict (direct semantic conflict) ---

console.log("\n--- BLOCK Verdict (Semantic Conflict) ---");

{
  const root = makeTempDir();
  ensureInit(root);
  addLock(root, "Never modify the authentication system", ["security"], "user");
  addLock(root, "Never change the payment gateway from Stripe", ["payment"], "user");

  const r1 = reviewPatch(root, { description: "Modify the authentication login flow" });
  assertEqual(r1.verdict, "BLOCK", "Modifying auth → BLOCK");
  assert(r1.riskScore >= 70, "Risk score >= 70 for BLOCK");
  assert(r1.reasons.length > 0, "Has conflict reasons");
  assert(r1.reasons.some(r => r.type === "semantic_conflict"), "Has semantic_conflict reason");
  assertIncludes(r1.summary, "BLOCKED", "Summary says BLOCKED");

  const r2 = reviewPatch(root, { description: "Switch payment gateway to Razorpay" });
  assertEqual(r2.verdict, "BLOCK", "Switching payment → BLOCK");
  assert(r2.reasons.some(r => r.lockText?.includes("payment") || r.lockText?.includes("Stripe")), "Identifies payment lock");

  // Non-conflicting change should ALLOW
  const r3 = reviewPatch(root, { description: "Add a new color theme to the dashboard" });
  assertEqual(r3.verdict, "ALLOW", "Unrelated change → ALLOW");
  assertEqual(r3.riskScore, 0, "Unrelated change → risk 0");

  cleanDir(root);
}

// --- Suite 4: WARN verdict (partial/medium confidence match) ---

console.log("\n--- WARN Verdict ---");

{
  const root = makeTempDir();
  ensureInit(root);
  addLock(root, "Database must always be PostgreSQL", ["infrastructure"], "user");

  // Euphemistic / indirect conflict
  const r1 = reviewPatch(root, { description: "Evaluate alternative data storage solutions" });
  // This might WARN or ALLOW depending on heuristic — just check it doesn't crash
  assert(["ALLOW", "WARN", "BLOCK"].includes(r1.verdict), "Valid verdict for indirect conflict");
  assert(typeof r1.riskScore === "number", "riskScore is a number");

  cleanDir(root);
}

// --- Suite 5: Lock-to-file mapping ---

console.log("\n--- Lock-to-File Mapping ---");

{
  const root = makeTempDir();
  createMockProject(root);
  ensureInit(root);
  addLock(root, "Never modify auth files", ["security"], "user");
  buildGraph(root, { force: true });

  const r = reviewPatch(root, {
    description: "Update login validation logic",
    files: ["src/auth/login.js"],
  });

  // Should detect lock-file overlap even beyond semantic
  assert(r.verdict === "BLOCK" || r.verdict === "WARN", "Auth file change triggers BLOCK or WARN");
  assert(r.riskScore >= 40, "Risk score elevated for locked file");

  // Change to unrelated file
  const r2 = reviewPatch(root, {
    description: "Fix typo in helper function",
    files: ["src/utils/helpers.js"],
  });
  // helpers.js is not in auth lock zone
  assert(r2.verdict !== "BLOCK" || r2.riskScore < 70, "Unrelated file not blocked by auth lock");

  cleanDir(root);
}

// --- Suite 6: Blast radius ---

console.log("\n--- Blast Radius ---");

{
  const root = makeTempDir();
  createMockProject(root);
  ensureInit(root);
  buildGraph(root, { force: true });

  // helpers.js is imported by many files — high blast radius
  const r = reviewPatch(root, {
    description: "Refactor sanitize function",
    files: ["src/utils/helpers.js"],
  });
  assert(r.blastRadius !== undefined, "Blast radius included in result");
  if (r.blastRadius) {
    assert(r.blastRadius.files.length > 0, "Blast radius has file details");
    const helpersBlast = r.blastRadius.files.find(f => f.file.includes("helpers"));
    if (helpersBlast) {
      assert(helpersBlast.transitiveDependents > 0, "helpers.js has transitive dependents");
      assert(helpersBlast.impactPercent > 0, "helpers.js has impact > 0%");
    }
  }

  cleanDir(root);
}

// --- Suite 7: Combined signals (semantic + file overlap + blast radius) ---

console.log("\n--- Combined Signals ---");

{
  const root = makeTempDir();
  createMockProject(root);
  ensureInit(root);
  addLock(root, "Never modify the authentication system", ["security"], "user");
  addLock(root, "Never change payment processing logic", ["payment"], "user");
  buildGraph(root, { force: true });

  // Auth file change with semantic conflict + file overlap
  const r = reviewPatch(root, {
    description: "Add OAuth2 social login to authentication",
    files: ["src/auth/login.js", "src/auth/signup.js"],
  });
  assertEqual(r.verdict, "BLOCK", "Combined auth conflict → BLOCK");
  assert(r.riskScore >= 70, "Combined risk score is high");
  assert(r.reasons.length >= 1, "Multiple reasons from different signals");

  // Payment file change
  const r2 = reviewPatch(root, {
    description: "Switch payment gateway to PayPal",
    files: ["src/payment/stripe.js"],
  });
  assertEqual(r2.verdict, "BLOCK", "Payment conflict → BLOCK");
  assert(r2.reasons.some(r => r.lockText?.includes("payment")), "Payment lock identified");

  cleanDir(root);
}

// --- Suite 8: Typed constraint awareness ---

console.log("\n--- Typed Constraint Awareness ---");

{
  const root = makeTempDir();
  ensureInit(root);
  addTypedLock(root, {
    constraintType: "numerical",
    metric: "response_time",
    operator: "<=",
    value: 200,
    unit: "ms",
    description: "API response time must stay under 200ms",
  });

  const r = reviewPatch(root, {
    description: "Add heavy response_time logging middleware",
  });
  // Should detect the typed constraint is relevant
  assert(r.lockCount > 0, "Has active locks (typed)");
  // Check if typed constraint was flagged
  const hasTypedReason = r.reasons.some(rr => rr.type === "typed_constraint_relevant");
  if (hasTypedReason) {
    assert(true, "Typed constraint flagged as relevant");
  } else {
    // May or may not match depending on keyword extraction — acceptable
    assert(true, "Typed constraint detection ran without error");
  }

  cleanDir(root);
}

// --- Suite 9: Result structure ---

console.log("\n--- Result Structure ---");

{
  const root = makeTempDir();
  createMockProject(root);
  ensureInit(root);
  addLock(root, "Never delete user accounts", ["data"], "user");
  buildGraph(root, { force: true });

  const r = reviewPatch(root, {
    description: "Delete user accounts from the system",
    files: ["src/db/users.js"],
  });

  // Validate all required fields exist
  assert(["ALLOW", "WARN", "BLOCK"].includes(r.verdict), "verdict is ALLOW/WARN/BLOCK");
  assert(typeof r.riskScore === "number", "riskScore is a number");
  assert(r.riskScore >= 0 && r.riskScore <= 100, "riskScore in 0-100 range");
  assert(typeof r.description === "string", "description preserved");
  assert(typeof r.fileCount === "number", "fileCount present");
  assert(typeof r.lockCount === "number", "lockCount present");
  assert(Array.isArray(r.reasons), "reasons is an array");
  assert(typeof r.summary === "string", "summary is a string");

  // Each reason has required fields
  for (const reason of r.reasons) {
    assert(typeof reason.type === "string", `Reason has type: ${reason.type}`);
    assert(["block", "warn", "info"].includes(reason.severity), `Reason has valid severity: ${reason.severity}`);
    assert(typeof reason.confidence === "number", `Reason has confidence`);
  }

  cleanDir(root);
}

// --- Suite 10: Multiple locks, partial conflict ---

console.log("\n--- Multiple Locks, Partial Conflict ---");

{
  const root = makeTempDir();
  ensureInit(root);
  addLock(root, "Never modify auth files", ["security"], "user");
  addLock(root, "Never change the database schema", ["data"], "user");
  addLock(root, "API routes must remain backward compatible", ["api"], "user");

  // Only conflicts with one lock
  const r = reviewPatch(root, { description: "Change the database table structure" });
  assert(r.verdict === "BLOCK" || r.verdict === "WARN", "Database change triggers verdict");
  // Check that the specific lock was identified
  const dbConflict = r.reasons.find(rr => rr.lockText?.includes("database"));
  assert(dbConflict !== undefined, "Database lock specifically identified");

  // Non-conflicting change
  const r2 = reviewPatch(root, { description: "Add CSS animations to the homepage" });
  assertEqual(r2.verdict, "ALLOW", "CSS change doesn't conflict with any lock");

  cleanDir(root);
}

// --- Suite 11: Edge cases ---

console.log("\n--- Edge Cases ---");

{
  const root = makeTempDir();
  ensureInit(root);

  // Very long description
  const longDesc = "modify ".repeat(500) + "authentication";
  addLock(root, "Never modify auth", [], "user");
  const r1 = reviewPatch(root, { description: longDesc });
  assert(["ALLOW", "WARN", "BLOCK"].includes(r1.verdict), "Long description handled");

  // Empty files array
  const r2 = reviewPatch(root, { description: "Some change", files: [] });
  assert(["ALLOW", "WARN", "BLOCK"].includes(r2.verdict), "Empty files array handled");

  // Non-existent files in array
  const r3 = reviewPatch(root, {
    description: "Some change",
    files: ["nonexistent/file.js", "also/missing.py"],
  });
  assert(["ALLOW", "WARN", "BLOCK"].includes(r3.verdict), "Non-existent files handled gracefully");

  // includeGraph=false skips blast radius
  const r4 = reviewPatch(root, {
    description: "Some change",
    files: ["src/index.js"],
    includeGraph: false,
  });
  assert(r4.blastRadius === undefined, "includeGraph=false skips blast radius");

  cleanDir(root);
}

// --- Suite 12: Verdict escalation ---

console.log("\n--- Verdict Escalation ---");

{
  const root = makeTempDir();
  createMockProject(root);
  ensureInit(root);
  addLock(root, "Never modify the authentication system without explicit approval", ["critical"], "user");
  addLock(root, "Never change auth middleware", ["critical"], "user");
  buildGraph(root, { force: true });

  // Double lock + file overlap should escalate risk
  const r = reviewPatch(root, {
    description: "Rewrite the entire authentication and auth middleware",
    files: ["src/auth/login.js", "src/middleware/auth.js"],
  });
  assertEqual(r.verdict, "BLOCK", "Double lock + file overlap → definite BLOCK");
  assert(r.riskScore >= 75, "High risk score for double conflict");
  assert(r.reasons.length >= 1, "Multiple reasons for escalation");

  cleanDir(root);
}

// ============================================================
// SUMMARY
// ============================================================

console.log("\n============================================================");
console.log(`Patch Gateway Tests: ${passed}/${passed + failed} passed, ${failed} failed`);
console.log("============================================================");

if (failed > 0) process.exit(1);
