"""
SpecLock Python SDK — Typed Constraints Tests

Mirrors the Node.js test suite (61 tests) to ensure cross-platform compatibility.

Run: python -m pytest tests/ -v
  or: python tests/test_constraints.py

Developed by Sandeep Roy (https://github.com/sgroy10)
"""

import os
import sys
import json
import tempfile
import shutil

# Add parent directory to path for direct execution
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from speclock.constraints import (
    validate_typed_lock,
    check_typed_constraint,
    check_all_typed_constraints,
    format_typed_lock_text,
    CONSTRAINT_TYPES,
    OPERATORS,
)
from speclock.core import SpecLock
from speclock.brain import Brain


passed = 0
failed = 0
failures = []
categories = {}


def test(category, name, fn):
    global passed, failed
    if category not in categories:
        categories[category] = {"passed": 0, "failed": 0, "total": 0}
    categories[category]["total"] += 1

    try:
        fn()
        passed += 1
        categories[category]["passed"] += 1
    except Exception as e:
        failed += 1
        categories[category]["failed"] += 1
        failures.append({"category": category, "name": name, "error": str(e)})


def assert_true(condition, msg=""):
    if not condition:
        raise AssertionError(msg or "Expected True")

def assert_false(condition, msg=""):
    if condition:
        raise AssertionError(msg or "Expected False")

def assert_eq(actual, expected, msg=""):
    if actual != expected:
        raise AssertionError(f"{msg or 'Mismatch'}: expected {expected!r}, got {actual!r}")


# ============================================================
# VALIDATION TESTS
# ============================================================

test("validation", "rejects invalid type", lambda: assert_false(validate_typed_lock({"constraintType": "invalid"})["valid"]))
test("validation", "rejects None", lambda: assert_false(validate_typed_lock(None)["valid"]))
test("validation", "validates numerical", lambda: assert_true(validate_typed_lock({
    "constraintType": "numerical", "metric": "speed", "operator": "<=", "value": 3000
})["valid"]))
test("validation", "rejects numerical no metric", lambda: assert_false(validate_typed_lock({
    "constraintType": "numerical", "operator": "<=", "value": 3000
})["valid"]))
test("validation", "rejects bad operator", lambda: assert_false(validate_typed_lock({
    "constraintType": "numerical", "metric": "speed", "operator": "~=", "value": 100
})["valid"]))
test("validation", "rejects string value", lambda: assert_false(validate_typed_lock({
    "constraintType": "numerical", "metric": "speed", "operator": "<=", "value": "fast"
})["valid"]))
test("validation", "validates range", lambda: assert_true(validate_typed_lock({
    "constraintType": "range", "metric": "temp", "min": 20, "max": 80
})["valid"]))
test("validation", "rejects range min>=max", lambda: assert_false(validate_typed_lock({
    "constraintType": "range", "metric": "temp", "min": 80, "max": 20
})["valid"]))
test("validation", "validates state", lambda: assert_true(validate_typed_lock({
    "constraintType": "state", "entity": "robot", "forbidden": [{"from": "A", "to": "B"}]
})["valid"]))
test("validation", "rejects state no entity", lambda: assert_false(validate_typed_lock({
    "constraintType": "state", "forbidden": [{"from": "A", "to": "B"}]
})["valid"]))
test("validation", "rejects empty forbidden", lambda: assert_false(validate_typed_lock({
    "constraintType": "state", "entity": "robot", "forbidden": []
})["valid"]))
test("validation", "rejects bad forbidden", lambda: assert_false(validate_typed_lock({
    "constraintType": "state", "entity": "robot", "forbidden": [{"from": "A"}]
})["valid"]))
test("validation", "validates temporal", lambda: assert_true(validate_typed_lock({
    "constraintType": "temporal", "metric": "interval", "operator": "<=", "value": 100
})["valid"]))


# ============================================================
# NUMERICAL
# ============================================================

speed_lock = {"constraintType": "numerical", "metric": "motor_speed", "operator": "<=", "value": 3000, "unit": "RPM"}

test("numerical", "within limit — safe", lambda: assert_false(check_typed_constraint(speed_lock, {"value": 2500})["has_conflict"]))
test("numerical", "at boundary — safe", lambda: assert_false(check_typed_constraint(speed_lock, {"value": 3000})["has_conflict"]))
test("numerical", "exceeds — CONFLICT", lambda: assert_true(check_typed_constraint(speed_lock, {"value": 3500})["has_conflict"]))
test("numerical", "way over — HIGH", lambda: (
    assert_true(check_typed_constraint(speed_lock, {"value": 6000})["has_conflict"]),
    assert_eq(check_typed_constraint(speed_lock, {"value": 6000})["level"], "HIGH")
))
test("numerical", "strict < at boundary", lambda: assert_true(
    check_typed_constraint({**speed_lock, "operator": "<"}, {"value": 3000})["has_conflict"]
))
test("numerical", ">= below min", lambda: assert_true(check_typed_constraint(
    {"constraintType": "numerical", "metric": "pressure", "operator": ">=", "value": 10}, {"value": 5}
)["has_conflict"]))
test("numerical", ">= at min", lambda: assert_false(check_typed_constraint(
    {"constraintType": "numerical", "metric": "pressure", "operator": ">=", "value": 10}, {"value": 10}
)["has_conflict"]))
test("numerical", "!= equal CONFLICTS", lambda: assert_true(check_typed_constraint(
    {"constraintType": "numerical", "metric": "servo", "operator": "!=", "value": 0}, {"value": 0}
)["has_conflict"]))
test("numerical", "!= different safe", lambda: assert_false(check_typed_constraint(
    {"constraintType": "numerical", "metric": "servo", "operator": "!=", "value": 0}, {"value": 45}
)["has_conflict"]))
test("numerical", "non-number graceful", lambda: assert_false(check_typed_constraint(speed_lock, {"value": "fast"})["has_conflict"]))


# ============================================================
# RANGE
# ============================================================

temp_lock = {"constraintType": "range", "metric": "temperature", "min": 20, "max": 80, "unit": "°C"}

test("range", "within — safe", lambda: assert_false(check_typed_constraint(temp_lock, {"value": 50})["has_conflict"]))
test("range", "at min — safe", lambda: assert_false(check_typed_constraint(temp_lock, {"value": 20})["has_conflict"]))
test("range", "at max — safe", lambda: assert_false(check_typed_constraint(temp_lock, {"value": 80})["has_conflict"]))
test("range", "below min", lambda: assert_true(check_typed_constraint(temp_lock, {"value": 10})["has_conflict"]))
test("range", "above max", lambda: assert_true(check_typed_constraint(temp_lock, {"value": 95})["has_conflict"]))
test("range", "way out — HIGH", lambda: assert_eq(check_typed_constraint(temp_lock, {"value": 200})["level"], "HIGH"))
test("range", "negative range", lambda: (
    assert_false(check_typed_constraint({"constraintType": "range", "metric": "t", "min": -40, "max": -10}, {"value": -25})["has_conflict"]),
    assert_true(check_typed_constraint({"constraintType": "range", "metric": "t", "min": -40, "max": -10}, {"value": 5})["has_conflict"])
))


# ============================================================
# STATE
# ============================================================

robot_lock = {
    "constraintType": "state", "entity": "robot_arm",
    "forbidden": [{"from": "EMERGENCY", "to": "IDLE"}, {"from": "EMERGENCY", "to": "RUNNING"}],
    "requireApproval": True,
}

test("state", "allowed — safe", lambda: assert_false(check_typed_constraint(robot_lock, {"from": "IDLE", "to": "RUNNING"})["has_conflict"]))
test("state", "forbidden — CONFLICT", lambda: (
    assert_true(check_typed_constraint(robot_lock, {"from": "EMERGENCY", "to": "IDLE"})["has_conflict"]),
    assert_eq(check_typed_constraint(robot_lock, {"from": "EMERGENCY", "to": "IDLE"})["confidence"], 100)
))
test("state", "another forbidden", lambda: assert_true(check_typed_constraint(robot_lock, {"from": "EMERGENCY", "to": "RUNNING"})["has_conflict"]))
test("state", "case insensitive", lambda: assert_true(check_typed_constraint(robot_lock, {"from": "emergency", "to": "idle"})["has_conflict"]))
test("state", "approval in reasons", lambda: assert_true(
    any("human approval" in r for r in check_typed_constraint(robot_lock, {"from": "EMERGENCY", "to": "IDLE"})["reasons"])
))
test("state", "wildcard from", lambda: (
    assert_true(check_typed_constraint({"constraintType": "state", "entity": "v", "forbidden": [{"from": "*", "to": "OVERRIDE"}]}, {"from": "NORMAL", "to": "OVERRIDE"})["has_conflict"]),
    assert_false(check_typed_constraint({"constraintType": "state", "entity": "v", "forbidden": [{"from": "*", "to": "OVERRIDE"}]}, {"from": "NORMAL", "to": "STANDBY"})["has_conflict"])
))
test("state", "wildcard to", lambda: (
    assert_true(check_typed_constraint({"constraintType": "state", "entity": "r", "forbidden": [{"from": "SHUTDOWN", "to": "*"}]}, {"from": "SHUTDOWN", "to": "STARTING"})["has_conflict"]),
    assert_false(check_typed_constraint({"constraintType": "state", "entity": "r", "forbidden": [{"from": "SHUTDOWN", "to": "*"}]}, {"from": "RUNNING", "to": "STANDBY"})["has_conflict"])
))
test("state", "missing to graceful", lambda: assert_false(check_typed_constraint(robot_lock, {"from": "EMERGENCY"})["has_conflict"]))


# ============================================================
# TEMPORAL
# ============================================================

sensor_lock = {"constraintType": "temporal", "metric": "sensor_interval", "operator": "<=", "value": 100, "unit": "ms"}

test("temporal", "within — safe", lambda: assert_false(check_typed_constraint(sensor_lock, {"value": 50})["has_conflict"]))
test("temporal", "at limit — safe", lambda: assert_false(check_typed_constraint(sensor_lock, {"value": 100})["has_conflict"]))
test("temporal", "exceeds — CONFLICT", lambda: assert_true(check_typed_constraint(sensor_lock, {"value": 200})["has_conflict"]))
test("temporal", "very slow — HIGH", lambda: assert_eq(check_typed_constraint(sensor_lock, {"value": 1000})["level"], "HIGH"))
test("temporal", "min freq", lambda: (
    assert_true(check_typed_constraint({"constraintType": "temporal", "metric": "hb", "operator": ">=", "value": 1}, {"value": 0.5})["has_conflict"]),
    assert_false(check_typed_constraint({"constraintType": "temporal", "metric": "hb", "operator": ">=", "value": 1}, {"value": 2})["has_conflict"])
))


# ============================================================
# BULK CHECKING
# ============================================================

all_locks = [
    {"id": "lock_speed", "constraintType": "numerical", "metric": "motor_speed", "operator": "<=", "value": 3000, "active": True, "text": "speed"},
    {"id": "lock_temp", "constraintType": "range", "metric": "temperature", "min": 20, "max": 80, "active": True, "text": "temp"},
    {"id": "lock_state", "constraintType": "state", "entity": "robot_arm", "forbidden": [{"from": "EMERGENCY", "to": "IDLE"}], "active": True, "text": "state"},
    {"id": "lock_text", "text": "Never switch Stripe", "active": True},
]

test("bulk", "matching metric safe", lambda: assert_false(check_all_typed_constraints(all_locks, {"metric": "motor_speed", "value": 2500})["has_conflict"]))
test("bulk", "numerical violation", lambda: assert_eq(check_all_typed_constraints(all_locks, {"metric": "motor_speed", "value": 4000})["conflicting_locks"][0]["id"], "lock_speed"))
test("bulk", "range violation", lambda: assert_eq(check_all_typed_constraints(all_locks, {"metric": "temperature", "value": 95})["conflicting_locks"][0]["id"], "lock_temp"))
test("bulk", "state violation", lambda: assert_eq(check_all_typed_constraints(all_locks, {"entity": "robot_arm", "from": "EMERGENCY", "to": "IDLE"})["conflicting_locks"][0]["id"], "lock_state"))
test("bulk", "ignores text locks", lambda: assert_true(all(c["id"] != "lock_text" for c in check_all_typed_constraints(all_locks, {"metric": "motor_speed", "value": 2500}).get("conflicting_locks", []))))
test("bulk", "ignores inactive", lambda: assert_false(check_all_typed_constraints(
    all_locks + [{"id": "off", "constraintType": "numerical", "metric": "motor_speed", "operator": "<=", "value": 1000, "active": False}],
    {"metric": "motor_speed", "value": 2500}
)["has_conflict"]))
test("bulk", "empty locks", lambda: assert_false(check_all_typed_constraints([], {"metric": "s", "value": 100})["has_conflict"]))
test("bulk", "unmatched metric", lambda: assert_false(check_all_typed_constraints(all_locks, {"metric": "unknown", "value": 99999})["has_conflict"]))


# ============================================================
# FORMAT TEXT
# ============================================================

test("format", "numerical", lambda: assert_true("motor_speed" in format_typed_lock_text({"constraintType": "numerical", "metric": "motor_speed", "operator": "<=", "value": 3000, "unit": "RPM"})))
test("format", "range", lambda: assert_true("20" in format_typed_lock_text({"constraintType": "range", "metric": "temp", "min": 20, "max": 80})))
test("format", "state", lambda: assert_true("robot" in format_typed_lock_text({"constraintType": "state", "entity": "robot", "forbidden": [{"from": "A", "to": "B"}]})))
test("format", "temporal", lambda: assert_true("100" in format_typed_lock_text({"constraintType": "temporal", "metric": "interval", "operator": "<=", "value": 100, "unit": "ms"})))


# ============================================================
# REAL-WORLD SCENARIOS
# ============================================================

test("real-world", "Robot joint angle", lambda: (
    assert_false(check_typed_constraint({"constraintType": "numerical", "metric": "joint_angle", "operator": "<=", "value": 170, "unit": "deg"}, {"value": 90})["has_conflict"]),
    assert_true(check_typed_constraint({"constraintType": "numerical", "metric": "joint_angle", "operator": "<=", "value": 170, "unit": "deg"}, {"value": 180})["has_conflict"])
))

test("real-world", "Vehicle speed school zone", lambda: (
    assert_false(check_typed_constraint({"constraintType": "numerical", "metric": "speed", "operator": "<=", "value": 30, "unit": "km/h"}, {"value": 25})["has_conflict"]),
    assert_true(check_typed_constraint({"constraintType": "numerical", "metric": "speed", "operator": "<=", "value": 30, "unit": "km/h"}, {"value": 50})["has_conflict"])
))

test("real-world", "Trading position limit", lambda: (
    assert_false(check_typed_constraint({"constraintType": "range", "metric": "exposure", "min": -100000, "max": 500000, "unit": "USD"}, {"value": 250000})["has_conflict"]),
    assert_true(check_typed_constraint({"constraintType": "range", "metric": "exposure", "min": -100000, "max": 500000, "unit": "USD"}, {"value": 750000})["has_conflict"])
))

test("real-world", "Medical IV drip", lambda: assert_true(check_typed_constraint(
    {"constraintType": "range", "metric": "iv_rate", "min": 10, "max": 250, "unit": "mL/hr"}, {"value": 500}
)["has_conflict"]))

test("real-world", "Autonomous vehicle emergency", lambda: (
    assert_true(check_typed_constraint(
        {"constraintType": "state", "entity": "av", "forbidden": [{"from": "EMERGENCY_STOP", "to": "AUTONOMOUS"}, {"from": "*", "to": "OVERRIDE_ALL"}], "requireApproval": True},
        {"from": "EMERGENCY_STOP", "to": "AUTONOMOUS"}
    )["has_conflict"]),
    assert_false(check_typed_constraint(
        {"constraintType": "state", "entity": "av", "forbidden": [{"from": "EMERGENCY_STOP", "to": "AUTONOMOUS"}, {"from": "*", "to": "OVERRIDE_ALL"}], "requireApproval": True},
        {"from": "EMERGENCY_STOP", "to": "MANUAL"}
    )["has_conflict"])
))

test("real-world", "IoT sensor polling", lambda: (
    assert_false(check_typed_constraint({"constraintType": "temporal", "metric": "poll", "operator": "<=", "value": 500, "unit": "ms"}, {"value": 250})["has_conflict"]),
    assert_true(check_typed_constraint({"constraintType": "temporal", "metric": "poll", "operator": "<=", "value": 500, "unit": "ms"}, {"value": 2000})["has_conflict"])
))


# ============================================================
# INTEGRATION: SpecLock class with brain.json
# ============================================================

def _test_speclock_integration():
    tmpdir = tempfile.mkdtemp()
    try:
        sl = SpecLock(tmpdir)
        sl.init(goal="Test robot safety")

        # Add typed locks
        lock_id = sl.add_typed_lock("numerical", metric="motor_speed", operator="<=", value=3000, unit="RPM")
        assert_true(lock_id.startswith("lock_"), f"Lock ID should start with lock_: {lock_id}")

        sl.add_typed_lock("state", entity="robot_arm", forbidden=[{"from": "EMERGENCY", "to": "IDLE"}], requireApproval=True)

        # Check — safe
        result = sl.check_typed(metric="motor_speed", value=2500)
        assert_false(result.has_conflict, "2500 should be safe")

        # Check — violation
        result = sl.check_typed(metric="motor_speed", value=4000)
        assert_true(result.has_conflict, "4000 should violate")
        assert_true(len(result.conflicting_locks) > 0)

        # State check
        result = sl.check_typed(entity="robot_arm", from_state="EMERGENCY", to_state="IDLE")
        assert_true(result.has_conflict, "EMERGENCY->IDLE should be forbidden")

        # Status
        s = sl.status()
        assert_eq(s["typed_locks"], 2, "Should have 2 typed locks")
        assert_eq(s["goal"], "Test robot safety")

        # Brain.json should be readable by Node.js (same format)
        brain_path = os.path.join(tmpdir, ".speclock", "brain.json")
        assert_true(os.path.exists(brain_path))
        with open(brain_path) as f:
            brain_data = json.load(f)
        assert_eq(brain_data["version"], 2)
        assert_true(any(l.get("constraintType") == "numerical" for l in brain_data["specLock"]["items"]))
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

test("integration", "SpecLock end-to-end", lambda: _test_speclock_integration())


# ============================================================
# RESULTS
# ============================================================

total = passed + failed

print()
print("=" * 70)
print("  SpecLock Python SDK — Typed Constraints Test Results")
print("=" * 70)
print(f"\n  Total: {total} tests | PASSED: {passed} | FAILED: {failed}")

print("\n  By Category:")
for cat, stats in categories.items():
    pct = (stats["passed"] / stats["total"] * 100) if stats["total"] > 0 else 0
    status = "PASS" if stats["failed"] == 0 else "FAIL"
    print(f"    {cat:<18} {stats['passed']}/{stats['total']} ({pct:.0f}%) [{status}]")

if failures:
    print(f"\n  FAILURES ({len(failures)}):")
    for f in failures:
        print(f"\n    [{f['category']}] {f['name']}")
        print(f"    Error: {f['error']}")

print()
print("=" * 70)
if failed == 0:
    print(f"  RESULT: ALL {total} TESTS PASSED — Python SDK ready")
else:
    print(f"  RESULT: {failed} FAILURES — Fix required")
print("=" * 70)
print()

sys.exit(0 if failed == 0 else 1)
