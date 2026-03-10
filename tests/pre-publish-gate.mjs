/**
 * SpecLock Pre-Publish Gate
 * Runs all test suites before npm publish. If ANY suite fails, publish is blocked.
 * Protects the 100/100 benchmark achieved in v5.2.6.
 *
 * Developed by Sandeep Roy (https://github.com/sgroy10)
 */

import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUITES = [
  // Core semantic engine (259 tests)
  { file: "adversarial-conflict.test.js",   name: "Adversarial Conflict",  expected: 61 },
  { file: "real-world-testers.test.js",     name: "Real-World Testers",    expected: 111 },
  { file: "claude-regression-test.mjs",     name: "Claude Regression",     expected: 9 },
  { file: "pii-export-test.mjs",            name: "PII/Export Detection",  expected: 8 },
  { file: "question-framing-test.mjs",      name: "Question Framing",      expected: 9 },

  // Typed constraints & infrastructure (280 tests)
  { file: "typed-constraints.test.js",      name: "Typed Constraints",     expected: 61 },
  { file: "patch-gateway.test.js",          name: "Patch Gateway",         expected: 57 },
  { file: "diff-review.test.js",            name: "Diff-Native Review",    expected: 76 },
  { file: "audit-chain.test.js",            name: "Audit Chain",           expected: 35 },
  { file: "code-graph.test.js",             name: "Code Graph",            expected: 33 },
  { file: "spec-compiler.test.js",          name: "Spec Compiler",         expected: 24 },

  // Enterprise & security (323 tests)
  { file: "enforcement.test.js",            name: "Enforcement",           expected: 40 },
  { file: "rest-api-v2.test.js",            name: "REST API v2",           expected: 28 },
  { file: "compliance-export.test.js",      name: "Compliance Export",     expected: 50 },
  { file: "phase4.test.js",                 name: "Phase 4 (Full Stack)",  expected: 91 },
  { file: "auth-crypto.test.js",            name: "Auth & Crypto",         expected: 114 },

  // Journey tests (2 tests)
  { file: "john-vibecoder-journey.test.js", name: "John (Vibe Coder)",     expected: null },
  { file: "sam-enterprise-journey.test.js", name: "Sam (Enterprise)",      expected: null },
];

console.log("=".repeat(60));
console.log("  SPECLOCK PRE-PUBLISH GATE");
console.log("  All test suites must pass before npm publish");
console.log("=".repeat(60));
console.log();

let totalPassed = 0;
let totalExpected = 0;
let failed = [];
let passed = [];

for (const suite of SUITES) {
  const filePath = path.join(__dirname, suite.file);
  process.stdout.write(`  ${suite.name.padEnd(25)}`);

  try {
    const output = execSync(`node "${filePath}"`, {
      timeout: 30000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Extract pass count from output
    const passMatch = output.match(/(\d+)\/(\d+)\s+passed/i)
      || output.match(/(\d+)\/(\d+)/);

    if (passMatch) {
      const count = parseInt(passMatch[1]);
      const total = parseInt(passMatch[2]);
      if (count === total) {
        console.log(`  ${count}/${total} PASS`);
        totalPassed += count;
        totalExpected += total;
        passed.push(suite.name);
      } else {
        console.log(`  ${count}/${total} FAIL`);
        failed.push({ name: suite.name, detail: `${count}/${total}` });
        totalPassed += count;
        totalExpected += total;
      }
    } else {
      // Journey tests don't have X/Y format — check exit code (0 = pass)
      console.log(`  PASS`);
      passed.push(suite.name);
    }
  } catch (err) {
    const output = (err.stdout || "") + (err.stderr || "");
    const passMatch = output.match(/(\d+)\/(\d+)\s+passed/i)
      || output.match(/(\d+)\s+passed.*?(\d+)\s+failed/i);

    if (passMatch) {
      console.log(`  ${passMatch[1]}/${passMatch[2]} FAIL`);
      failed.push({ name: suite.name, detail: `${passMatch[1]}/${passMatch[2]}` });
    } else {
      console.log(`  FAIL (crashed)`);
      failed.push({ name: suite.name, detail: "crash" });
    }
  }
}

console.log();
console.log("=".repeat(60));

if (failed.length === 0) {
  console.log(`  GATE: PASS — ${passed.length}/${SUITES.length} suites, ${totalPassed} tests`);
  console.log(`  Safe to publish.`);
  console.log("=".repeat(60));
  process.exit(0);
} else {
  console.log(`  GATE: BLOCKED — ${failed.length} suite(s) failed`);
  console.log();
  for (const f of failed) {
    console.log(`    FAIL: ${f.name} (${f.detail})`);
  }
  console.log();
  console.log(`  Fix failures before publishing. Do NOT use --no-verify.`);
  console.log("=".repeat(60));
  process.exit(1);
}
