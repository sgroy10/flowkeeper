/**
 * SpecLock Typed Constraints Module
 * Universal constraint types for autonomous systems governance.
 * Handles numerical, range, state, and temporal constraints.
 *
 * Existing text-based locks continue using the semantic engine.
 * This module adds typed constraint checking for real-world systems:
 * - Robotics: motor speed limits, joint angles, zone restrictions
 * - Vehicles: speed limits, temperature ranges, safety states
 * - Trading: position limits, risk thresholds, order rates
 * - Medical: dosage limits, vital sign ranges, protocol states
 *
 * Developed by Sandeep Roy (https://github.com/sgroy10)
 */

/**
 * Supported constraint types.
 * "text" is the existing semantic type (handled by semantics.js, not here).
 */
export const CONSTRAINT_TYPES = ["numerical", "range", "state", "temporal"];

/**
 * Supported operators for numerical and temporal constraints.
 */
export const OPERATORS = ["<", "<=", "==", "!=", ">=", ">"];

/**
 * Validate a typed lock definition before storing it.
 * Returns { valid: true } or { valid: false, error: "reason" }.
 */
export function validateTypedLock(lock) {
  if (!lock || typeof lock !== "object") {
    return { valid: false, error: "Lock must be an object" };
  }

  const { constraintType } = lock;
  if (!CONSTRAINT_TYPES.includes(constraintType)) {
    return { valid: false, error: `Invalid constraintType: ${constraintType}. Must be one of: ${CONSTRAINT_TYPES.join(", ")}` };
  }

  switch (constraintType) {
    case "numerical":
      return validateNumerical(lock);
    case "range":
      return validateRange(lock);
    case "state":
      return validateState(lock);
    case "temporal":
      return validateTemporal(lock);
    default:
      return { valid: false, error: `Unknown constraintType: ${constraintType}` };
  }
}

function validateNumerical(lock) {
  if (!lock.metric || typeof lock.metric !== "string") {
    return { valid: false, error: "numerical constraint requires 'metric' (string)" };
  }
  if (!OPERATORS.includes(lock.operator)) {
    return { valid: false, error: `Invalid operator: ${lock.operator}. Must be one of: ${OPERATORS.join(", ")}` };
  }
  if (typeof lock.value !== "number" || isNaN(lock.value)) {
    return { valid: false, error: "numerical constraint requires 'value' (number)" };
  }
  return { valid: true };
}

function validateRange(lock) {
  if (!lock.metric || typeof lock.metric !== "string") {
    return { valid: false, error: "range constraint requires 'metric' (string)" };
  }
  if (typeof lock.min !== "number" || isNaN(lock.min)) {
    return { valid: false, error: "range constraint requires 'min' (number)" };
  }
  if (typeof lock.max !== "number" || isNaN(lock.max)) {
    return { valid: false, error: "range constraint requires 'max' (number)" };
  }
  if (lock.min >= lock.max) {
    return { valid: false, error: `'min' (${lock.min}) must be less than 'max' (${lock.max})` };
  }
  return { valid: true };
}

function validateState(lock) {
  if (!lock.entity || typeof lock.entity !== "string") {
    return { valid: false, error: "state constraint requires 'entity' (string)" };
  }
  if (!Array.isArray(lock.forbidden) || lock.forbidden.length === 0) {
    return { valid: false, error: "state constraint requires 'forbidden' (non-empty array of { from, to } transitions)" };
  }
  for (let i = 0; i < lock.forbidden.length; i++) {
    const t = lock.forbidden[i];
    if (!t || typeof t.from !== "string" || typeof t.to !== "string") {
      return { valid: false, error: `forbidden[${i}] must have 'from' and 'to' strings` };
    }
  }
  return { valid: true };
}

function validateTemporal(lock) {
  if (!lock.metric || typeof lock.metric !== "string") {
    return { valid: false, error: "temporal constraint requires 'metric' (string)" };
  }
  if (!OPERATORS.includes(lock.operator)) {
    return { valid: false, error: `Invalid operator: ${lock.operator}. Must be one of: ${OPERATORS.join(", ")}` };
  }
  if (typeof lock.value !== "number" || isNaN(lock.value)) {
    return { valid: false, error: "temporal constraint requires 'value' (number)" };
  }
  return { valid: true };
}

/**
 * Check a proposed value/action against a single typed lock.
 * Returns { hasConflict, confidence, level, reasons[] }.
 *
 * @param {Object} lock - The typed lock from brain.json
 * @param {Object} proposed - What's being proposed. Shape depends on constraintType:
 *   numerical: { value: number }
 *   range:     { value: number }
 *   state:     { from: string, to: string }
 *   temporal:  { value: number }
 */
export function checkTypedConstraint(lock, proposed) {
  if (!lock || !proposed) {
    return { hasConflict: false, confidence: 0, level: "SAFE", reasons: ["Missing lock or proposed value"] };
  }

  switch (lock.constraintType) {
    case "numerical":
      return checkNumerical(lock, proposed);
    case "range":
      return checkRange(lock, proposed);
    case "state":
      return checkState(lock, proposed);
    case "temporal":
      return checkTemporal(lock, proposed);
    default:
      return { hasConflict: false, confidence: 0, level: "SAFE", reasons: ["Unknown constraint type"] };
  }
}

/**
 * Check a numerical constraint.
 * Lock: { metric, operator, value, unit }
 * Proposed: { value }
 */
function checkNumerical(lock, proposed) {
  if (typeof proposed.value !== "number") {
    return { hasConflict: false, confidence: 0, level: "SAFE", reasons: ["Proposed value is not a number"] };
  }

  const passes = evaluateOperator(proposed.value, lock.operator, lock.value);
  if (passes) {
    return {
      hasConflict: false,
      confidence: 0,
      level: "SAFE",
      reasons: [`${lock.metric}: ${proposed.value} ${lock.operator} ${lock.value}${lock.unit ? " " + lock.unit : ""} — within limit`],
    };
  }

  // Calculate how far the violation is (for confidence scoring)
  const distance = Math.abs(proposed.value - lock.value);
  const scale = Math.abs(lock.value) || 1;
  const overagePercent = (distance / scale) * 100;
  const confidence = Math.min(100, Math.round(70 + overagePercent * 0.3));

  return {
    hasConflict: true,
    confidence,
    level: confidence >= 90 ? "HIGH" : "MEDIUM",
    reasons: [
      `${lock.metric}: proposed ${proposed.value} violates constraint ${lock.operator} ${lock.value}${lock.unit ? " " + lock.unit : ""}`,
      `Overage: ${distance.toFixed(2)}${lock.unit ? " " + lock.unit : ""} beyond limit`,
    ],
  };
}

/**
 * Check a range constraint.
 * Lock: { metric, min, max, unit }
 * Proposed: { value }
 */
function checkRange(lock, proposed) {
  if (typeof proposed.value !== "number") {
    return { hasConflict: false, confidence: 0, level: "SAFE", reasons: ["Proposed value is not a number"] };
  }

  if (proposed.value >= lock.min && proposed.value <= lock.max) {
    return {
      hasConflict: false,
      confidence: 0,
      level: "SAFE",
      reasons: [`${lock.metric}: ${proposed.value} is within range [${lock.min}, ${lock.max}]${lock.unit ? " " + lock.unit : ""}`],
    };
  }

  const distance = proposed.value < lock.min
    ? lock.min - proposed.value
    : proposed.value - lock.max;
  const rangeSize = lock.max - lock.min;
  const overagePercent = (distance / (rangeSize || 1)) * 100;
  const confidence = Math.min(100, Math.round(70 + overagePercent * 0.3));

  const direction = proposed.value < lock.min ? "below minimum" : "above maximum";

  return {
    hasConflict: true,
    confidence,
    level: confidence >= 90 ? "HIGH" : "MEDIUM",
    reasons: [
      `${lock.metric}: proposed ${proposed.value} is ${direction} [${lock.min}, ${lock.max}]${lock.unit ? " " + lock.unit : ""}`,
      `Out of range by ${distance.toFixed(2)}${lock.unit ? " " + lock.unit : ""}`,
    ],
  };
}

/**
 * Check a state transition constraint.
 * Lock: { entity, forbidden: [{ from, to }], requireApproval }
 * Proposed: { from, to }
 */
function checkState(lock, proposed) {
  if (!proposed.from || !proposed.to) {
    return { hasConflict: false, confidence: 0, level: "SAFE", reasons: ["Missing from/to state"] };
  }

  const fromNorm = proposed.from.toUpperCase().trim();
  const toNorm = proposed.to.toUpperCase().trim();

  for (const forbidden of lock.forbidden) {
    const forbidFrom = forbidden.from.toUpperCase().trim();
    const forbidTo = forbidden.to.toUpperCase().trim();

    // Wildcard support: "*" matches any state
    const fromMatch = forbidFrom === "*" || forbidFrom === fromNorm;
    const toMatch = forbidTo === "*" || forbidTo === toNorm;

    if (fromMatch && toMatch) {
      return {
        hasConflict: true,
        confidence: 100,
        level: "HIGH",
        reasons: [
          `${lock.entity}: transition ${proposed.from} -> ${proposed.to} is forbidden`,
          lock.requireApproval
            ? "This transition requires explicit human approval"
            : "This state transition is not allowed",
        ],
      };
    }
  }

  return {
    hasConflict: false,
    confidence: 0,
    level: "SAFE",
    reasons: [`${lock.entity}: transition ${proposed.from} -> ${proposed.to} is allowed`],
  };
}

/**
 * Check a temporal constraint.
 * Lock: { metric, operator, value, unit }
 * Proposed: { value }
 *
 * Same logic as numerical, but semantically for time intervals/frequencies.
 */
function checkTemporal(lock, proposed) {
  if (typeof proposed.value !== "number") {
    return { hasConflict: false, confidence: 0, level: "SAFE", reasons: ["Proposed value is not a number"] };
  }

  const passes = evaluateOperator(proposed.value, lock.operator, lock.value);
  if (passes) {
    return {
      hasConflict: false,
      confidence: 0,
      level: "SAFE",
      reasons: [`${lock.metric}: ${proposed.value}${lock.unit ? lock.unit : ""} ${lock.operator} ${lock.value}${lock.unit ? lock.unit : ""} — within limit`],
    };
  }

  const distance = Math.abs(proposed.value - lock.value);
  const scale = Math.abs(lock.value) || 1;
  const overagePercent = (distance / scale) * 100;
  const confidence = Math.min(100, Math.round(80 + overagePercent * 0.2));

  return {
    hasConflict: true,
    confidence,
    level: confidence >= 90 ? "HIGH" : "MEDIUM",
    reasons: [
      `${lock.metric}: proposed ${proposed.value}${lock.unit ? lock.unit : ""} violates constraint ${lock.operator} ${lock.value}${lock.unit ? lock.unit : ""}`,
      `Timing violation: off by ${distance.toFixed(2)}${lock.unit ? lock.unit : ""}`,
    ],
  };
}

/**
 * Evaluate a comparison operator.
 */
function evaluateOperator(proposed, operator, threshold) {
  switch (operator) {
    case "<":  return proposed < threshold;
    case "<=": return proposed <= threshold;
    case "==": return proposed === threshold;
    case "!=": return proposed !== threshold;
    case ">=": return proposed >= threshold;
    case ">":  return proposed > threshold;
    default:   return false;
  }
}

/**
 * Check ALL typed locks in brain against a proposed value/action.
 * Filters locks by metric/entity to only check relevant ones.
 *
 * @param {Array} locks - All locks from brain.specLock.items
 * @param {Object} proposed - { metric?, entity?, value?, from?, to? }
 * @returns {Object} { hasConflict, conflictingLocks[], analysis }
 */
export function checkAllTypedConstraints(locks, proposed) {
  if (!locks || !Array.isArray(locks)) {
    return { hasConflict: false, conflictingLocks: [], analysis: "No locks to check." };
  }

  const typedLocks = locks.filter(l =>
    l.active !== false && CONSTRAINT_TYPES.includes(l.constraintType)
  );

  if (typedLocks.length === 0) {
    return { hasConflict: false, conflictingLocks: [], analysis: "No typed constraints to check against." };
  }

  // Filter relevant locks: match by metric or entity
  const relevant = typedLocks.filter(l => {
    if (proposed.metric && (l.metric === proposed.metric)) return true;
    if (proposed.entity && (l.entity === proposed.entity)) return true;
    // If no metric/entity filter, check all typed locks
    if (!proposed.metric && !proposed.entity) return true;
    return false;
  });

  if (relevant.length === 0) {
    return {
      hasConflict: false,
      conflictingLocks: [],
      analysis: `No typed constraints found for ${proposed.metric || proposed.entity || "unknown"}. ${typedLocks.length} typed lock(s) exist for other metrics/entities.`,
    };
  }

  const conflicting = [];
  for (const lock of relevant) {
    const result = checkTypedConstraint(lock, proposed);
    if (result.hasConflict) {
      conflicting.push({
        id: lock.id,
        text: lock.text || formatTypedLockText(lock),
        constraintType: lock.constraintType,
        metric: lock.metric,
        entity: lock.entity,
        confidence: result.confidence,
        level: result.level,
        reasons: result.reasons,
      });
    }
  }

  if (conflicting.length === 0) {
    return {
      hasConflict: false,
      conflictingLocks: [],
      analysis: `Checked ${relevant.length} typed constraint(s). All within limits.`,
    };
  }

  conflicting.sort((a, b) => b.confidence - a.confidence);
  const details = conflicting
    .map(c => `- [${c.level}] ${c.constraintType}/${c.metric || c.entity}: ${c.reasons[0]} (${c.confidence}%)`)
    .join("\n");

  return {
    hasConflict: true,
    conflictingLocks: conflicting,
    analysis: `VIOLATION: ${conflicting.length} typed constraint(s) violated:\n${details}`,
  };
}

/**
 * Generate human-readable text for a typed lock (used as fallback for lock.text).
 */
export function formatTypedLockText(lock) {
  switch (lock.constraintType) {
    case "numerical":
      return `${lock.metric} must be ${lock.operator} ${lock.value}${lock.unit ? " " + lock.unit : ""}`;
    case "range":
      return `${lock.metric} must stay between ${lock.min} and ${lock.max}${lock.unit ? " " + lock.unit : ""}`;
    case "state":
      const transitions = lock.forbidden.map(f => `${f.from} -> ${f.to}`).join(", ");
      return `${lock.entity}: forbidden transitions: ${transitions}${lock.requireApproval ? " (requires human approval)" : ""}`;
    case "temporal":
      return `${lock.metric} must be ${lock.operator} ${lock.value}${lock.unit ? " " + lock.unit : ""}`;
    default:
      return "Unknown typed constraint";
  }
}
