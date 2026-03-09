// ===================================================================
// SpecLock Typed Constraints Test Suite
// Tests numerical, range, state, and temporal constraint checking.
// Run: node tests/typed-constraints.test.js
// ===================================================================

import {
  validateTypedLock,
  checkTypedConstraint,
  checkAllTypedConstraints,
  formatTypedLockText,
  CONSTRAINT_TYPES,
  OPERATORS,
} from "../src/core/typed-constraints.js";

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

function assert(condition, msg) {
  if (!condition) throw new Error(msg || "Assertion failed");
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || "Mismatch"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ============================================================
// VALIDATION TESTS
// ============================================================

test("validation", "rejects invalid constraint types", () => {
  const r = validateTypedLock({ constraintType: "invalid" });
  assert(!r.valid, "Should be invalid");
});

test("validation", "rejects null input", () => {
  assert(!validateTypedLock(null).valid);
  assert(!validateTypedLock(undefined).valid);
});

test("validation", "validates correct numerical constraint", () => {
  const r = validateTypedLock({
    constraintType: "numerical", metric: "motor_speed", operator: "<=", value: 3000, unit: "RPM",
  });
  assert(r.valid, "Should be valid");
});

test("validation", "rejects numerical without metric", () => {
  const r = validateTypedLock({ constraintType: "numerical", operator: "<=", value: 3000 });
  assert(!r.valid);
});

test("validation", "rejects numerical with invalid operator", () => {
  const r = validateTypedLock({ constraintType: "numerical", metric: "speed", operator: "~=", value: 100 });
  assert(!r.valid);
});

test("validation", "rejects numerical with non-number value", () => {
  const r = validateTypedLock({ constraintType: "numerical", metric: "speed", operator: "<=", value: "fast" });
  assert(!r.valid);
});

test("validation", "validates correct range constraint", () => {
  const r = validateTypedLock({ constraintType: "range", metric: "temperature", min: 20, max: 80 });
  assert(r.valid);
});

test("validation", "rejects range with min >= max", () => {
  const r = validateTypedLock({ constraintType: "range", metric: "temperature", min: 80, max: 20 });
  assert(!r.valid);
});

test("validation", "validates correct state constraint", () => {
  const r = validateTypedLock({
    constraintType: "state", entity: "robot_arm", forbidden: [{ from: "EMERGENCY", to: "IDLE" }],
  });
  assert(r.valid);
});

test("validation", "rejects state without entity", () => {
  const r = validateTypedLock({ constraintType: "state", forbidden: [{ from: "A", to: "B" }] });
  assert(!r.valid);
});

test("validation", "rejects state with empty forbidden", () => {
  const r = validateTypedLock({ constraintType: "state", entity: "robot", forbidden: [] });
  assert(!r.valid);
});

test("validation", "rejects state with invalid forbidden entry", () => {
  const r = validateTypedLock({ constraintType: "state", entity: "robot", forbidden: [{ from: "A" }] });
  assert(!r.valid);
});

test("validation", "validates correct temporal constraint", () => {
  const r = validateTypedLock({
    constraintType: "temporal", metric: "sensor_interval", operator: "<=", value: 100, unit: "ms",
  });
  assert(r.valid);
});

// ============================================================
// NUMERICAL CONSTRAINT TESTS
// ============================================================

const speedLock = { constraintType: "numerical", metric: "motor_speed", operator: "<=", value: 3000, unit: "RPM" };

test("numerical", "value within limit — safe", () => {
  const r = checkTypedConstraint(speedLock, { value: 2500 });
  assert(!r.hasConflict, "Should not conflict");
  assertEqual(r.level, "SAFE");
});

test("numerical", "value at exact limit — safe", () => {
  const r = checkTypedConstraint(speedLock, { value: 3000 });
  assert(!r.hasConflict);
});

test("numerical", "value exceeds limit — CONFLICT", () => {
  const r = checkTypedConstraint(speedLock, { value: 3500 });
  assert(r.hasConflict, "Should conflict");
  assert(r.confidence >= 70, `Confidence ${r.confidence} should be >= 70`);
  assert(r.reasons[0].includes("motor_speed"));
});

test("numerical", "value way over limit — HIGH", () => {
  const r = checkTypedConstraint(speedLock, { value: 6000 });
  assert(r.hasConflict);
  assertEqual(r.level, "HIGH");
  assert(r.confidence >= 90);
});

test("numerical", "strict less-than at boundary — CONFLICT", () => {
  const r = checkTypedConstraint({ ...speedLock, operator: "<" }, { value: 3000 });
  assert(r.hasConflict, "Exact boundary with < should conflict");
});

test("numerical", "greater-than operator — below minimum", () => {
  const r = checkTypedConstraint({
    constraintType: "numerical", metric: "pressure", operator: ">=", value: 10, unit: "PSI",
  }, { value: 5 });
  assert(r.hasConflict);
});

test("numerical", "greater-than operator — at minimum", () => {
  const r = checkTypedConstraint({
    constraintType: "numerical", metric: "pressure", operator: ">=", value: 10, unit: "PSI",
  }, { value: 10 });
  assert(!r.hasConflict);
});

test("numerical", "not-equal operator — equal value CONFLICTS", () => {
  const r = checkTypedConstraint({
    constraintType: "numerical", metric: "servo", operator: "!=", value: 0,
  }, { value: 0 });
  assert(r.hasConflict);
});

test("numerical", "not-equal operator — different value safe", () => {
  const r = checkTypedConstraint({
    constraintType: "numerical", metric: "servo", operator: "!=", value: 0,
  }, { value: 45 });
  assert(!r.hasConflict);
});

test("numerical", "non-number proposed — safe (graceful)", () => {
  const r = checkTypedConstraint(speedLock, { value: "fast" });
  assert(!r.hasConflict);
});

// ============================================================
// RANGE CONSTRAINT TESTS
// ============================================================

const tempLock = { constraintType: "range", metric: "temperature", min: 20, max: 80, unit: "°C" };

test("range", "value within range — safe", () => {
  const r = checkTypedConstraint(tempLock, { value: 50 });
  assert(!r.hasConflict);
});

test("range", "at min boundary — safe", () => {
  const r = checkTypedConstraint(tempLock, { value: 20 });
  assert(!r.hasConflict);
});

test("range", "at max boundary — safe", () => {
  const r = checkTypedConstraint(tempLock, { value: 80 });
  assert(!r.hasConflict);
});

test("range", "below min — CONFLICT", () => {
  const r = checkTypedConstraint(tempLock, { value: 10 });
  assert(r.hasConflict);
  assert(r.reasons[0].includes("below minimum"));
});

test("range", "above max — CONFLICT", () => {
  const r = checkTypedConstraint(tempLock, { value: 95 });
  assert(r.hasConflict);
  assert(r.reasons[0].includes("above maximum"));
});

test("range", "way out of range — HIGH", () => {
  const r = checkTypedConstraint(tempLock, { value: 200 });
  assert(r.hasConflict);
  assertEqual(r.level, "HIGH");
});

test("range", "negative range", () => {
  const coldLock = { constraintType: "range", metric: "temp", min: -40, max: -10, unit: "°C" };
  assert(!checkTypedConstraint(coldLock, { value: -25 }).hasConflict);
  assert(checkTypedConstraint(coldLock, { value: 5 }).hasConflict);
});

// ============================================================
// STATE CONSTRAINT TESTS
// ============================================================

const robotLock = {
  constraintType: "state", entity: "robot_arm",
  forbidden: [{ from: "EMERGENCY", to: "IDLE" }, { from: "EMERGENCY", to: "RUNNING" }],
  requireApproval: true,
};

test("state", "allowed transition — safe", () => {
  const r = checkTypedConstraint(robotLock, { from: "IDLE", to: "RUNNING" });
  assert(!r.hasConflict);
});

test("state", "forbidden transition — CONFLICT", () => {
  const r = checkTypedConstraint(robotLock, { from: "EMERGENCY", to: "IDLE" });
  assert(r.hasConflict);
  assertEqual(r.confidence, 100);
  assertEqual(r.level, "HIGH");
});

test("state", "another forbidden transition", () => {
  assert(checkTypedConstraint(robotLock, { from: "EMERGENCY", to: "RUNNING" }).hasConflict);
});

test("state", "case-insensitive matching", () => {
  assert(checkTypedConstraint(robotLock, { from: "emergency", to: "idle" }).hasConflict);
});

test("state", "requireApproval in reasons", () => {
  const r = checkTypedConstraint(robotLock, { from: "EMERGENCY", to: "IDLE" });
  assert(r.reasons.some(r => r.includes("human approval")));
});

test("state", "wildcard from — any state to OVERRIDE forbidden", () => {
  const lock = { constraintType: "state", entity: "vehicle", forbidden: [{ from: "*", to: "OVERRIDE" }] };
  assert(checkTypedConstraint(lock, { from: "NORMAL", to: "OVERRIDE" }).hasConflict);
  assert(checkTypedConstraint(lock, { from: "EMERGENCY", to: "OVERRIDE" }).hasConflict);
  assert(!checkTypedConstraint(lock, { from: "NORMAL", to: "STANDBY" }).hasConflict);
});

test("state", "wildcard to — SHUTDOWN to anything forbidden", () => {
  const lock = { constraintType: "state", entity: "reactor", forbidden: [{ from: "SHUTDOWN", to: "*" }] };
  assert(checkTypedConstraint(lock, { from: "SHUTDOWN", to: "STARTING" }).hasConflict);
  assert(!checkTypedConstraint(lock, { from: "RUNNING", to: "STANDBY" }).hasConflict);
});

test("state", "missing from/to — safe (graceful)", () => {
  const r = checkTypedConstraint(robotLock, { from: "EMERGENCY" });
  assert(!r.hasConflict);
});

// ============================================================
// TEMPORAL CONSTRAINT TESTS
// ============================================================

const sensorLock = { constraintType: "temporal", metric: "sensor_interval", operator: "<=", value: 100, unit: "ms" };

test("temporal", "interval within limit — safe", () => {
  assert(!checkTypedConstraint(sensorLock, { value: 50 }).hasConflict);
});

test("temporal", "at exact limit — safe", () => {
  assert(!checkTypedConstraint(sensorLock, { value: 100 }).hasConflict);
});

test("temporal", "exceeds limit — CONFLICT", () => {
  const r = checkTypedConstraint(sensorLock, { value: 200 });
  assert(r.hasConflict);
  assert(r.reasons[0].includes("sensor_interval"));
});

test("temporal", "very slow — HIGH", () => {
  const r = checkTypedConstraint(sensorLock, { value: 1000 });
  assert(r.hasConflict);
  assertEqual(r.level, "HIGH");
});

test("temporal", "minimum frequency constraint", () => {
  const freqLock = { constraintType: "temporal", metric: "heartbeat", operator: ">=", value: 1, unit: "Hz" };
  assert(checkTypedConstraint(freqLock, { value: 0.5 }).hasConflict);
  assert(!checkTypedConstraint(freqLock, { value: 2 }).hasConflict);
});

// ============================================================
// BULK CHECKING TESTS
// ============================================================

const allLocks = [
  { id: "lock_speed", constraintType: "numerical", metric: "motor_speed", operator: "<=", value: 3000, unit: "RPM", active: true, text: "Motor speed must be <= 3000 RPM" },
  { id: "lock_temp", constraintType: "range", metric: "temperature", min: 20, max: 80, unit: "°C", active: true, text: "Temperature must stay between 20 and 80 °C" },
  { id: "lock_state", constraintType: "state", entity: "robot_arm", forbidden: [{ from: "EMERGENCY", to: "IDLE" }], active: true, text: "robot_arm: forbidden" },
  { id: "lock_text", text: "Never switch from Stripe", active: true },
];

test("bulk", "checks only matching metric", () => {
  const r = checkAllTypedConstraints(allLocks, { metric: "motor_speed", value: 2500 });
  assert(!r.hasConflict);
});

test("bulk", "detects numerical violation", () => {
  const r = checkAllTypedConstraints(allLocks, { metric: "motor_speed", value: 4000 });
  assert(r.hasConflict);
  assertEqual(r.conflictingLocks[0].id, "lock_speed");
});

test("bulk", "detects range violation", () => {
  const r = checkAllTypedConstraints(allLocks, { metric: "temperature", value: 95 });
  assert(r.hasConflict);
  assertEqual(r.conflictingLocks[0].id, "lock_temp");
});

test("bulk", "detects state violation", () => {
  const r = checkAllTypedConstraints(allLocks, { entity: "robot_arm", from: "EMERGENCY", to: "IDLE" });
  assert(r.hasConflict);
  assertEqual(r.conflictingLocks[0].id, "lock_state");
});

test("bulk", "ignores text locks", () => {
  const r = checkAllTypedConstraints(allLocks, { metric: "motor_speed", value: 2500 });
  assert(!r.conflictingLocks.some(c => c.id === "lock_text"));
});

test("bulk", "ignores inactive locks", () => {
  const withInactive = [...allLocks, { id: "lock_off", constraintType: "numerical", metric: "motor_speed", operator: "<=", value: 1000, active: false }];
  const r = checkAllTypedConstraints(withInactive, { metric: "motor_speed", value: 2500 });
  assert(!r.hasConflict, "Inactive lock should not trigger");
});

test("bulk", "empty locks — no conflict", () => {
  assert(!checkAllTypedConstraints([], { metric: "speed", value: 100 }).hasConflict);
});

test("bulk", "unmatched metric — no conflict", () => {
  const r = checkAllTypedConstraints(allLocks, { metric: "unknown", value: 99999 });
  assert(!r.hasConflict);
});

// ============================================================
// FORMAT TEXT TESTS
// ============================================================

test("format", "formats numerical lock text", () => {
  const t = formatTypedLockText({ constraintType: "numerical", metric: "motor_speed", operator: "<=", value: 3000, unit: "RPM" });
  assert(t.includes("motor_speed") && t.includes("3000") && t.includes("RPM"));
});

test("format", "formats range lock text", () => {
  const t = formatTypedLockText({ constraintType: "range", metric: "temperature", min: 20, max: 80, unit: "°C" });
  assert(t.includes("temperature") && t.includes("20") && t.includes("80"));
});

test("format", "formats state lock text", () => {
  const t = formatTypedLockText({ constraintType: "state", entity: "robot_arm", forbidden: [{ from: "EMERGENCY", to: "IDLE" }], requireApproval: true });
  assert(t.includes("robot_arm") && t.includes("EMERGENCY") && t.includes("human approval"));
});

test("format", "formats temporal lock text", () => {
  const t = formatTypedLockText({ constraintType: "temporal", metric: "sensor_interval", operator: "<=", value: 100, unit: "ms" });
  assert(t.includes("sensor_interval") && t.includes("100") && t.includes("ms"));
});

// ============================================================
// REAL-WORLD SCENARIOS
// ============================================================

test("real-world", "Robot arm joint angle limit", () => {
  const lock = { constraintType: "numerical", metric: "joint_angle_elbow", operator: "<=", value: 170, unit: "degrees" };
  assert(!checkTypedConstraint(lock, { value: 90 }).hasConflict);
  assert(checkTypedConstraint(lock, { value: 180 }).hasConflict);
});

test("real-world", "Vehicle speed in school zone", () => {
  const lock = { constraintType: "numerical", metric: "vehicle_speed", operator: "<=", value: 30, unit: "km/h" };
  assert(!checkTypedConstraint(lock, { value: 25 }).hasConflict);
  assert(checkTypedConstraint(lock, { value: 50 }).hasConflict);
});

test("real-world", "Trading position limit", () => {
  const lock = { constraintType: "range", metric: "portfolio_exposure", min: -100000, max: 500000, unit: "USD" };
  assert(!checkTypedConstraint(lock, { value: 250000 }).hasConflict);
  assert(checkTypedConstraint(lock, { value: 750000 }).hasConflict);
  assert(checkTypedConstraint(lock, { value: -200000 }).hasConflict);
});

test("real-world", "Medical IV drip rate", () => {
  const lock = { constraintType: "range", metric: "iv_drip_rate", min: 10, max: 250, unit: "mL/hr" };
  assert(!checkTypedConstraint(lock, { value: 100 }).hasConflict);
  assert(checkTypedConstraint(lock, { value: 500 }).hasConflict);
});

test("real-world", "Autonomous vehicle emergency stop state machine", () => {
  const lock = {
    constraintType: "state", entity: "autonomous_vehicle",
    forbidden: [
      { from: "EMERGENCY_STOP", to: "AUTONOMOUS" },
      { from: "EMERGENCY_STOP", to: "CRUISE" },
      { from: "*", to: "OVERRIDE_ALL" },
    ],
    requireApproval: true,
  };
  assert(checkTypedConstraint(lock, { from: "EMERGENCY_STOP", to: "AUTONOMOUS" }).hasConflict);
  assert(!checkTypedConstraint(lock, { from: "EMERGENCY_STOP", to: "MANUAL" }).hasConflict);
  assert(checkTypedConstraint(lock, { from: "NORMAL", to: "OVERRIDE_ALL" }).hasConflict);
});

test("real-world", "IoT sensor polling interval", () => {
  const lock = { constraintType: "temporal", metric: "temp_poll", operator: "<=", value: 500, unit: "ms" };
  assert(!checkTypedConstraint(lock, { value: 250 }).hasConflict);
  assert(checkTypedConstraint(lock, { value: 2000 }).hasConflict);
});

// ============================================================
// RESULTS
// ============================================================

const total = passed + failed;

console.log("\n" + "=".repeat(70));
console.log("  SpecLock Typed Constraints — Test Results");
console.log("=".repeat(70));
console.log(`\n  Total: ${total} tests | PASSED: ${passed} | FAILED: ${failed}`);

console.log("\n  By Category:");
for (const [cat, stats] of Object.entries(categories)) {
  const pct = ((stats.passed / stats.total) * 100).toFixed(0);
  const status = stats.failed === 0 ? "PASS" : "FAIL";
  console.log(`    ${cat.padEnd(18)} ${stats.passed}/${stats.total} (${pct}%) [${status}]`);
}

if (failures.length > 0) {
  console.log(`\n  FAILURES (${failures.length}):`);
  for (const f of failures) {
    console.log(`\n    [${f.category}] ${f.name}`);
    console.log(`    Error: ${f.error}`);
  }
}

console.log("\n" + "=".repeat(70));
if (failed === 0) {
  console.log(`  RESULT: ALL ${total} TESTS PASSED — Typed constraints ready`);
} else {
  console.log(`  RESULT: ${failed} FAILURES — Fix required`);
}
console.log("=".repeat(70) + "\n");

process.exit(failed === 0 ? 0 : 1);
