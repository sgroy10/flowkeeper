/**
 * Test: Direct mode for cross-platform usage (non-MCP).
 * Validates that checkConflict(action, lock) works without brain.json.
 */
import { checkConflict, analyzeConflict, scoreConflict } from "../src/core/engine.js";

let passed = 0;
let failed = 0;

function test(name, result, expected) {
  const ok = result === expected;
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name} — got: ${result}, expected: ${expected}`);
}

// Tester 3's exact failing scenarios
const r1 = checkConflict("streamline the payroll process", "NEVER modify processed payroll records");
test("Payroll euphemism (tester 3 fail)", r1.hasConflict, true);

const r2 = checkConflict("optimize salary calculations", "NEVER modify processed payroll records");
test("Salary optimize (tester 3 fail)", r2.hasConflict, true);

const r3 = checkConflict("clean up terminated records", "NEVER delete employee records");
test("Clean up = delete (tester 3 fail)", r3.hasConflict, true);

const r4 = checkConflict("truncate audit_log table", "NEVER modify audit trail records");
test("Truncate audit (tester 3 fail)", r4.hasConflict, true);

const r5 = checkConflict("temporarily disable approval", "NEVER bypass approval workflow");
test("Temporal disable (tester 3 fail)", r5.hasConflict, true);

const r6 = checkConflict("adjust final grades", "NEVER modify student grades after submission");
test("Grade manipulation (tester 3 fail)", r6.hasConflict, true);

const r7 = checkConflict("refresh evidence timestamps", "NEVER modify legal evidence records");
test("Evidence tampering (tester 3 fail)", r7.hasConflict, true);

const r8 = checkConflict("disable safety interlock", "NEVER bypass safety systems");
test("Safety bypass (tester 3 fail)", r8.hasConflict, true);

const r9 = checkConflict("adjust player gold balance", "NEVER modify player currency balances");
test("Game currency (tester 3 fail)", r9.hasConflict, true);

const r10 = checkConflict("skip pre-flight check", "NEVER bypass flight safety procedures");
test("Aviation safety (tester 3 fail)", r10.hasConflict, true);

// Array of locks
const r11 = checkConflict("export citizen database", [
  "NEVER export personally identifiable information",
  "NEVER bypass data privacy controls"
]);
test("PII export with array locks", r11.hasConflict, true);

// Safe actions (must NOT conflict)
const r12 = checkConflict("Add a new todo item", "NEVER modify the authentication system");
test("Safe: todo vs auth", r12.hasConflict, false);

const r13 = checkConflict("Add a loading spinner", "NEVER change the database schema");
test("Safe: spinner vs db", r13.hasConflict, false);

// Checkout false positive fix
const r14 = checkConflict("Make checkout faster", "Never change the Stripe payment integration");
test("FP fix: checkout vs Stripe", r14.hasConflict, false);

const r15 = checkConflict("Fix the bug in the checkout flow", "Never change the Stripe payment integration");
test("FP fix: checkout bug vs Stripe", r15.hasConflict, false);

// Direct analyzeConflict export
const r16 = analyzeConflict("disable the anti-cheat system", "NEVER disable anti-cheat protections");
test("analyzeConflict direct", r16.isConflict, true);

// Direct scoreConflict export
const r17 = scoreConflict({ actionText: "backdate policy effective date", lockText: "NEVER modify insurance policy dates" });
test("scoreConflict direct", r17.isConflict, true);

console.log(`\n========================================`);
console.log(`  DIRECT MODE: ${passed}/${passed + failed} passed, ${failed} failed`);
console.log(`========================================`);

process.exit(failed > 0 ? 1 : 0);
