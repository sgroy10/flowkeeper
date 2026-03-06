/**
 * SpecLock Hard Enforcement Engine
 * Moves from advisory-only to blocking enforcement.
 *
 * Modes:
 * - "advisory" (default): Returns warnings, AI decides what to do
 * - "hard": Returns isError:true in MCP, exit code 1 in CLI, 409 in HTTP
 *
 * Features:
 * - Configurable block threshold (default 70%)
 * - Override mechanism with reason logging to audit trail
 * - Escalation: 3+ overrides on same lock → auto-note for review
 *
 * Developed by Sandeep Roy (https://github.com/sgroy10)
 */

import {
  readBrain,
  writeBrain,
  appendEvent,
  bumpEvents,
  newId,
  nowIso,
  addViolation,
} from "./storage.js";
import { analyzeConflict } from "./semantics.js";

// --- Enforcement config helpers ---

/**
 * Get enforcement config from brain, with defaults.
 */
export function getEnforcementConfig(brain) {
  const defaults = {
    mode: "advisory",       // "advisory" | "hard"
    blockThreshold: 70,     // minimum confidence % to block in hard mode
    allowOverride: true,    // whether overrides are permitted
    escalationLimit: 3,     // overrides before auto-note
  };

  if (!brain.enforcement) return { ...defaults };

  return {
    ...defaults,
    ...brain.enforcement,
  };
}

/**
 * Set enforcement mode on a project.
 */
export function setEnforcementMode(root, mode, options = {}) {
  const brain = readBrain(root);
  if (!brain) {
    return { success: false, error: "SpecLock not initialized." };
  }

  if (mode !== "advisory" && mode !== "hard") {
    return { success: false, error: `Invalid mode: "${mode}". Must be "advisory" or "hard".` };
  }

  if (!brain.enforcement) {
    brain.enforcement = {};
  }

  brain.enforcement.mode = mode;
  if (options.blockThreshold !== undefined) {
    brain.enforcement.blockThreshold = Math.max(0, Math.min(100, options.blockThreshold));
  }
  if (options.allowOverride !== undefined) {
    brain.enforcement.allowOverride = !!options.allowOverride;
  }
  if (options.escalationLimit !== undefined) {
    brain.enforcement.escalationLimit = Math.max(1, options.escalationLimit);
  }

  const eventId = newId("evt");
  const event = {
    eventId,
    type: "enforcement_mode_changed",
    at: nowIso(),
    files: [],
    summary: `Enforcement mode set to: ${mode}${options.blockThreshold ? ` (threshold: ${options.blockThreshold}%)` : ""}`,
    patchPath: "",
  };
  bumpEvents(brain, eventId);
  appendEvent(root, event);
  writeBrain(root, brain);

  return {
    success: true,
    mode,
    config: getEnforcementConfig(brain),
  };
}

/**
 * Enforce a conflict check — returns enriched result with enforcement metadata.
 * This wraps the existing checkConflict logic with hard/advisory behavior.
 */
export function enforceConflictCheck(root, proposedAction) {
  const brain = readBrain(root);
  if (!brain) {
    return {
      hasConflict: false,
      blocked: false,
      mode: "advisory",
      conflictingLocks: [],
      analysis: "SpecLock not initialized. No enforcement.",
    };
  }

  const config = getEnforcementConfig(brain);
  const activeLocks = (brain.specLock?.items || []).filter((l) => l.active !== false);

  if (activeLocks.length === 0) {
    return {
      hasConflict: false,
      blocked: false,
      mode: config.mode,
      conflictingLocks: [],
      analysis: "No active locks. No constraints to check against.",
    };
  }

  // Run semantic analysis against all active locks
  const conflicting = [];
  for (const lock of activeLocks) {
    const result = analyzeConflict(proposedAction, lock.text);
    if (result.isConflict) {
      conflicting.push({
        id: lock.id,
        text: lock.text,
        confidence: result.confidence,
        level: result.level,
        reasons: result.reasons,
      });
    }
  }

  if (conflicting.length === 0) {
    return {
      hasConflict: false,
      blocked: false,
      mode: config.mode,
      conflictingLocks: [],
      analysis: `Checked against ${activeLocks.length} active lock(s). No conflicts detected (semantic analysis v2). Proceed with caution.`,
    };
  }

  // Sort by confidence descending
  conflicting.sort((a, b) => b.confidence - a.confidence);

  // Determine if this should be BLOCKED (hard mode + above threshold)
  const topConfidence = conflicting[0].confidence;
  const meetsThreshold = topConfidence >= config.blockThreshold;
  const blocked = config.mode === "hard" && meetsThreshold;

  const details = conflicting
    .map(
      (c) =>
        `- [${c.level}] "${c.text}" (confidence: ${c.confidence}%)\n  Reasons: ${c.reasons.join("; ")}`
    )
    .join("\n");

  // Record violation
  addViolation(brain, {
    at: nowIso(),
    action: proposedAction,
    locks: conflicting.map((c) => ({ id: c.id, text: c.text, confidence: c.confidence, level: c.level })),
    topLevel: conflicting[0].level,
    topConfidence,
    enforced: blocked,
    mode: config.mode,
  });
  writeBrain(root, brain);

  const modeLabel = blocked
    ? "BLOCKED — Hard enforcement active. This action cannot proceed."
    : "WARNING — Advisory mode. Review before proceeding.";

  return {
    hasConflict: true,
    blocked,
    mode: config.mode,
    threshold: config.blockThreshold,
    topConfidence,
    conflictingLocks: conflicting,
    analysis: `${modeLabel}\n\nConflict with ${conflicting.length} lock(s):\n${details}`,
  };
}

/**
 * Async version of enforceConflictCheck — uses Gemini proxy for grey-zone cases.
 * Falls back to heuristic-only if proxy is unavailable.
 */
export async function enforceConflictCheckAsync(root, proposedAction) {
  const brain = readBrain(root);
  if (!brain) {
    return {
      hasConflict: false,
      blocked: false,
      mode: "advisory",
      conflictingLocks: [],
      analysis: "SpecLock not initialized. No enforcement.",
    };
  }

  const config = getEnforcementConfig(brain);
  const activeLocks = (brain.specLock?.items || []).filter((l) => l.active !== false);

  if (activeLocks.length === 0) {
    return {
      hasConflict: false,
      blocked: false,
      mode: config.mode,
      conflictingLocks: [],
      analysis: "No active locks. No constraints to check against.",
    };
  }

  // Run heuristic against all active locks
  const conflicting = [];
  for (const lock of activeLocks) {
    const result = analyzeConflict(proposedAction, lock.text);
    if (result.isConflict) {
      conflicting.push({
        id: lock.id,
        text: lock.text,
        confidence: result.confidence,
        level: result.level,
        reasons: result.reasons,
        source: "heuristic",
      });
    }
  }

  // If all heuristic conflicts are HIGH, trust them — skip proxy
  const allHigh = conflicting.length > 0 && conflicting.every((c) => c.confidence > 70);

  // Grey zone: call proxy for Gemini coverage
  if (!allHigh) {
    try {
      const { checkConflictAsync } = await import("./conflict.js");
      const asyncResult = await checkConflictAsync(root, proposedAction);

      if (asyncResult.hasConflict) {
        // Merge: use async result's locks (which already merged heuristic + proxy)
        const merged = new Map();
        for (const c of conflicting) merged.set(c.text, c);
        for (const c of asyncResult.conflictingLocks) {
          const existing = merged.get(c.text);
          if (!existing || c.confidence > existing.confidence) {
            merged.set(c.text, {
              id: c.id || c.lockId,
              text: c.text,
              confidence: c.confidence,
              level: c.level,
              reasons: c.reasons || [],
              source: c.source || "proxy",
            });
          }
        }
        conflicting.length = 0;
        conflicting.push(...merged.values());
      }
    } catch (_) {
      // Proxy unavailable — continue with heuristic results
    }
  }

  if (conflicting.length === 0) {
    return {
      hasConflict: false,
      blocked: false,
      mode: config.mode,
      conflictingLocks: [],
      analysis: `Checked against ${activeLocks.length} active lock(s). No conflicts detected. Proceed with caution.`,
    };
  }

  // Sort by confidence descending
  conflicting.sort((a, b) => b.confidence - a.confidence);

  const topConfidence = conflicting[0].confidence;
  const meetsThreshold = topConfidence >= config.blockThreshold;
  const blocked = config.mode === "hard" && meetsThreshold;

  const details = conflicting
    .map(
      (c) =>
        `- [${c.level}] "${c.text}" (confidence: ${c.confidence}%)\n  Reasons: ${c.reasons.join("; ")}`
    )
    .join("\n");

  addViolation(brain, {
    at: nowIso(),
    action: proposedAction,
    locks: conflicting.map((c) => ({ id: c.id, text: c.text, confidence: c.confidence, level: c.level })),
    topLevel: conflicting[0].level,
    topConfidence,
    enforced: blocked,
    mode: config.mode,
  });
  writeBrain(root, brain);

  const modeLabel = blocked
    ? "BLOCKED — Hard enforcement active. This action cannot proceed."
    : "WARNING — Advisory mode. Review before proceeding.";

  return {
    hasConflict: true,
    blocked,
    mode: config.mode,
    threshold: config.blockThreshold,
    topConfidence,
    conflictingLocks: conflicting,
    analysis: `${modeLabel}\n\nConflict with ${conflicting.length} lock(s):\n${details}`,
  };
}

/**
 * Override a lock for a specific action, with a reason.
 * Logged to audit trail. Triggers escalation if overridden too many times.
 */
export function overrideLock(root, lockId, action, reason) {
  const brain = readBrain(root);
  if (!brain) {
    return { success: false, error: "SpecLock not initialized." };
  }

  const config = getEnforcementConfig(brain);
  if (!config.allowOverride) {
    return { success: false, error: "Overrides are disabled for this project." };
  }

  const lock = (brain.specLock?.items || []).find((l) => l.id === lockId);
  if (!lock) {
    return { success: false, error: `Lock not found: ${lockId}` };
  }
  if (!lock.active) {
    return { success: false, error: `Lock is already inactive: ${lockId}` };
  }

  // Initialize overrides tracking on the lock
  if (!lock.overrides) lock.overrides = [];
  lock.overrides.push({
    at: nowIso(),
    action,
    reason,
  });

  // Record override event in audit trail
  const eventId = newId("evt");
  const event = {
    eventId,
    type: "lock_overridden",
    at: nowIso(),
    files: [],
    summary: `Lock overridden: "${lock.text.substring(0, 60)}" — Reason: ${reason.substring(0, 100)}`,
    patchPath: "",
    meta: { lockId, action, reason },
  };
  bumpEvents(brain, eventId);
  appendEvent(root, event);

  // Check for escalation
  let escalated = false;
  const overrideCount = lock.overrides.length;
  if (overrideCount >= config.escalationLimit) {
    escalated = true;

    // Auto-create a note flagging this for review
    const noteId = newId("note");
    brain.notes.unshift({
      id: noteId,
      text: `ESCALATION: Lock "${lock.text}" has been overridden ${overrideCount} times. Review whether this lock is still appropriate or if it should be removed.`,
      createdAt: nowIso(),
      pinned: true,
    });

    const noteEventId = newId("evt");
    const noteEvent = {
      eventId: noteEventId,
      type: "note_added",
      at: nowIso(),
      files: [],
      summary: `Escalation note: Lock "${lock.text.substring(0, 40)}" overridden ${overrideCount} times`,
      patchPath: "",
    };
    bumpEvents(brain, noteEventId);
    appendEvent(root, noteEvent);
  }

  writeBrain(root, brain);

  return {
    success: true,
    lockId,
    lockText: lock.text,
    overrideCount,
    escalated,
    escalationMessage: escalated
      ? `WARNING: This lock has been overridden ${overrideCount} times (limit: ${config.escalationLimit}). An escalation note has been created for review.`
      : null,
  };
}

/**
 * Get override history for a specific lock or all locks.
 */
export function getOverrideHistory(root, lockId = null) {
  const brain = readBrain(root);
  if (!brain) {
    return { overrides: [], total: 0 };
  }

  const locks = (brain.specLock?.items || []).filter((l) => {
    if (lockId) return l.id === lockId;
    return l.overrides && l.overrides.length > 0;
  });

  const overrides = [];
  for (const lock of locks) {
    if (!lock.overrides) continue;
    for (const ov of lock.overrides) {
      overrides.push({
        lockId: lock.id,
        lockText: lock.text,
        lockActive: lock.active,
        ...ov,
      });
    }
  }

  // Sort by date descending
  overrides.sort((a, b) => (b.at > a.at ? 1 : -1));

  return {
    overrides,
    total: overrides.length,
  };
}
