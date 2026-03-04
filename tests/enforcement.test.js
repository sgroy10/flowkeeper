// ===================================================================
// SpecLock Enforcement Test Suite (Phase 2 — v2.5)
// Tests hard/advisory enforcement, overrides, escalation, semantic audit.
// Run: node tests/enforcement.test.js
// ===================================================================

import fs from "fs";
import path from "path";
import os from "os";
import {
  enforceConflictCheck,
  setEnforcementMode,
  overrideLock,
  getOverrideHistory,
  getEnforcementConfig,
} from "../src/core/enforcer.js";
import { parseDiff, semanticAudit } from "../src/core/pre-commit-semantic.js";
import {
  ensureSpeclockDirs,
  makeBrain,
  writeBrain,
  readBrain,
  appendEvent,
  nowIso,
  newId,
} from "../src/core/storage.js";
import { ensureAuditKeyGitignored } from "../src/core/audit.js";
import assert from "assert";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL: ${name}`);
    console.log(`    ${err.message}`);
    failed++;
  }
}

function createTestProject(opts = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "speclock-enforce-"));
  ensureSpeclockDirs(root);
  const brain = makeBrain(root, false, "");

  // Add some locks for testing
  const locks = opts.locks || [
    { id: "lock_auth1", text: "Never modify auth files", createdAt: nowIso(), source: "user", tags: [], active: true },
    { id: "lock_db1", text: "Database must always be PostgreSQL", createdAt: nowIso(), source: "user", tags: [], active: true },
    { id: "lock_delete1", text: "Never delete patient records", createdAt: nowIso(), source: "user", tags: [], active: true },
  ];
  brain.specLock.items = locks;

  if (opts.enforcement) {
    brain.enforcement = opts.enforcement;
  }

  writeBrain(root, brain);

  // Write an init event
  const event = { eventId: newId("evt"), type: "init", at: nowIso(), files: [], summary: "Test init", patchPath: "" };
  appendEvent(root, event);

  return root;
}

function cleanup(root) {
  try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
}

// ========================================
console.log("\n--- Category 1: Enforcement Config ---");
// ========================================

test("Default config is advisory mode", () => {
  const root = createTestProject();
  try {
    const brain = readBrain(root);
    const config = getEnforcementConfig(brain);
    assert.strictEqual(config.mode, "advisory");
    assert.strictEqual(config.blockThreshold, 70);
    assert.strictEqual(config.allowOverride, true);
    assert.strictEqual(config.escalationLimit, 3);
  } finally { cleanup(root); }
});

test("setEnforcementMode sets hard mode", () => {
  const root = createTestProject();
  try {
    const result = setEnforcementMode(root, "hard", { blockThreshold: 80 });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.mode, "hard");
    assert.strictEqual(result.config.blockThreshold, 80);
  } finally { cleanup(root); }
});

test("setEnforcementMode rejects invalid mode", () => {
  const root = createTestProject();
  try {
    const result = setEnforcementMode(root, "ultra");
    assert.strictEqual(result.success, false);
    assert(result.error.includes("Invalid mode"));
  } finally { cleanup(root); }
});

test("setEnforcementMode clamps threshold", () => {
  const root = createTestProject();
  try {
    const result = setEnforcementMode(root, "hard", { blockThreshold: 150 });
    assert.strictEqual(result.config.blockThreshold, 100);
  } finally { cleanup(root); }
});

test("setEnforcementMode persists to brain.json", () => {
  const root = createTestProject();
  try {
    setEnforcementMode(root, "hard", { blockThreshold: 85 });
    const brain = readBrain(root);
    assert.strictEqual(brain.enforcement.mode, "hard");
    assert.strictEqual(brain.enforcement.blockThreshold, 85);
  } finally { cleanup(root); }
});

test("setEnforcementMode logs event", () => {
  const root = createTestProject();
  try {
    const brainBefore = readBrain(root);
    const countBefore = brainBefore.events.count;
    setEnforcementMode(root, "hard");
    const brainAfter = readBrain(root);
    assert(brainAfter.events.count > countBefore, "Event count should increase after mode change");
  } finally { cleanup(root); }
});

// ========================================
console.log("\n--- Category 2: Advisory Mode ---");
// ========================================

test("Advisory mode returns warning, not block", () => {
  const root = createTestProject();
  try {
    const result = enforceConflictCheck(root, "Delete patient records from database");
    assert.strictEqual(result.hasConflict, true);
    assert.strictEqual(result.blocked, false);
    assert.strictEqual(result.mode, "advisory");
  } finally { cleanup(root); }
});

test("Advisory mode: no conflict returns clean", () => {
  const root = createTestProject();
  try {
    const result = enforceConflictCheck(root, "Add a new dashboard widget");
    assert.strictEqual(result.hasConflict, false);
    assert.strictEqual(result.blocked, false);
  } finally { cleanup(root); }
});

test("Advisory mode: analysis contains WARNING", () => {
  const root = createTestProject();
  try {
    const result = enforceConflictCheck(root, "Remove authentication from login page");
    assert.strictEqual(result.hasConflict, true);
    assert(result.analysis.includes("WARNING") || result.analysis.includes("Advisory"));
  } finally { cleanup(root); }
});

// ========================================
console.log("\n--- Category 3: Hard Mode ---");
// ========================================

test("Hard mode blocks high-confidence conflicts", () => {
  const root = createTestProject({ enforcement: { mode: "hard", blockThreshold: 70 } });
  try {
    const result = enforceConflictCheck(root, "Delete patient records from database");
    assert.strictEqual(result.hasConflict, true);
    assert.strictEqual(result.blocked, true);
    assert.strictEqual(result.mode, "hard");
  } finally { cleanup(root); }
});

test("Hard mode: analysis contains BLOCKED", () => {
  const root = createTestProject({ enforcement: { mode: "hard", blockThreshold: 70 } });
  try {
    const result = enforceConflictCheck(root, "Remove all patient data");
    assert.strictEqual(result.blocked, true);
    assert(result.analysis.includes("BLOCKED"));
  } finally { cleanup(root); }
});

test("Hard mode allows non-conflicting actions", () => {
  const root = createTestProject({ enforcement: { mode: "hard", blockThreshold: 70 } });
  try {
    const result = enforceConflictCheck(root, "Add a new dashboard chart");
    assert.strictEqual(result.hasConflict, false);
    assert.strictEqual(result.blocked, false);
  } finally { cleanup(root); }
});

test("Hard mode with high threshold allows medium confidence", () => {
  const root = createTestProject({ enforcement: { mode: "hard", blockThreshold: 99 } });
  try {
    // This should have a conflict but below 99% threshold
    const result = enforceConflictCheck(root, "Modify the login form slightly");
    // If there's a conflict, it shouldn't be blocked if below 99%
    if (result.hasConflict) {
      // Only blocked if confidence >= 99
      if (result.topConfidence < 99) {
        assert.strictEqual(result.blocked, false);
      }
    }
  } finally { cleanup(root); }
});

test("Hard mode records violation with enforced=true", () => {
  const root = createTestProject({ enforcement: { mode: "hard", blockThreshold: 70 } });
  try {
    enforceConflictCheck(root, "Delete all patient records");
    const brain = readBrain(root);
    const violations = brain.state.violations || [];
    assert(violations.length > 0);
    assert.strictEqual(violations[0].enforced, true);
    assert.strictEqual(violations[0].mode, "hard");
  } finally { cleanup(root); }
});

test("No locks returns no conflict in hard mode", () => {
  const root = createTestProject({ locks: [], enforcement: { mode: "hard" } });
  try {
    const result = enforceConflictCheck(root, "Delete everything");
    assert.strictEqual(result.hasConflict, false);
    assert.strictEqual(result.blocked, false);
  } finally { cleanup(root); }
});

// ========================================
console.log("\n--- Category 4: Override Mechanism ---");
// ========================================

test("Override succeeds with valid lock and reason", () => {
  const root = createTestProject();
  try {
    const result = overrideLock(root, "lock_auth1", "Adding social login", "User explicitly requested");
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.lockText, "Never modify auth files");
    assert.strictEqual(result.overrideCount, 1);
    assert.strictEqual(result.escalated, false);
  } finally { cleanup(root); }
});

test("Override fails for non-existent lock", () => {
  const root = createTestProject();
  try {
    const result = overrideLock(root, "lock_fake", "test", "test");
    assert.strictEqual(result.success, false);
    assert(result.error.includes("not found"));
  } finally { cleanup(root); }
});

test("Override records to audit trail", () => {
  const root = createTestProject();
  try {
    overrideLock(root, "lock_auth1", "Adding social login", "PM approved");
    const brain = readBrain(root);
    const lock = brain.specLock.items.find(l => l.id === "lock_auth1");
    assert(lock.overrides);
    assert.strictEqual(lock.overrides.length, 1);
    assert.strictEqual(lock.overrides[0].reason, "PM approved");
  } finally { cleanup(root); }
});

test("Override when overrides disabled returns error", () => {
  const root = createTestProject({ enforcement: { allowOverride: false } });
  try {
    const result = overrideLock(root, "lock_auth1", "test", "test");
    assert.strictEqual(result.success, false);
    assert(result.error.includes("disabled"));
  } finally { cleanup(root); }
});

test("Override count increments correctly", () => {
  const root = createTestProject();
  try {
    overrideLock(root, "lock_auth1", "action 1", "reason 1");
    overrideLock(root, "lock_auth1", "action 2", "reason 2");
    const result = overrideLock(root, "lock_auth1", "action 3", "reason 3");
    assert.strictEqual(result.overrideCount, 3);
  } finally { cleanup(root); }
});

// ========================================
console.log("\n--- Category 5: Escalation ---");
// ========================================

test("Escalation triggers at limit (default 3)", () => {
  const root = createTestProject();
  try {
    overrideLock(root, "lock_auth1", "action 1", "reason 1");
    overrideLock(root, "lock_auth1", "action 2", "reason 2");
    const result = overrideLock(root, "lock_auth1", "action 3", "reason 3");
    assert.strictEqual(result.escalated, true);
    assert(result.escalationMessage.includes("overridden 3 times"));
  } finally { cleanup(root); }
});

test("Escalation creates a pinned note", () => {
  const root = createTestProject();
  try {
    overrideLock(root, "lock_auth1", "a1", "r1");
    overrideLock(root, "lock_auth1", "a2", "r2");
    overrideLock(root, "lock_auth1", "a3", "r3");
    const brain = readBrain(root);
    const escalationNote = brain.notes.find(n => n.text.includes("ESCALATION"));
    assert(escalationNote, "Escalation note should exist");
    assert.strictEqual(escalationNote.pinned, true);
  } finally { cleanup(root); }
});

test("Escalation does not trigger before limit", () => {
  const root = createTestProject();
  try {
    overrideLock(root, "lock_auth1", "a1", "r1");
    const result = overrideLock(root, "lock_auth1", "a2", "r2");
    assert.strictEqual(result.escalated, false);
  } finally { cleanup(root); }
});

test("Custom escalation limit works", () => {
  const root = createTestProject({ enforcement: { escalationLimit: 2 } });
  try {
    overrideLock(root, "lock_auth1", "a1", "r1");
    const result = overrideLock(root, "lock_auth1", "a2", "r2");
    assert.strictEqual(result.escalated, true);
  } finally { cleanup(root); }
});

// ========================================
console.log("\n--- Category 6: Override History ---");
// ========================================

test("Override history empty when no overrides", () => {
  const root = createTestProject();
  try {
    const result = getOverrideHistory(root);
    assert.strictEqual(result.total, 0);
    assert.strictEqual(result.overrides.length, 0);
  } finally { cleanup(root); }
});

test("Override history returns all overrides", () => {
  const root = createTestProject();
  try {
    overrideLock(root, "lock_auth1", "a1", "r1");
    overrideLock(root, "lock_db1", "a2", "r2");
    const result = getOverrideHistory(root);
    assert.strictEqual(result.total, 2);
  } finally { cleanup(root); }
});

test("Override history filters by lockId", () => {
  const root = createTestProject();
  try {
    overrideLock(root, "lock_auth1", "a1", "r1");
    overrideLock(root, "lock_db1", "a2", "r2");
    overrideLock(root, "lock_auth1", "a3", "r3");
    const result = getOverrideHistory(root, "lock_auth1");
    assert.strictEqual(result.total, 2);
    assert(result.overrides.every(o => o.lockId === "lock_auth1"));
  } finally { cleanup(root); }
});

// ========================================
console.log("\n--- Category 7: Diff Parser ---");
// ========================================

const sampleDiff = `diff --git a/src/auth.js b/src/auth.js
index abc123..def456 100644
--- a/src/auth.js
+++ b/src/auth.js
@@ -10,6 +10,8 @@ function login(user, pass) {
   const token = generateToken(user);
+  // Added social login support
+  const socialToken = socialAuth(user);
   return token;
 }
diff --git a/src/db.js b/src/db.js
index 111222..333444 100644
--- a/src/db.js
+++ b/src/db.js
@@ -5,7 +5,6 @@ import pg from 'pg';

 export function deleteRecords(table, where) {
-  return db.query(\`DELETE FROM \${table} WHERE \${where}\`);
+  return db.query(\`UPDATE \${table} SET deleted=true WHERE \${where}\`);
 }
`;

test("parseDiff extracts files correctly", () => {
  const files = parseDiff(sampleDiff);
  assert.strictEqual(files.length, 2);
  assert.strictEqual(files[0].file, "src/auth.js");
  assert.strictEqual(files[1].file, "src/db.js");
});

test("parseDiff extracts added lines", () => {
  const files = parseDiff(sampleDiff);
  const authFile = files.find(f => f.file === "src/auth.js");
  assert.strictEqual(authFile.addedLines.length, 2);
  assert(authFile.addedLines.some(l => l.includes("social")));
});

test("parseDiff extracts removed lines", () => {
  const files = parseDiff(sampleDiff);
  const dbFile = files.find(f => f.file === "src/db.js");
  assert.strictEqual(dbFile.removedLines.length, 1);
  assert(dbFile.removedLines[0].includes("DELETE"));
});

test("parseDiff handles empty diff", () => {
  const files = parseDiff("");
  assert.strictEqual(files.length, 0);
});

test("parseDiff handles null diff", () => {
  const files = parseDiff(null);
  assert.strictEqual(files.length, 0);
});

test("parseDiff skips binary files", () => {
  const binaryDiff = `diff --git a/image.png b/image.png
Binary files differ
diff --git a/src/code.js b/src/code.js
--- a/src/code.js
+++ b/src/code.js
@@ -1,3 +1,4 @@
+console.log("hello");
 const x = 1;
`;
  const files = parseDiff(binaryDiff);
  assert.strictEqual(files.length, 1);
  assert.strictEqual(files[0].file, "src/code.js");
});

test("parseDiff extracts hunk context", () => {
  const files = parseDiff(sampleDiff);
  const authFile = files.find(f => f.file === "src/auth.js");
  assert(authFile.hunks.length > 0);
  assert(authFile.hunks[0].context.includes("login"));
});

// ========================================
console.log("\n--- Category 8: End-to-End Enforcement ---");
// ========================================

test("E2E: Advisory → conflict detected → not blocked", () => {
  const root = createTestProject();
  try {
    const r1 = setEnforcementMode(root, "advisory");
    assert.strictEqual(r1.success, true);
    const r2 = enforceConflictCheck(root, "Delete patient records");
    assert.strictEqual(r2.hasConflict, true);
    assert.strictEqual(r2.blocked, false);
  } finally { cleanup(root); }
});

test("E2E: Switch to hard → same action → blocked", () => {
  const root = createTestProject();
  try {
    setEnforcementMode(root, "hard", { blockThreshold: 50 });
    const result = enforceConflictCheck(root, "Delete patient records");
    assert.strictEqual(result.hasConflict, true);
    assert.strictEqual(result.blocked, true);
  } finally { cleanup(root); }
});

test("E2E: Override → then check → still shows conflict", () => {
  const root = createTestProject({ enforcement: { mode: "hard", blockThreshold: 50 } });
  try {
    // Override the lock
    const override = overrideLock(root, "lock_delete1", "Delete old records", "Data retention policy");
    assert.strictEqual(override.success, true);

    // The lock is still active (override doesn't remove it)
    const check = enforceConflictCheck(root, "Delete patient records");
    assert.strictEqual(check.hasConflict, true);
  } finally { cleanup(root); }
});

test("E2E: Full lifecycle — set mode, check, override, check history", () => {
  const root = createTestProject();
  try {
    // 1. Set hard mode
    setEnforcementMode(root, "hard", { blockThreshold: 60 });

    // 2. Check conflict — blocked
    const check = enforceConflictCheck(root, "Remove authentication from the app");
    assert.strictEqual(check.blocked, true);

    // 3. Override
    const override = overrideLock(root, "lock_auth1", "Remove auth", "Migrating to SSO");
    assert.strictEqual(override.success, true);

    // 4. Check history
    const history = getOverrideHistory(root, "lock_auth1");
    assert.strictEqual(history.total, 1);
    assert(history.overrides[0].reason === "Migrating to SSO");
  } finally { cleanup(root); }
});

// ========================================
console.log("\n--- Category 9: Semantic Audit ---");
// ========================================

test("semanticAudit passes with no locks", () => {
  const root = createTestProject({ locks: [] });
  try {
    const result = semanticAudit(root);
    assert.strictEqual(result.passed, true);
  } finally { cleanup(root); }
});

test("semanticAudit returns mode from config", () => {
  const root = createTestProject({ enforcement: { mode: "hard", blockThreshold: 80 } });
  try {
    const result = semanticAudit(root);
    assert.strictEqual(result.mode, "hard");
    // threshold may not be set if no staged diff (early return path)
    assert(result.passed === true || result.threshold !== undefined);
  } finally { cleanup(root); }
});

// ========================================

console.log("\n" + "=".repeat(50));
console.log(`ENFORCEMENT TESTS: ${passed}/${passed + failed} passed, ${failed} failed`);
console.log("=".repeat(50));

if (failed > 0) {
  process.exit(1);
}
