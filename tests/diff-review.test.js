/**
 * SpecLock Diff-Native Patch Review Tests
 * Tests diff parsing, signal extraction, scoring, and unified review.
 *
 * Developed by Sandeep Roy (https://github.com/sgroy10)
 */

import fs from "fs";
import path from "path";
import os from "os";
import { parseDiff } from "../src/core/diff-parser.js";
import { analyzeDiff, calculateVerdict } from "../src/core/diff-analyzer.js";
import { reviewPatchDiff, reviewPatchUnified } from "../src/core/patch-gateway.js";
import { ensureInit, addLock, addTypedLock } from "../src/core/memory.js";
import { buildGraph } from "../src/core/code-graph.js";

// --- Test infrastructure ---

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ FAIL: ${msg}`); }
}

function assertEqual(actual, expected, msg) {
  if (actual === expected) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ FAIL: ${msg} — expected "${expected}", got "${actual}"`); }
}

function makeTempDir() {
  const dir = path.join(os.tmpdir(), `speclock-dr-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}

function createMockProject(root) {
  const dirs = ["src/auth", "src/api", "src/db", "src/utils", "src/middleware", "src/payment"];
  for (const d of dirs) fs.mkdirSync(path.join(root, d), { recursive: true });

  const files = {
    "src/utils/helpers.js": `export function sanitize(s) { return s.trim(); }`,
    "src/db/users.js": `import { sanitize } from "../utils/helpers.js";\nexport function getUser(id) { return { id }; }`,
    "src/auth/login.js": `import { getUser } from "../db/users.js";\nexport function login(u, p) { return getUser(u); }`,
    "src/auth/signup.js": `import { getUser } from "../db/users.js";\nexport function signup(u) { return getUser(u); }`,
    "src/middleware/auth.js": `import { login } from "../auth/login.js";\nexport function requireAuth(req) { return true; }`,
    "src/payment/stripe.js": `import { getUser } from "../db/users.js";\nexport function charge(userId, amount) { return true; }`,
    "src/api/routes.js": `import { requireAuth } from "../middleware/auth.js";\napp.get("/users", requireAuth, handler);\napp.post("/login", loginHandler);`,
  };

  for (const [fp, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(root, fp), content);
  }
}

// --- Sample diffs ---

const SIMPLE_DIFF = `diff --git a/src/utils/helpers.js b/src/utils/helpers.js
--- a/src/utils/helpers.js
+++ b/src/utils/helpers.js
@@ -1,3 +1,5 @@
-export function sanitize(s) { return s.trim(); }
+export function sanitize(s, options = {}) {
+  if (options.strict) return s.trim().toLowerCase();
+  return s.trim();
+}
`;

const IMPORT_CHANGE_DIFF = `diff --git a/src/auth/login.js b/src/auth/login.js
--- a/src/auth/login.js
+++ b/src/auth/login.js
@@ -1,3 +1,5 @@
 import { getUser } from "../db/users.js";
-import { hash } from "bcrypt";
+import { hash } from "argon2";
+import jwt from "jsonwebtoken";
 export function login(u, p) { return getUser(u); }
`;

const EXPORT_REMOVED_DIFF = `diff --git a/src/auth/login.js b/src/auth/login.js
--- a/src/auth/login.js
+++ b/src/auth/login.js
@@ -1,4 +1,3 @@
 import { getUser } from "../db/users.js";
-export function login(u, p) { return getUser(u); }
-export function validateToken(t) { return true; }
+export function login(u, p) { return getUser(u); }
`;

const ROUTE_CHANGE_DIFF = `diff --git a/src/api/routes.js b/src/api/routes.js
--- a/src/api/routes.js
+++ b/src/api/routes.js
@@ -1,3 +1,4 @@
 import { requireAuth } from "../middleware/auth.js";
-app.get("/users", requireAuth, handler);
+app.get("/api/v2/users", requireAuth, handler);
 app.post("/login", loginHandler);
+app.delete("/users/:id", requireAuth, deleteHandler);
`;

const SCHEMA_DIFF = `diff --git a/migrations/001_create_users.sql b/migrations/001_create_users.sql
--- a/migrations/001_create_users.sql
+++ b/migrations/001_create_users.sql
@@ -1,5 +1,4 @@
 CREATE TABLE users (
   id SERIAL PRIMARY KEY,
-  email VARCHAR(255) UNIQUE NOT NULL,
-  password_hash VARCHAR(255) NOT NULL
+  email VARCHAR(255) UNIQUE NOT NULL
 );
`;

const MULTI_FILE_DIFF = `diff --git a/src/auth/login.js b/src/auth/login.js
--- a/src/auth/login.js
+++ b/src/auth/login.js
@@ -1,3 +1,4 @@
 import { getUser } from "../db/users.js";
+import { verify } from "jsonwebtoken";
 export function login(u, p) { return getUser(u); }
+export function verifySession(token) { return verify(token, SECRET); }
diff --git a/src/middleware/auth.js b/src/middleware/auth.js
--- a/src/middleware/auth.js
+++ b/src/middleware/auth.js
@@ -1,2 +1,3 @@
 import { login } from "../auth/login.js";
-export function requireAuth(req) { return true; }
+import { verifySession } from "../auth/login.js";
+export function requireAuth(req) { return verifySession(req.token); }
`;

const PYTHON_DIFF = `diff --git a/app/auth/views.py b/app/auth/views.py
--- a/app/auth/views.py
+++ b/app/auth/views.py
@@ -1,5 +1,6 @@
-from flask import request
+from flask import request, jsonify
+import jwt

 def login():
-    pass
+    return jsonify({"token": jwt.encode({}, "secret")})
`;

// ============================================================
console.log("============================================================");
console.log("SpecLock Diff-Native Review Test Suite");
console.log("============================================================\n");

// --- Suite 1: Diff Parser Basics ---

console.log("--- Diff Parser: Basics ---");

{
  const r = parseDiff("");
  assertEqual(r.stats.filesChanged, 0, "Empty diff → 0 files");

  const r2 = parseDiff(null);
  assertEqual(r2.stats.filesChanged, 0, "Null diff → 0 files");

  const r3 = parseDiff(SIMPLE_DIFF);
  assertEqual(r3.stats.filesChanged, 1, "Simple diff → 1 file");
  assert(r3.files[0].path === "src/utils/helpers.js", "Correct file path extracted");
  assert(r3.files[0].additions > 0, "Has additions");
  assert(r3.files[0].deletions > 0, "Has deletions");
  assertEqual(r3.files[0].language, "javascript", "Detects JavaScript language");
}

// --- Suite 2: Import Detection ---

console.log("\n--- Diff Parser: Import Detection ---");

{
  const r = parseDiff(IMPORT_CHANGE_DIFF);
  const file = r.files[0];
  assert(file.importsAdded.includes("argon2"), "Detects added import: argon2");
  assert(file.importsAdded.includes("jsonwebtoken"), "Detects added import: jsonwebtoken");
  assert(file.importsRemoved.includes("bcrypt"), "Detects removed import: bcrypt");
}

// --- Suite 3: Export Detection ---

console.log("\n--- Diff Parser: Export Detection ---");

{
  const r = parseDiff(EXPORT_REMOVED_DIFF);
  const file = r.files[0];
  assert(file.exportsRemoved.length > 0, "Detects removed exports");
  assert(file.exportsRemoved.some(e => e.symbol === "validateToken"), "Identifies removed export: validateToken");
}

// --- Suite 4: Route Detection ---

console.log("\n--- Diff Parser: Route Detection ---");

{
  const r = parseDiff(ROUTE_CHANGE_DIFF);
  const file = r.files[0];
  assert(file.routeChanges.length > 0, "Detects route changes");
  const deleteRoute = file.routeChanges.find(rc => rc.method === "DELETE");
  assert(deleteRoute !== undefined, "Detects new DELETE route");
  assert(deleteRoute?.path === "/users/:id", "Correct route path");
}

// --- Suite 5: Schema Detection ---

console.log("\n--- Diff Parser: Schema/Migration Detection ---");

{
  const r = parseDiff(SCHEMA_DIFF);
  const file = r.files[0];
  assert(file.isSchemaFile, "Detects schema/migration file");
  assert(file.deletions > 0, "Has deletions in schema file");
}

// --- Suite 6: Multi-file Parsing ---

console.log("\n--- Diff Parser: Multi-file ---");

{
  const r = parseDiff(MULTI_FILE_DIFF);
  assertEqual(r.stats.filesChanged, 2, "Parses 2 files");
  assert(r.files.some(f => f.path === "src/auth/login.js"), "Has auth/login.js");
  assert(r.files.some(f => f.path === "src/middleware/auth.js"), "Has middleware/auth.js");
}

// --- Suite 7: Python Diff ---

console.log("\n--- Diff Parser: Python ---");

{
  const r = parseDiff(PYTHON_DIFF);
  const file = r.files[0];
  assertEqual(file.language, "python", "Detects Python language");
  assert(file.importsAdded.includes("jwt"), "Detects Python import: jwt");
}

// --- Suite 8: Signal Scoring ---

console.log("\n--- Signal Scoring ---");

{
  const root = makeTempDir();
  createMockProject(root);
  ensureInit(root);
  addLock(root, "Never modify auth files", ["security"], "user");
  buildGraph(root, { force: true });

  const parsed = parseDiff(MULTI_FILE_DIFF);
  const { signals, reasons } = analyzeDiff(root, parsed, "Refactor auth login", {});

  assert(typeof signals.semanticConflict === "object", "Has semanticConflict signal");
  assert(typeof signals.interfaceBreak === "object", "Has interfaceBreak signal");
  assert(typeof signals.protectedSymbolEdit === "object", "Has protectedSymbolEdit signal");
  assert(typeof signals.dependencyDrift === "object", "Has dependencyDrift signal");
  assert(typeof signals.schemaChange === "object", "Has schemaChange signal");
  assert(typeof signals.publicApiImpact === "object", "Has publicApiImpact signal");
  assert(typeof signals.typedConstraintRelevance === "object", "Has typedConstraintRelevance signal");

  // Auth lock should trigger semantic conflict
  assert(signals.semanticConflict.score > 0, "Semantic conflict detected for auth change");

  cleanDir(root);
}

// --- Suite 9: Interface Break Scoring ---

console.log("\n--- Interface Break Scoring ---");

{
  const root = makeTempDir();
  ensureInit(root);

  const parsed = parseDiff(EXPORT_REMOVED_DIFF);
  const { signals } = analyzeDiff(root, parsed, "Remove validateToken export", {});

  assert(signals.interfaceBreak.score > 0, "Interface break detected for removed export");
  assert(signals.interfaceBreak.changes.length > 0, "Has interface break changes");
  assert(signals.interfaceBreak.changes.some(c => c.changeType === "removed"), "Identifies removed export");

  cleanDir(root);
}

// --- Suite 10: Dependency Drift Scoring ---

console.log("\n--- Dependency Drift Scoring ---");

{
  const root = makeTempDir();
  ensureInit(root);

  const parsed = parseDiff(IMPORT_CHANGE_DIFF);
  const { signals } = analyzeDiff(root, parsed, "Switch to argon2 and add JWT", {});

  assert(signals.dependencyDrift.score > 0, "Dependency drift detected");
  assert(signals.dependencyDrift.changes.length > 0, "Has dependency changes");

  cleanDir(root);
}

// --- Suite 11: Schema Change Scoring ---

console.log("\n--- Schema Change Scoring ---");

{
  const root = makeTempDir();
  ensureInit(root);

  const parsed = parseDiff(SCHEMA_DIFF);
  const { signals } = analyzeDiff(root, parsed, "Remove password_hash column", {});

  assert(signals.schemaChange.score > 0, "Schema change detected");
  assert(signals.schemaChange.changes.length > 0, "Has schema changes");
  assert(signals.schemaChange.changes[0].isDestructive, "Identifies destructive schema change");

  cleanDir(root);
}

// --- Suite 12: Public API Impact Scoring ---

console.log("\n--- Public API Impact Scoring ---");

{
  const root = makeTempDir();
  ensureInit(root);

  const parsed = parseDiff(ROUTE_CHANGE_DIFF);
  const { signals } = analyzeDiff(root, parsed, "Rename user route", {});

  assert(signals.publicApiImpact.score > 0, "Public API impact detected");
  assert(signals.publicApiImpact.changes.length > 0, "Has route changes");

  cleanDir(root);
}

// --- Suite 13: Verdict Calculation ---

console.log("\n--- Verdict Calculation ---");

{
  // Low risk → ALLOW
  const allow = calculateVerdict(
    { semanticConflict: { score: 5 }, lockFileOverlap: { score: 0 }, blastRadius: { score: 0 },
      interfaceBreak: { score: 0 }, protectedSymbolEdit: { score: 0 }, dependencyDrift: { score: 2 },
      schemaChange: { score: 0 }, publicApiImpact: { score: 0 }, typedConstraintRelevance: { score: 0 },
      llmConflict: { score: 0 } },
    []
  );
  assertEqual(allow.verdict, "ALLOW", "Low risk → ALLOW");
  assert(allow.riskScore < 25, "ALLOW has low risk score");

  // Medium risk → WARN
  const warn = calculateVerdict(
    { semanticConflict: { score: 15 }, lockFileOverlap: { score: 10 }, blastRadius: { score: 5 },
      interfaceBreak: { score: 0 }, protectedSymbolEdit: { score: 0 }, dependencyDrift: { score: 2 },
      schemaChange: { score: 0 }, publicApiImpact: { score: 0 }, typedConstraintRelevance: { score: 0 },
      llmConflict: { score: 0 } },
    []
  );
  assertEqual(warn.verdict, "WARN", "Medium risk → WARN");
  assert(warn.riskScore >= 25 && warn.riskScore < 50, "WARN has medium risk score");

  // High risk → BLOCK
  const block = calculateVerdict(
    { semanticConflict: { score: 20 }, lockFileOverlap: { score: 20 }, blastRadius: { score: 15 },
      interfaceBreak: { score: 10 }, protectedSymbolEdit: { score: 10 }, dependencyDrift: { score: 5 },
      schemaChange: { score: 0 }, publicApiImpact: { score: 0 }, typedConstraintRelevance: { score: 0 },
      llmConflict: { score: 0 } },
    []
  );
  assertEqual(block.verdict, "BLOCK", "High risk → BLOCK");
  assert(block.riskScore >= 50, "BLOCK has high risk score");
}

// --- Suite 14: Hard Escalation Rules ---

console.log("\n--- Hard Escalation Rules ---");

{
  // Destructive schema → BLOCK regardless of score
  const schema = calculateVerdict(
    { semanticConflict: { score: 0 }, lockFileOverlap: { score: 0 }, blastRadius: { score: 0 },
      interfaceBreak: { score: 0 }, protectedSymbolEdit: { score: 0 }, dependencyDrift: { score: 0 },
      schemaChange: { score: 5 }, publicApiImpact: { score: 0 }, typedConstraintRelevance: { score: 0 },
      llmConflict: { score: 0 } },
    [{ type: "schema_change", severity: "critical", confidence: 0.95, message: "Destructive" }]
  );
  assertEqual(schema.verdict, "BLOCK", "Destructive schema → hard BLOCK");

  // API route removed → BLOCK
  const api = calculateVerdict(
    { semanticConflict: { score: 0 }, lockFileOverlap: { score: 0 }, blastRadius: { score: 0 },
      interfaceBreak: { score: 0 }, protectedSymbolEdit: { score: 0 }, dependencyDrift: { score: 0 },
      schemaChange: { score: 0 }, publicApiImpact: { score: 5 }, typedConstraintRelevance: { score: 0 },
      llmConflict: { score: 0 } },
    [{ type: "public_api_impact", severity: "critical", confidence: 0.95, message: "Route removed" }]
  );
  assertEqual(api.verdict, "BLOCK", "API route removed → hard BLOCK");

  // Multiple critical high-confidence → BLOCK
  const multi = calculateVerdict(
    { semanticConflict: { score: 5 }, lockFileOverlap: { score: 5 }, blastRadius: { score: 0 },
      interfaceBreak: { score: 0 }, protectedSymbolEdit: { score: 0 }, dependencyDrift: { score: 0 },
      schemaChange: { score: 0 }, publicApiImpact: { score: 0 }, typedConstraintRelevance: { score: 0 },
      llmConflict: { score: 0 } },
    [
      { type: "lock_file_overlap", severity: "critical", confidence: 0.99, message: "Lock overlap" },
      { type: "protected_symbol_edit", severity: "critical", confidence: 0.93, message: "Symbol edit" },
    ]
  );
  assertEqual(multi.verdict, "BLOCK", "Multiple critical reasons → hard BLOCK");
}

// --- Suite 15: reviewPatchDiff Full Integration ---

console.log("\n--- reviewPatchDiff Integration ---");

{
  const root = makeTempDir();
  createMockProject(root);
  ensureInit(root);
  addLock(root, "Never modify auth files", ["security"], "user");
  addLock(root, "Never change payment processing", ["payment"], "user");
  buildGraph(root, { force: true });

  // Auth change with diff
  const r = reviewPatchDiff(root, {
    description: "Refactor auth login",
    diff: MULTI_FILE_DIFF,
  });
  assertEqual(r.reviewMode, "diff-native", "Review mode is diff-native");
  assert(r.verdict === "BLOCK" || r.verdict === "WARN", "Auth change triggers non-ALLOW");
  assert(r.riskScore > 0, "Has non-zero risk score");
  assert(r.signals !== undefined, "Has signals object");
  assert(r.parsedDiff !== undefined, "Has parsedDiff stats");
  assert(r.reasons.length > 0, "Has reasons");
  assert(typeof r.summary === "string", "Has summary");
  assert(r.recommendation !== undefined, "Has recommendation");

  // Error cases
  const e1 = reviewPatchDiff(root, { description: "", diff: "something" });
  assertEqual(e1.verdict, "ERROR", "Empty description → ERROR");

  const e2 = reviewPatchDiff(root, { description: "something", diff: "" });
  assertEqual(e2.verdict, "ERROR", "Empty diff → ERROR");

  cleanDir(root);
}

// --- Suite 16: reviewPatchUnified Integration ---

console.log("\n--- reviewPatchUnified Integration ---");

{
  const root = makeTempDir();
  createMockProject(root);
  ensureInit(root);
  addLock(root, "Never modify auth files", ["security"], "user");
  buildGraph(root, { force: true });

  // With diff → unified mode
  const r1 = reviewPatchUnified(root, {
    description: "Refactor auth login",
    diff: MULTI_FILE_DIFF,
  });
  assertEqual(r1.reviewMode, "unified", "With diff → unified mode");
  assert(r1.intentVerdict !== undefined, "Has intentVerdict");
  assert(r1.diffVerdict !== undefined, "Has diffVerdict");
  assert(r1.intentRisk !== undefined, "Has intentRisk");
  assert(r1.diffRisk !== undefined, "Has diffRisk");
  assert(typeof r1.riskScore === "number", "Has merged risk score");

  // Without diff → intent-only mode
  const r2 = reviewPatchUnified(root, {
    description: "Add new dashboard feature",
  });
  assertEqual(r2.reviewMode, "intent-only", "Without diff → intent-only mode");

  cleanDir(root);
}

// --- Suite 17: Recommendation Field ---

console.log("\n--- Recommendation ---");

{
  const allow = calculateVerdict(
    { semanticConflict: { score: 0 }, lockFileOverlap: { score: 0 }, blastRadius: { score: 0 },
      interfaceBreak: { score: 0 }, protectedSymbolEdit: { score: 0 }, dependencyDrift: { score: 0 },
      schemaChange: { score: 0 }, publicApiImpact: { score: 0 }, typedConstraintRelevance: { score: 0 },
      llmConflict: { score: 0 } },
    []
  );
  assertEqual(allow.recommendation.action, "safe_to_proceed", "ALLOW → safe_to_proceed");

  const block = calculateVerdict(
    { semanticConflict: { score: 20 }, lockFileOverlap: { score: 20 }, blastRadius: { score: 15 },
      interfaceBreak: { score: 10 }, protectedSymbolEdit: { score: 10 }, dependencyDrift: { score: 5 },
      schemaChange: { score: 0 }, publicApiImpact: { score: 0 }, typedConstraintRelevance: { score: 0 },
      llmConflict: { score: 0 } },
    []
  );
  assertEqual(block.recommendation.action, "require_approval", "BLOCK → require_approval");
}

// --- Suite 18: Parsed Diff Stats ---

console.log("\n--- Parsed Diff Stats ---");

{
  const r = parseDiff(MULTI_FILE_DIFF);
  assertEqual(r.stats.filesChanged, 2, "Stats: correct file count");
  assert(r.stats.additions > 0, "Stats: has additions");
  assert(r.stats.deletions > 0, "Stats: has deletions");
  assert(r.stats.hunks > 0, "Stats: has hunks");
}

// --- Suite 19: Symbol Detection ---

console.log("\n--- Symbol Detection ---");

{
  const r = parseDiff(MULTI_FILE_DIFF);
  const authFile = r.files.find(f => f.path === "src/middleware/auth.js");
  // requireAuth was modified (removed old, added new)
  const hasTouched = authFile?.symbolsTouched.length > 0 || authFile?.exportsModified.length > 0;
  assert(hasTouched, "Detects symbol changes in middleware/auth.js");
}

// --- Suite 20: Edge Cases ---

console.log("\n--- Edge Cases ---");

{
  // Diff with no actual changes (just context)
  const emptyDiff = `diff --git a/src/index.js b/src/index.js
--- a/src/index.js
+++ b/src/index.js
@@ -1,3 +1,3 @@
 const x = 1;
 const y = 2;
 const z = 3;
`;
  const r1 = parseDiff(emptyDiff);
  assertEqual(r1.stats.additions, 0, "No-change diff → 0 additions");
  assertEqual(r1.stats.deletions, 0, "No-change diff → 0 deletions");

  // Very large diff (should not crash)
  let largeDiff = "diff --git a/big.js b/big.js\n--- a/big.js\n+++ b/big.js\n@@ -1,1 +1,1000 @@\n";
  for (let i = 0; i < 1000; i++) largeDiff += `+const line${i} = ${i};\n`;
  const r2 = parseDiff(largeDiff);
  assert(r2.stats.additions >= 900, "Large diff parsed without crash");
}

// ============================================================
console.log("\n============================================================");
console.log(`Diff-Native Review Tests: ${passed}/${passed + failed} passed, ${failed} failed`);
console.log("============================================================");

if (failed > 0) process.exit(1);
