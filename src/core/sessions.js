/**
 * SpecLock Sessions Module
 * Session briefing, start, end, and history management.
 * Extracted from engine.js for modularity.
 *
 * Developed by Sandeep Roy (https://github.com/sgroy10)
 */

import {
  nowIso,
  newId,
  writeBrain,
  appendEvent,
  bumpEvents,
  readEvents,
} from "./storage.js";
import { ensureInit } from "./memory.js";

// --- Internal helpers ---

function recordEvent(root, brain, event) {
  bumpEvents(brain, event.eventId);
  appendEvent(root, event);
  writeBrain(root, brain);
}

// --- Core functions ---

export function startSession(root, toolName = "unknown") {
  const brain = ensureInit(root);

  // Auto-close previous session if open
  if (brain.sessions.current) {
    const prev = brain.sessions.current;
    prev.endedAt = nowIso();
    prev.summary = prev.summary || "Session auto-closed (new session started)";
    brain.sessions.history.unshift(prev);
    if (brain.sessions.history.length > 50) {
      brain.sessions.history = brain.sessions.history.slice(0, 50);
    }
  }

  const session = {
    id: newId("ses"),
    startedAt: nowIso(),
    endedAt: null,
    summary: "",
    toolUsed: toolName,
    eventsInSession: 0,
  };
  brain.sessions.current = session;

  const eventId = newId("evt");
  const event = {
    eventId,
    type: "session_started",
    at: nowIso(),
    files: [],
    summary: `Session started (${toolName})`,
    patchPath: "",
  };
  recordEvent(root, brain, event);
  return { brain, session };
}

export function endSession(root, summary) {
  const brain = ensureInit(root);
  if (!brain.sessions.current) {
    return { brain, ended: false, error: "No active session to end." };
  }

  const session = brain.sessions.current;
  session.endedAt = nowIso();
  session.summary = summary;

  const events = readEvents(root, { since: session.startedAt });
  session.eventsInSession = events.length;

  brain.sessions.history.unshift(session);
  if (brain.sessions.history.length > 50) {
    brain.sessions.history = brain.sessions.history.slice(0, 50);
  }
  brain.sessions.current = null;

  const eventId = newId("evt");
  const event = {
    eventId,
    type: "session_ended",
    at: nowIso(),
    files: [],
    summary: `Session ended: ${summary.substring(0, 100)}`,
    patchPath: "",
  };
  recordEvent(root, brain, event);
  return { brain, ended: true, session };
}

export function getSessionBriefing(root, toolName = "unknown") {
  const { brain, session } = startSession(root, toolName);

  const lastSession =
    brain.sessions.history.length > 0 ? brain.sessions.history[0] : null;

  let changesSinceLastSession = 0;
  let warnings = [];

  if (lastSession && lastSession.endedAt) {
    const eventsSince = readEvents(root, { since: lastSession.endedAt });
    changesSinceLastSession = eventsSince.length;

    const revertsSince = eventsSince.filter(
      (e) => e.type === "revert_detected"
    );
    if (revertsSince.length > 0) {
      warnings.push(
        `${revertsSince.length} revert(s) detected since last session. Verify current state before proceeding.`
      );
    }
  }

  return {
    brain,
    session,
    lastSession,
    changesSinceLastSession,
    warnings,
  };
}
