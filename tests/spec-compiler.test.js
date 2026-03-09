// ===================================================================
// SpecLock Spec Compiler Test Suite
// Tests natural language → structured constraints compilation.
// Run: node tests/spec-compiler.test.js
// ===================================================================

import fs from "fs";
import path from "path";
import os from "os";
import {
  compileSpec,
  compileFile,
  compileAndApply,
} from "../src/core/spec-compiler.js";
import { parseJsonResponse } from "../src/core/llm-provider.js";
import { ensureInit } from "../src/core/memory.js";
import { readBrain } from "../src/core/storage.js";
import { validateTypedLock } from "../src/core/typed-constraints.js";

let passed = 0;
let failed = 0;
const failures = [];
const categories = {};

function test(category, name, fn) {
  if (!categories[category]) categories[category] = { passed: 0, failed: 0, total: 0 };
  categories[category].total++;

  try {
    fn();
    passed++;
    categories[category].passed++;
  } catch (e) {
    failed++;
    categories[category].failed++;
    failures.push({ category, name, error: e.message });
  }
}

async function testAsync(category, name, fn) {
  if (!categories[category]) categories[category] = { passed: 0, failed: 0, total: 0 };
  categories[category].total++;

  try {
    await fn();
    passed++;
    categories[category].passed++;
  } catch (e) {
    failed++;
    categories[category].failed++;
    failures.push({ category, name, error: e.message });
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || "Assertion failed");
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || "Mismatch"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "speclock-compiler-test-"));
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}

// ============================================================
// INPUT VALIDATION
// ============================================================

await testAsync("input-validation", "empty text returns error", async () => {
  const tmpDir = makeTempDir();
  try {
    const result = await compileSpec(tmpDir, "");
    assert(!result.success, "Should fail for empty text");
    assert(result.error.includes("empty"), "Error should mention empty");
    assertEqual(result.locks.length, 0, "Should have no locks");
    assertEqual(result.typedLocks.length, 0, "Should have no typed locks");
    assertEqual(result.decisions.length, 0, "Should have no decisions");
    assertEqual(result.notes.length, 0, "Should have no notes");
  } finally {
    cleanup(tmpDir);
  }
});

await testAsync("input-validation", "null text returns error", async () => {
  const tmpDir = makeTempDir();
  try {
    const result = await compileSpec(tmpDir, null);
    assert(!result.success, "Should fail for null");
  } finally {
    cleanup(tmpDir);
  }
});

await testAsync("input-validation", "undefined text returns error", async () => {
  const tmpDir = makeTempDir();
  try {
    const result = await compileSpec(tmpDir, undefined);
    assert(!result.success, "Should fail for undefined");
  } finally {
    cleanup(tmpDir);
  }
});

await testAsync("input-validation", "whitespace-only text returns error", async () => {
  const tmpDir = makeTempDir();
  try {
    const result = await compileSpec(tmpDir, "   \n\t  ");
    assert(!result.success, "Should fail for whitespace-only");
  } finally {
    cleanup(tmpDir);
  }
});

await testAsync("input-validation", "no API key returns clear error", async () => {
  const tmpDir = makeTempDir();
  // Save and clear env vars
  const saved = {};
  const keys = ["SPECLOCK_LLM_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"];
  for (const k of keys) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  try {
    const result = await compileSpec(tmpDir, "Use React for frontend");
    assert(!result.success, "Should fail without API key");
    assert(result.error.includes("API key"), "Error should mention API key");
  } finally {
    // Restore env vars
    for (const k of keys) {
      if (saved[k] !== undefined) process.env[k] = saved[k];
      else delete process.env[k];
    }
    cleanup(tmpDir);
  }
});

// ============================================================
// JSON RESPONSE PARSING (via parseJsonResponse)
// ============================================================

test("response-parsing", "parses valid JSON", () => {
  const result = parseJsonResponse('{"hasConflict": false}');
  assert(result !== null, "Should parse valid JSON");
  assertEqual(result.hasConflict, false, "Should have correct value");
});

test("response-parsing", "parses JSON from markdown code block", () => {
  const raw = '```json\n{"locks": [{"text": "test"}]}\n```';
  const result = parseJsonResponse(raw);
  assert(result !== null, "Should parse from code block");
  assertEqual(result.locks.length, 1, "Should have 1 lock");
});

test("response-parsing", "parses JSON from code block without json label", () => {
  const raw = '```\n{"decisions": []}\n```';
  const result = parseJsonResponse(raw);
  assert(result !== null, "Should parse from unlabeled code block");
});

test("response-parsing", "returns null for empty content", () => {
  assertEqual(parseJsonResponse(null), null, "null input");
  assertEqual(parseJsonResponse(""), null, "empty string");
  assertEqual(parseJsonResponse(undefined), null, "undefined input");
});

test("response-parsing", "returns null for invalid JSON", () => {
  const result = parseJsonResponse("this is not json at all");
  assertEqual(result, null, "Should return null for non-JSON");
});

test("response-parsing", "handles nested JSON in code block", () => {
  const raw = 'Here is the result:\n```json\n{"locks": [{"text": "Never modify auth", "tags": ["security"]}], "decisions": []}\n```\nDone.';
  const result = parseJsonResponse(raw);
  assert(result !== null, "Should parse nested JSON");
  assertEqual(result.locks[0].text, "Never modify auth", "Lock text");
});

// ============================================================
// COMPILER OUTPUT NORMALIZATION
// ============================================================

// We test normalizeCompilerOutput indirectly through compileAndApply
// but we can test the structure expectations here

test("output-structure", "valid compiler output has all required fields", () => {
  const mockOutput = {
    locks: [{ text: "Never delete records", tags: ["database"] }],
    typedLocks: [],
    decisions: [{ text: "Use PostgreSQL", tags: ["architecture"] }],
    notes: [{ text: "Legacy system used MySQL" }],
    summary: "Extracted 1 lock, 1 decision, 1 note",
  };

  assert(Array.isArray(mockOutput.locks), "locks is array");
  assert(Array.isArray(mockOutput.typedLocks), "typedLocks is array");
  assert(Array.isArray(mockOutput.decisions), "decisions is array");
  assert(Array.isArray(mockOutput.notes), "notes is array");
  assert(typeof mockOutput.summary === "string", "summary is string");
});

test("output-structure", "typed lock validates correctly", () => {
  const typedLock = {
    constraintType: "numerical",
    metric: "response_time_ms",
    operator: "<=",
    value: 200,
  };
  const result = validateTypedLock(typedLock);
  assert(result.valid, "Should be valid numerical constraint");
});

test("output-structure", "range typed lock validates correctly", () => {
  const typedLock = {
    constraintType: "range",
    metric: "temperature",
    min: 20,
    max: 25,
  };
  const result = validateTypedLock(typedLock);
  assert(result.valid, "Should be valid range constraint");
});

test("output-structure", "state typed lock validates correctly", () => {
  const typedLock = {
    constraintType: "state",
    metric: "system_mode",
    entity: "system",
    forbidden: [{ from: "production", to: "debug" }],
  };
  const result = validateTypedLock(typedLock);
  assert(result.valid, "Should be valid state constraint");
});

// ============================================================
// FILE COMPILATION
// ============================================================

await testAsync("file-compilation", "returns error for missing file", async () => {
  const tmpDir = makeTempDir();
  try {
    const result = await compileFile(tmpDir, "nonexistent.md");
    assert(!result.success, "Should fail for missing file");
    assert(result.error.includes("not found"), "Error should mention not found");
  } finally {
    cleanup(tmpDir);
  }
});

await testAsync("file-compilation", "returns error for empty file", async () => {
  const tmpDir = makeTempDir();
  const emptyFile = path.join(tmpDir, "empty.md");
  fs.writeFileSync(emptyFile, "");
  try {
    const result = await compileFile(tmpDir, "empty.md");
    assert(!result.success, "Should fail for empty file");
    assert(result.error.includes("empty"), "Error should mention empty");
  } finally {
    cleanup(tmpDir);
  }
});

await testAsync("file-compilation", "reads file content correctly", async () => {
  const tmpDir = makeTempDir();
  const testFile = path.join(tmpDir, "test.md");
  fs.writeFileSync(testFile, "# Project Rules\nNever delete user data.");
  try {
    // This will fail due to no API key (in test), but we verify it doesn't crash on file read
    const saved = {};
    const keys = ["SPECLOCK_LLM_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"];
    for (const k of keys) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    try {
      const result = await compileFile(tmpDir, "test.md");
      // Should fail due to no API key, not due to file read error
      assert(!result.success, "Should fail");
      assert(result.error.includes("API key"), "Should fail on API key, not file read");
      assertEqual(result.filePath, "test.md", "Should include file path");
    } finally {
      for (const k of keys) {
        if (saved[k] !== undefined) process.env[k] = saved[k];
        else delete process.env[k];
      }
    }
  } finally {
    cleanup(tmpDir);
  }
});

// ============================================================
// AUTO-APPLY INTEGRATION
// ============================================================

await testAsync("auto-apply", "compileAndApply returns error without API key", async () => {
  const tmpDir = makeTempDir();
  const saved = {};
  const keys = ["SPECLOCK_LLM_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"];
  for (const k of keys) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  try {
    const result = await compileAndApply(tmpDir, "Use React and never touch auth");
    assert(!result.success, "Should fail without API key");
    assert(result.error.includes("API key"), "Error should mention API key");
  } finally {
    for (const k of keys) {
      if (saved[k] !== undefined) process.env[k] = saved[k];
      else delete process.env[k];
    }
    cleanup(tmpDir);
  }
});

await testAsync("auto-apply", "applies locks to brain when given mock data", async () => {
  const tmpDir = makeTempDir();
  try {
    ensureInit(tmpDir);
    const brain = readBrain(tmpDir);
    const initialLocks = brain.specLock.items.length;
    const initialDecisions = brain.decisions.length;

    // Manually apply what the compiler would output
    const { addLock, addDecision, addNote } = await import("../src/core/memory.js");
    addLock(tmpDir, "Never modify auth files", ["security"], "spec-compiler");
    addDecision(tmpDir, "Use React for frontend", ["architecture"], "spec-compiler");
    addNote(tmpDir, "Legacy system was PHP", true);

    const updatedBrain = readBrain(tmpDir);
    assertEqual(updatedBrain.specLock.items.length, initialLocks + 1, "Should add 1 lock");
    assertEqual(updatedBrain.decisions.length, initialDecisions + 1, "Should add 1 decision");
    assertEqual(updatedBrain.notes.length, 1, "Should add 1 note");
    assertEqual(updatedBrain.specLock.items[0].text, "Never modify auth files", "Lock text");
    assertEqual(updatedBrain.specLock.items[0].source, "spec-compiler", "Lock source");
    assertEqual(updatedBrain.decisions[0].text, "Use React for frontend", "Decision text");
  } finally {
    cleanup(tmpDir);
  }
});

await testAsync("auto-apply", "applies typed locks to brain correctly", async () => {
  const tmpDir = makeTempDir();
  try {
    ensureInit(tmpDir);

    const { addTypedLock } = await import("../src/core/memory.js");
    const result = addTypedLock(
      tmpDir,
      { constraintType: "numerical", metric: "response_time_ms", operator: "<=", value: 200 },
      ["performance"],
      "spec-compiler",
      "API response time must stay under 200ms"
    );

    assert(result.lockId, "Should return lock ID");
    assertEqual(result.constraintType, "numerical", "Should be numerical");

    const brain = readBrain(tmpDir);
    const lock = brain.specLock.items.find(l => l.id === result.lockId);
    assert(lock, "Lock should exist in brain");
    assertEqual(lock.constraintType, "numerical", "Constraint type");
    assertEqual(lock.value, 200, "Value");
    assertEqual(lock.operator, "<=", "Operator");
  } finally {
    cleanup(tmpDir);
  }
});

// ============================================================
// EDGE CASES
// ============================================================

await testAsync("edge-cases", "handles very long input gracefully", async () => {
  const tmpDir = makeTempDir();
  try {
    // Input over 30000 chars should still work (gets truncated internally)
    const longText = "This is a test. ".repeat(3000); // ~48000 chars
    // Will fail due to no API key, but shouldn't crash
    const saved = {};
    const keys = ["SPECLOCK_LLM_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"];
    for (const k of keys) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    try {
      const result = await compileSpec(tmpDir, longText);
      assert(!result.success, "Should fail (no API key)");
      // Should not crash
    } finally {
      for (const k of keys) {
        if (saved[k] !== undefined) process.env[k] = saved[k];
        else delete process.env[k];
      }
    }
  } finally {
    cleanup(tmpDir);
  }
});

test("edge-cases", "parseJsonResponse handles malformed code block", () => {
  const raw = '```json\n{invalid json here\n```';
  const result = parseJsonResponse(raw);
  assertEqual(result, null, "Should return null for malformed JSON in code block");
});

test("edge-cases", "parseJsonResponse handles object with extra whitespace", () => {
  const raw = '  \n  {"locks": []}  \n  ';
  const result = parseJsonResponse(raw);
  assert(result !== null, "Should parse JSON with whitespace");
  assertEqual(result.locks.length, 0, "Should have empty locks");
});

// ============================================================
// RESULTS
// ============================================================

console.log("\n" + "=".repeat(60));
console.log("SpecLock Spec Compiler Test Results");
console.log("=".repeat(60));

for (const [cat, stats] of Object.entries(categories)) {
  const icon = stats.failed === 0 ? "PASS" : "FAIL";
  console.log(`  [${icon}] ${cat}: ${stats.passed}/${stats.total}`);
}

console.log("-".repeat(60));
console.log(`  Total: ${passed}/${passed + failed} passed`);

if (failures.length > 0) {
  console.log("\nFailures:");
  for (const f of failures) {
    console.log(`  [${f.category}] ${f.name}: ${f.error}`);
  }
}

console.log("=".repeat(60));
process.exit(failed > 0 ? 1 : 0);
