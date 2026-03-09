"""
SpecLock Typed Constraints — Python Implementation

Universal constraint types for autonomous systems governance.
Handles numerical, range, state, and temporal constraints.

Fully compatible with the Node.js typed-constraints.js module.
Both read/write the same brain.json format.

Use cases:
- Robotics: motor speed limits, joint angles, zone restrictions
- Vehicles: speed limits, temperature ranges, safety states
- Trading: position limits, risk thresholds, order rates
- Medical: dosage limits, vital sign ranges, protocol states

Developed by Sandeep Roy (https://github.com/sgroy10)
"""

from typing import Any, Optional

CONSTRAINT_TYPES = ["numerical", "range", "state", "temporal"]
OPERATORS = ["<", "<=", "==", "!=", ">=", ">"]


def validate_typed_lock(lock: dict) -> dict:
    """Validate a typed lock definition before storing.

    Returns: {"valid": True} or {"valid": False, "error": "reason"}
    """
    if not lock or not isinstance(lock, dict):
        return {"valid": False, "error": "Lock must be a dict"}

    ct = lock.get("constraintType")
    if ct not in CONSTRAINT_TYPES:
        return {"valid": False, "error": f"Invalid constraintType: {ct}. Must be one of: {', '.join(CONSTRAINT_TYPES)}"}

    validators = {
        "numerical": _validate_numerical,
        "range": _validate_range,
        "state": _validate_state,
        "temporal": _validate_temporal,
    }
    return validators[ct](lock)


def _validate_numerical(lock: dict) -> dict:
    if not lock.get("metric") or not isinstance(lock.get("metric"), str):
        return {"valid": False, "error": "numerical constraint requires 'metric' (str)"}
    if lock.get("operator") not in OPERATORS:
        return {"valid": False, "error": f"Invalid operator: {lock.get('operator')}. Must be one of: {', '.join(OPERATORS)}"}
    if not isinstance(lock.get("value"), (int, float)):
        return {"valid": False, "error": "numerical constraint requires 'value' (number)"}
    return {"valid": True}


def _validate_range(lock: dict) -> dict:
    if not lock.get("metric") or not isinstance(lock.get("metric"), str):
        return {"valid": False, "error": "range constraint requires 'metric' (str)"}
    if not isinstance(lock.get("min"), (int, float)):
        return {"valid": False, "error": "range constraint requires 'min' (number)"}
    if not isinstance(lock.get("max"), (int, float)):
        return {"valid": False, "error": "range constraint requires 'max' (number)"}
    if lock["min"] >= lock["max"]:
        return {"valid": False, "error": f"'min' ({lock['min']}) must be less than 'max' ({lock['max']})"}
    return {"valid": True}


def _validate_state(lock: dict) -> dict:
    if not lock.get("entity") or not isinstance(lock.get("entity"), str):
        return {"valid": False, "error": "state constraint requires 'entity' (str)"}
    forbidden = lock.get("forbidden")
    if not isinstance(forbidden, list) or len(forbidden) == 0:
        return {"valid": False, "error": "state constraint requires 'forbidden' (non-empty list of {from, to})"}
    for i, t in enumerate(forbidden):
        if not isinstance(t, dict) or not isinstance(t.get("from"), str) or not isinstance(t.get("to"), str):
            return {"valid": False, "error": f"forbidden[{i}] must have 'from' and 'to' strings"}
    return {"valid": True}


def _validate_temporal(lock: dict) -> dict:
    if not lock.get("metric") or not isinstance(lock.get("metric"), str):
        return {"valid": False, "error": "temporal constraint requires 'metric' (str)"}
    if lock.get("operator") not in OPERATORS:
        return {"valid": False, "error": f"Invalid operator: {lock.get('operator')}. Must be one of: {', '.join(OPERATORS)}"}
    if not isinstance(lock.get("value"), (int, float)):
        return {"valid": False, "error": "temporal constraint requires 'value' (number)"}
    return {"valid": True}


def _evaluate_operator(proposed: float, operator: str, threshold: float) -> bool:
    ops = {
        "<": lambda a, b: a < b,
        "<=": lambda a, b: a <= b,
        "==": lambda a, b: a == b,
        "!=": lambda a, b: a != b,
        ">=": lambda a, b: a >= b,
        ">": lambda a, b: a > b,
    }
    return ops.get(operator, lambda a, b: False)(proposed, threshold)


def check_typed_constraint(lock: dict, proposed: dict) -> dict:
    """Check a proposed value/action against a single typed lock.

    Args:
        lock: The typed lock from brain.json
        proposed: What's being proposed:
            numerical: {"value": number}
            range:     {"value": number}
            state:     {"from": str, "to": str}
            temporal:  {"value": number}

    Returns:
        {"has_conflict": bool, "confidence": int, "level": str, "reasons": list}
    """
    if not lock or not proposed:
        return {"has_conflict": False, "confidence": 0, "level": "SAFE", "reasons": ["Missing lock or proposed value"]}

    checkers = {
        "numerical": _check_numerical,
        "range": _check_range,
        "state": _check_state,
        "temporal": _check_temporal,
    }
    checker = checkers.get(lock.get("constraintType"))
    if not checker:
        return {"has_conflict": False, "confidence": 0, "level": "SAFE", "reasons": ["Unknown constraint type"]}
    return checker(lock, proposed)


def _check_numerical(lock: dict, proposed: dict) -> dict:
    value = proposed.get("value")
    if not isinstance(value, (int, float)):
        return {"has_conflict": False, "confidence": 0, "level": "SAFE", "reasons": ["Proposed value is not a number"]}

    unit = f" {lock.get('unit', '')}" if lock.get("unit") else ""
    if _evaluate_operator(value, lock["operator"], lock["value"]):
        return {
            "has_conflict": False, "confidence": 0, "level": "SAFE",
            "reasons": [f"{lock['metric']}: {value} {lock['operator']} {lock['value']}{unit} — within limit"],
        }

    distance = abs(value - lock["value"])
    scale = abs(lock["value"]) or 1
    overage_pct = (distance / scale) * 100
    confidence = min(100, round(70 + overage_pct * 0.3))

    return {
        "has_conflict": True,
        "confidence": confidence,
        "level": "HIGH" if confidence >= 90 else "MEDIUM",
        "reasons": [
            f"{lock['metric']}: proposed {value} violates constraint {lock['operator']} {lock['value']}{unit}",
            f"Overage: {distance:.2f}{unit} beyond limit",
        ],
    }


def _check_range(lock: dict, proposed: dict) -> dict:
    value = proposed.get("value")
    if not isinstance(value, (int, float)):
        return {"has_conflict": False, "confidence": 0, "level": "SAFE", "reasons": ["Proposed value is not a number"]}

    unit = f" {lock.get('unit', '')}" if lock.get("unit") else ""
    if lock["min"] <= value <= lock["max"]:
        return {
            "has_conflict": False, "confidence": 0, "level": "SAFE",
            "reasons": [f"{lock['metric']}: {value} is within range [{lock['min']}, {lock['max']}]{unit}"],
        }

    distance = lock["min"] - value if value < lock["min"] else value - lock["max"]
    range_size = lock["max"] - lock["min"]
    overage_pct = (distance / (range_size or 1)) * 100
    confidence = min(100, round(70 + overage_pct * 0.3))
    direction = "below minimum" if value < lock["min"] else "above maximum"

    return {
        "has_conflict": True,
        "confidence": confidence,
        "level": "HIGH" if confidence >= 90 else "MEDIUM",
        "reasons": [
            f"{lock['metric']}: proposed {value} is {direction} [{lock['min']}, {lock['max']}]{unit}",
            f"Out of range by {distance:.2f}{unit}",
        ],
    }


def _check_state(lock: dict, proposed: dict) -> dict:
    from_state = proposed.get("from")
    to_state = proposed.get("to")
    if not from_state or not to_state:
        return {"has_conflict": False, "confidence": 0, "level": "SAFE", "reasons": ["Missing from/to state"]}

    from_norm = from_state.upper().strip()
    to_norm = to_state.upper().strip()

    for forbidden in lock.get("forbidden", []):
        forbid_from = forbidden["from"].upper().strip()
        forbid_to = forbidden["to"].upper().strip()
        from_match = forbid_from == "*" or forbid_from == from_norm
        to_match = forbid_to == "*" or forbid_to == to_norm

        if from_match and to_match:
            require_approval = lock.get("requireApproval", False)
            return {
                "has_conflict": True,
                "confidence": 100,
                "level": "HIGH",
                "reasons": [
                    f"{lock['entity']}: transition {from_state} -> {to_state} is forbidden",
                    "This transition requires explicit human approval" if require_approval
                    else "This state transition is not allowed",
                ],
            }

    return {
        "has_conflict": False, "confidence": 0, "level": "SAFE",
        "reasons": [f"{lock['entity']}: transition {from_state} -> {to_state} is allowed"],
    }


def _check_temporal(lock: dict, proposed: dict) -> dict:
    value = proposed.get("value")
    if not isinstance(value, (int, float)):
        return {"has_conflict": False, "confidence": 0, "level": "SAFE", "reasons": ["Proposed value is not a number"]}

    unit = lock.get("unit", "")
    if _evaluate_operator(value, lock["operator"], lock["value"]):
        return {
            "has_conflict": False, "confidence": 0, "level": "SAFE",
            "reasons": [f"{lock['metric']}: {value}{unit} {lock['operator']} {lock['value']}{unit} — within limit"],
        }

    distance = abs(value - lock["value"])
    scale = abs(lock["value"]) or 1
    overage_pct = (distance / scale) * 100
    confidence = min(100, round(80 + overage_pct * 0.2))

    return {
        "has_conflict": True,
        "confidence": confidence,
        "level": "HIGH" if confidence >= 90 else "MEDIUM",
        "reasons": [
            f"{lock['metric']}: proposed {value}{unit} violates constraint {lock['operator']} {lock['value']}{unit}",
            f"Timing violation: off by {distance:.2f}{unit}",
        ],
    }


def check_all_typed_constraints(locks: list, proposed: dict) -> dict:
    """Check ALL typed locks against a proposed value/action.

    Args:
        locks: All locks from brain.specLock.items
        proposed: {"metric"?: str, "entity"?: str, "value"?: number, "from"?: str, "to"?: str}

    Returns:
        {"has_conflict": bool, "conflicting_locks": list, "analysis": str}
    """
    if not locks or not isinstance(locks, list):
        return {"has_conflict": False, "conflicting_locks": [], "analysis": "No locks to check."}

    typed_locks = [l for l in locks if l.get("active", True) and l.get("constraintType") in CONSTRAINT_TYPES]
    if not typed_locks:
        return {"has_conflict": False, "conflicting_locks": [], "analysis": "No typed constraints to check against."}

    # Filter relevant locks by metric or entity
    metric = proposed.get("metric")
    entity = proposed.get("entity")
    relevant = [
        l for l in typed_locks
        if (metric and l.get("metric") == metric)
        or (entity and l.get("entity") == entity)
        or (not metric and not entity)
    ]

    if not relevant:
        return {
            "has_conflict": False,
            "conflicting_locks": [],
            "analysis": f"No typed constraints found for {metric or entity or 'unknown'}. {len(typed_locks)} typed lock(s) exist for other metrics/entities.",
        }

    conflicting = []
    for lock in relevant:
        result = check_typed_constraint(lock, proposed)
        if result["has_conflict"]:
            conflicting.append({
                "id": lock.get("id", "unknown"),
                "text": lock.get("text", format_typed_lock_text(lock)),
                "constraint_type": lock["constraintType"],
                "metric": lock.get("metric"),
                "entity": lock.get("entity"),
                "confidence": result["confidence"],
                "level": result["level"],
                "reasons": result["reasons"],
            })

    if not conflicting:
        return {
            "has_conflict": False,
            "conflicting_locks": [],
            "analysis": f"Checked {len(relevant)} typed constraint(s). All within limits.",
        }

    conflicting.sort(key=lambda c: c["confidence"], reverse=True)
    details = "\n".join(
        f"- [{c['level']}] {c['constraint_type']}/{c.get('metric') or c.get('entity')}: {c['reasons'][0]} ({c['confidence']}%)"
        for c in conflicting
    )

    return {
        "has_conflict": True,
        "conflicting_locks": conflicting,
        "analysis": f"VIOLATION: {len(conflicting)} typed constraint(s) violated:\n{details}",
    }


def format_typed_lock_text(lock: dict) -> str:
    """Generate human-readable text for a typed lock."""
    ct = lock.get("constraintType")
    unit = f" {lock.get('unit', '')}" if lock.get("unit") else ""

    if ct == "numerical":
        return f"{lock.get('metric')} must be {lock.get('operator')} {lock.get('value')}{unit}"
    elif ct == "range":
        return f"{lock.get('metric')} must stay between {lock.get('min')} and {lock.get('max')}{unit}"
    elif ct == "state":
        transitions = ", ".join(f"{f['from']} -> {f['to']}" for f in lock.get("forbidden", []))
        approval = " (requires human approval)" if lock.get("requireApproval") else ""
        return f"{lock.get('entity')}: forbidden transitions: {transitions}{approval}"
    elif ct == "temporal":
        return f"{lock.get('metric')} must be {lock.get('operator')} {lock.get('value')}{unit}"
    return "Unknown typed constraint"
