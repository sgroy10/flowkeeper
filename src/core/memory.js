/**
 * SpecLock Memory Module
 * Goal, lock, decision, note, deploy facts CRUD operations.
 * Extracted from engine.js for modularity.
 *
 * Developed by Sandeep Roy (https://github.com/sgroy10)
 */

import fs from "fs";
import path from "path";
import {
  nowIso,
  newId,
  readBrain,
  writeBrain,
  appendEvent,
  bumpEvents,
  ensureSpeclockDirs,
  speclockDir,
  makeBrain,
} from "./storage.js";
import { hasGit, getHead, getDefaultBranch } from "./git.js";
import { ensureAuditKeyGitignored } from "./audit.js";
import { normalizeLock } from "./lock-author.js";
import { validateTypedLock, formatTypedLockText } from "./typed-constraints.js";

// --- Internal helpers ---

function recordEvent(root, brain, event) {
  bumpEvents(brain, event.eventId);
  appendEvent(root, event);
  writeBrain(root, brain);
}

// --- Core functions ---

export function ensureInit(root) {
  ensureSpeclockDirs(root);
  try { ensureAuditKeyGitignored(root); } catch { /* non-critical */ }
  let brain = readBrain(root);
  if (!brain) {
    const gitExists = hasGit(root);
    const defaultBranch = gitExists ? getDefaultBranch(root) : "";
    brain = makeBrain(root, gitExists, defaultBranch);
    if (gitExists) {
      const head = getHead(root);
      brain.state.head.gitBranch = head.gitBranch;
      brain.state.head.gitCommit = head.gitCommit;
      brain.state.head.capturedAt = nowIso();
    }
    const eventId = newId("evt");
    const event = {
      eventId,
      type: "init",
      at: nowIso(),
      files: [],
      summary: "Initialized SpecLock",
      patchPath: "",
    };
    bumpEvents(brain, eventId);
    appendEvent(root, event);
    writeBrain(root, brain);
  }
  return brain;
}

export function setGoal(root, text) {
  const brain = ensureInit(root);
  brain.goal.text = text;
  brain.goal.updatedAt = nowIso();
  const eventId = newId("evt");
  const event = {
    eventId,
    type: "goal_updated",
    at: nowIso(),
    files: [],
    summary: `Goal set: ${text.substring(0, 80)}`,
    patchPath: "",
  };
  recordEvent(root, brain, event);
  return brain;
}

export function addLock(root, text, tags, source) {
  const brain = ensureInit(root);
  const lockId = newId("lock");

  // Store the user's exact words — no rewriting.
  // The semantic engine handles verb contamination via subject extraction
  // and scope matching, so rewriting is no longer needed.
  brain.specLock.items.unshift({
    id: lockId,
    text: text,
    createdAt: nowIso(),
    source: source || "user",
    tags: tags || [],
    active: true,
  });
  const eventId = newId("evt");
  const event = {
    eventId,
    type: "lock_added",
    at: nowIso(),
    files: [],
    summary: `Lock added: ${text.substring(0, 80)}`,
    patchPath: "",
  };
  recordEvent(root, brain, event);
  return { brain, lockId, rewritten: false, rewriteReason: null };
}

export function removeLock(root, lockId) {
  const brain = ensureInit(root);
  const lock = brain.specLock.items.find((l) => l.id === lockId);
  if (!lock) {
    return { brain, removed: false, error: `Lock not found: ${lockId}` };
  }
  lock.active = false;
  const eventId = newId("evt");
  const event = {
    eventId,
    type: "lock_removed",
    at: nowIso(),
    files: [],
    summary: `Lock removed: ${lock.text.substring(0, 80)}`,
    patchPath: "",
  };
  recordEvent(root, brain, event);
  return { brain, removed: true, lockText: lock.text };
}

export function addDecision(root, text, tags, source) {
  const brain = ensureInit(root);
  const decId = newId("dec");
  brain.decisions.unshift({
    id: decId,
    text,
    createdAt: nowIso(),
    source: source || "user",
    tags: tags || [],
  });
  const eventId = newId("evt");
  const event = {
    eventId,
    type: "decision_added",
    at: nowIso(),
    files: [],
    summary: `Decision: ${text.substring(0, 80)}`,
    patchPath: "",
  };
  recordEvent(root, brain, event);
  return { brain, decId };
}

export function addNote(root, text, pinned = true) {
  const brain = ensureInit(root);
  const noteId = newId("note");
  brain.notes.unshift({
    id: noteId,
    text,
    createdAt: nowIso(),
    pinned,
  });
  const eventId = newId("evt");
  const event = {
    eventId,
    type: "note_added",
    at: nowIso(),
    files: [],
    summary: `Note: ${text.substring(0, 80)}`,
    patchPath: "",
  };
  recordEvent(root, brain, event);
  return { brain, noteId };
}

/**
 * Add a typed constraint lock (numerical, range, state, temporal).
 * These are for autonomous systems governance — real-time value/state checking.
 * Existing text locks use addLock() and are unaffected.
 *
 * @param {string} root - Project root
 * @param {Object} constraint - Typed constraint definition:
 *   { constraintType, metric?, operator?, value?, min?, max?, entity?, forbidden?, unit?, requireApproval? }
 * @param {string[]} tags - Category tags
 * @param {string} source - "user" or "agent"
 * @param {string} description - Human-readable description (optional, auto-generated if missing)
 */
export function addTypedLock(root, constraint, tags, source, description) {
  const validation = validateTypedLock(constraint);
  if (!validation.valid) {
    return { brain: null, lockId: null, error: validation.error };
  }

  const brain = ensureInit(root);
  const lockId = newId("lock");
  const text = description || formatTypedLockText(constraint);

  brain.specLock.items.unshift({
    id: lockId,
    text,
    constraintType: constraint.constraintType,
    // Type-specific fields
    ...(constraint.metric && { metric: constraint.metric }),
    ...(constraint.operator && { operator: constraint.operator }),
    ...(constraint.value !== undefined && { value: constraint.value }),
    ...(constraint.min !== undefined && { min: constraint.min }),
    ...(constraint.max !== undefined && { max: constraint.max }),
    ...(constraint.unit && { unit: constraint.unit }),
    ...(constraint.entity && { entity: constraint.entity }),
    ...(constraint.forbidden && { forbidden: constraint.forbidden }),
    ...(constraint.requireApproval !== undefined && { requireApproval: constraint.requireApproval }),
    createdAt: nowIso(),
    source: source || "user",
    tags: tags || [],
    active: true,
  });

  const eventId = newId("evt");
  const event = {
    eventId,
    type: "lock_added",
    at: nowIso(),
    files: [],
    summary: `Typed lock added (${constraint.constraintType}): ${text.substring(0, 80)}`,
    patchPath: "",
  };
  recordEvent(root, brain, event);
  return { brain, lockId, constraintType: constraint.constraintType };
}

/**
 * Update a typed lock's threshold value (for numerical/range/temporal).
 * Records the change in audit trail.
 */
export function updateTypedLockThreshold(root, lockId, updates) {
  const brain = ensureInit(root);
  const lock = brain.specLock.items.find((l) => l.id === lockId);

  if (!lock) {
    return { brain: null, error: `Lock not found: ${lockId}` };
  }
  if (!lock.constraintType) {
    return { brain: null, error: `Lock ${lockId} is a text lock, not a typed constraint` };
  }

  const oldValues = {};

  // Update allowed fields based on constraint type
  if (lock.constraintType === "numerical" || lock.constraintType === "temporal") {
    if (updates.value !== undefined) {
      oldValues.value = lock.value;
      lock.value = updates.value;
    }
    if (updates.operator) {
      oldValues.operator = lock.operator;
      lock.operator = updates.operator;
    }
  } else if (lock.constraintType === "range") {
    if (updates.min !== undefined) {
      oldValues.min = lock.min;
      lock.min = updates.min;
    }
    if (updates.max !== undefined) {
      oldValues.max = lock.max;
      lock.max = updates.max;
    }
  } else if (lock.constraintType === "state") {
    if (updates.forbidden) {
      oldValues.forbidden = lock.forbidden;
      lock.forbidden = updates.forbidden;
    }
  }

  // Regenerate text description
  lock.text = formatTypedLockText(lock);

  const eventId = newId("evt");
  const event = {
    eventId,
    type: "lock_updated",
    at: nowIso(),
    files: [],
    summary: `Typed lock ${lockId} threshold updated: ${JSON.stringify(oldValues)} -> ${JSON.stringify(updates)}`,
    patchPath: "",
  };
  recordEvent(root, brain, event);
  return { brain, lockId, oldValues, newValues: updates };
}

export function updateDeployFacts(root, payload) {
  const brain = ensureInit(root);
  const deploy = brain.facts.deploy;
  if (payload.provider !== undefined) deploy.provider = payload.provider;
  if (typeof payload.autoDeploy === "boolean")
    deploy.autoDeploy = payload.autoDeploy;
  if (payload.branch !== undefined) deploy.branch = payload.branch;
  if (payload.url !== undefined) deploy.url = payload.url;
  if (payload.notes !== undefined) deploy.notes = payload.notes;
  const eventId = newId("evt");
  const event = {
    eventId,
    type: "fact_updated",
    at: nowIso(),
    files: [],
    summary: "Updated deploy facts",
    patchPath: "",
  };
  recordEvent(root, brain, event);
  return brain;
}
